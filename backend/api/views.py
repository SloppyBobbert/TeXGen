import json
import os
import re
import tempfile
import time
from html import unescape
from io import BytesIO
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.contrib.auth.models import User
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .compiler import (
    CompilationCapacityExceeded,
    CompilationFailure,
    CompilationRateLimited,
    CompilationTimedOut,
    acquire_compile_slot,
    compile_tex,
    rate_limit_peer_key,
)
from .formula_data import (
    get_classes_with_details,
    get_formula_data,
    get_special_class_formula,
    is_special_class,
)
from .latex_utils import build_latex_for_formulas, normalize_latex_layout
from .models import CheatSheet, PracticeProblem, Template
from .serializers import (
    CheatSheetSerializer,
    CustomTokenObtainPairSerializer,
    PracticeProblemSerializer,
    TemplateSerializer,
    UserSerializer,
)

YOUTUBE_MAX_TOPICS = 6
YOUTUBE_SEARCH_RESULT_LIMIT = 5
YOUTUBE_MIN_VIEW_COUNT = 10_000
YOUTUBE_RESOURCE_CACHE_TTL_SECONDS = 60 * 60 * 12
YOUTUBE_TOPIC_SET = None
YOUTUBE_RESOURCE_CACHE = {}

# ------------------------------------------------------------------
# Whitelist validation for layout parameters
# ------------------------------------------------------------------

VALID_FONT_SIZES = {"8pt", "9pt", "10pt", "11pt", "12pt"}
VALID_SPACING = {"tiny", "small", "medium", "large"}
VALID_MARGINS = {"0.15in", "0.25in", "0.5in", "0.75in", "1in", "1.5in", "2in"}
VALID_ORIENTATION = {"portrait", "landscape"} 
DEFAULT_COLUMNS = 4
DEFAULT_FONT_SIZE = "9pt"
DEFAULT_SPACING = "small"
DEFAULT_MARGINS = "0.15in"

def is_valid_custom_pt(value, min_value, max_value):
    normalized = str(value or "").strip()
    if not normalized.endswith("pt"):
        return False
    try:
        amount = float(normalized[:-2])
    except ValueError:
        return False
    return min_value <= amount <= max_value


def is_truthy(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def latex_error(details, status_code=status.HTTP_400_BAD_REQUEST):
    return Response(
        {"error": "Failed to compile LaTeX", "details": details}, status=status_code
    )


def exceeds_latex_request_limit(request):
    try:
        return (
            int(request.META.get("CONTENT_LENGTH") or 0)
            > settings.LATEX_MAX_REQUEST_BYTES
        )
    except ValueError:
        return True

def validate_layout_params(columns, font_size, margins, spacing, orientation="portrait"):
    try:
        columns = max(1, min(5, int(columns)))
    except (TypeError, ValueError):
        columns = DEFAULT_COLUMNS
    
    if font_size not in VALID_FONT_SIZES and not is_valid_custom_pt(font_size, 6, 18):
        font_size = DEFAULT_FONT_SIZE
    
    if margins not in VALID_MARGINS:
        margins = DEFAULT_MARGINS
    
    if spacing not in VALID_SPACING and not is_valid_custom_pt(spacing, 0, 6):
        spacing = DEFAULT_SPACING

    if orientation not in VALID_ORIENTATION:
        orientation = "portrait"
    
    return columns, font_size, margins, spacing, orientation


def build_youtube_search_query(class_name, category_name):
    return f"{class_name} {category_name} formula tutorial"


def clean_youtube_error_message(value):
    text = unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", "", text)
    return " ".join(text.split())


def get_youtube_http_error_message(exc):
    detail = ""

    try:
        payload = json.loads(exc.read().decode("utf-8"))
        error = payload.get("error") or {}
        errors = error.get("errors") or []
        first_error = errors[0] if errors else {}
        reason = clean_youtube_error_message(first_error.get("reason") or error.get("status"))
        message = clean_youtube_error_message(first_error.get("message") or error.get("message"))
        detail = ": ".join(part for part in [reason, message] if part)
    except (AttributeError, json.JSONDecodeError, UnicodeDecodeError):
        detail = ""

    status_detail = f"{exc.code}: {detail}" if detail else str(exc.code)

    if exc.code == 403:
        return (
            f"YouTube search failed ({status_detail}). "
            "Check the YouTube Data API v3 status, API key restrictions, and quota."
        )

    return f"YouTube search failed ({status_detail})"


def fetch_youtube_json(url):
    with urlopen(url, timeout=4) as response:
        return json.loads(response.read().decode("utf-8"))


def get_cached_youtube_resource(class_name, category):
    cache_key = (class_name, category)
    cached = YOUTUBE_RESOURCE_CACHE.get(cache_key)
    if not cached:
        return None

    expires_at, resource = cached
    if expires_at <= time.time():
        YOUTUBE_RESOURCE_CACHE.pop(cache_key, None)
        return None

    return resource


def set_cached_youtube_resource(class_name, category, resource):
    cache_key = (class_name, category)
    expires_at = time.time() + YOUTUBE_RESOURCE_CACHE_TTL_SECONDS
    YOUTUBE_RESOURCE_CACHE[cache_key] = (expires_at, resource)


def get_youtube_video_id(item):
    raw_id = item.get("id") or {}
    return raw_id.get("videoId") if isinstance(raw_id, dict) else raw_id


def get_youtube_view_count(item):
    try:
        return int((item.get("statistics") or {}).get("viewCount") or 0)
    except (TypeError, ValueError):
        return 0


def fetch_top_youtube_video(class_name, category_name, api_key):
    params = urlencode(
        {
            "part": "snippet",
            "type": "video",
            "maxResults": YOUTUBE_SEARCH_RESULT_LIMIT,
            "order": "relevance",
            "safeSearch": "strict",
            "videoEmbeddable": "true",
            "q": build_youtube_search_query(class_name, category_name),
            "key": api_key,
        }
    )
    url = f"https://www.googleapis.com/youtube/v3/search?{params}"

    try:
        payload = fetch_youtube_json(url)
    except HTTPError as exc:
        raise RuntimeError(get_youtube_http_error_message(exc)) from exc
    except URLError as exc:
        raise RuntimeError("YouTube search is unavailable") from exc

    items = payload.get("items") or []
    if not items:
        return None

    video_ids = [video_id for item in items if (video_id := get_youtube_video_id(item))]
    if not video_ids:
        return None

    details_params = urlencode(
        {
            "part": "snippet,statistics",
            "id": ",".join(video_ids),
            "key": api_key,
        }
    )
    details_url = f"https://www.googleapis.com/youtube/v3/videos?{details_params}"

    try:
        details_payload = fetch_youtube_json(details_url)
    except HTTPError as exc:
        raise RuntimeError(get_youtube_http_error_message(exc)) from exc
    except URLError as exc:
        raise RuntimeError("YouTube search is unavailable") from exc

    details_by_id = {item.get("id"): item for item in details_payload.get("items", [])}
    selected_item = None
    selected_details = None

    for item in items:
        video_id = get_youtube_video_id(item)
        details = details_by_id.get(video_id)
        if details and get_youtube_view_count(details) >= YOUTUBE_MIN_VIEW_COUNT:
            selected_item = item
            selected_details = details
            break

    if selected_item is None:
        selected_item = items[0]
        selected_details = details_by_id.get(get_youtube_video_id(selected_item))

    snippet = (selected_details or selected_item).get("snippet") or {}
    view_count = get_youtube_view_count(selected_details or {})
    thumbnails = snippet.get("thumbnails") or {}
    thumbnail = (
        thumbnails.get("high")
        or thumbnails.get("medium")
        or thumbnails.get("default")
        or {}
    )

    return {
        "className": class_name,
        "category": category_name,
        "title": snippet.get("title") or f"{category_name} walkthrough",
        "channel": snippet.get("channelTitle") or "YouTube",
        "description": snippet.get("description") or "",
        "videoId": get_youtube_video_id(selected_item) or "",
        "viewCount": view_count,
        "thumbnailUrl": thumbnail.get("url") or "",
    }


def get_valid_youtube_topics():
    global YOUTUBE_TOPIC_SET
    if YOUTUBE_TOPIC_SET is None:
        topic_pairs = set()
        for class_data in get_classes_with_details():
            class_name = class_data.get("name")
            for category in class_data.get("categories") or []:
                category_name = category.get("name")
                if class_name and category_name:
                    topic_pairs.add((class_name, category_name))
        YOUTUBE_TOPIC_SET = topic_pairs
    return YOUTUBE_TOPIC_SET

# ------------------------------------------------------------------
# API endpoints
# ------------------------------------------------------------------

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class RegisterView(CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer


@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def get_classes(request):
    """
    GET /api/classes/
    Returns full structure with classes, categories, and formulas.
    Used by frontend to build 3-level selection UI.
    """
    classes_with_details = get_classes_with_details()
    return Response({"classes": classes_with_details})


@api_view(["POST"])
def generate_sheet(request):
    """
    Accepts { "formulas": [...], "columns": 4, "font_size": "9pt", "margins": "0.15in", "spacing": "small", "orientation": "portrait" }
    Each formula: { "class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula" }
    Or for special classes (like UNIT CIRCLE): { "class": "UNIT CIRCLE", "name": "Unit Circle (Key Angles)" }
    Returns { "tex_code": "..." }
    """
    selected = request.data.get("formulas", [])
    columns = request.data.get("columns", DEFAULT_COLUMNS)
    font_size = request.data.get("font_size", DEFAULT_FONT_SIZE)
    margins = request.data.get("margins", DEFAULT_MARGINS)
    spacing = request.data.get("spacing", DEFAULT_SPACING)
    orientation = request.data.get("orientation", "portrait")
    
    columns, font_size, margins, spacing, orientation = validate_layout_params(columns, font_size, margins, spacing, orientation)
    
    if not selected:
        tex_code = build_latex_for_formulas([], columns, font_size, margins, spacing, orientation)
        return Response({"tex_code": tex_code})
    
    formula_data = get_formula_data()
    selected_formulas = []
    
    for sel in selected:
        class_name = sel.get("class") or sel.get("class_name")
        category = sel.get("category")
        name = sel.get("name")
        
        if is_special_class(class_name):
            formula = get_special_class_formula(class_name)
            if formula:
                selected_formulas.append({
                    "class_name": class_name,
                    "category": class_name,
                    "name": formula["name"],
                    "latex": formula["latex"]
                })
        elif class_name in formula_data:
            categories = formula_data[class_name]
            if category in categories:
                formulas = categories[category]
                for f in formulas:
                    if f.get("name") == name:
                        selected_formulas.append({
                            "class_name": class_name,
                            "category": category,
                            "name": f["name"],
                            "latex": f["latex"]
                        })
            else:
                for current_category, formulas in categories.items():
                    match = next((f for f in formulas if f.get("name") == name), None)
                    if match:
                        selected_formulas.append({
                            "class_name": class_name,
                            "category": current_category,
                            "name": match["name"],
                            "latex": match["latex"]
                        })
                        break
    
    if not selected_formulas:
        return Response({"error": "No valid formulas found"}, status=400)
    
    tex_code = build_latex_for_formulas(selected_formulas, columns, font_size, margins, spacing, orientation)
    return Response({"tex_code": tex_code})


@api_view(["POST"])
@permission_classes([AllowAny])
def compile_latex(request):
    """
    POST /api/compile/
    """
    if exceeds_latex_request_limit(request):
        return Response({"error": "LaTeX request exceeds maximum size"}, status=413)

    content = request.data.get("content", "")
    cheat_sheet_id = request.data.get("cheat_sheet_id")
    normalize_only = is_truthy(request.data.get("normalize_only"))
    columns = request.data.get("columns", DEFAULT_COLUMNS)
    font_size = request.data.get("font_size", DEFAULT_FONT_SIZE)
    margins = request.data.get("margins", DEFAULT_MARGINS)
    spacing = request.data.get("spacing", DEFAULT_SPACING)
    orientation = request.data.get("orientation", "portrait")
    
    columns, font_size, margins, spacing, orientation = validate_layout_params(columns, font_size, margins, spacing, orientation)
    
    if cheat_sheet_id:
        cheatsheet = get_object_or_404(CheatSheet, pk=cheat_sheet_id, user=request.user)
        columns = cheatsheet.columns
        font_size = cheatsheet.font_size
        margins = cheatsheet.margins
        spacing = cheatsheet.spacing
        orientation = getattr(cheatsheet, "orientation", None) or "portrait"
        content = cheatsheet.build_full_latex()
    
    if not content:
        return Response({"error": "No LaTeX content provided"}, status=400)

    if not isinstance(content, str):
        return Response({"error": "LaTeX content must be a string"}, status=400)

    if len(content.encode("utf-8")) > settings.LATEX_MAX_INPUT_BYTES:
        return Response({"error": "LaTeX content exceeds maximum size"}, status=413)

    content = normalize_latex_layout(content, columns, font_size, margins, spacing, orientation)

    if normalize_only:
        layout_response = {
            "columns": columns,
            "font_size": font_size,
            "margins": margins,
            "spacing": spacing,
            "orientation": orientation,
        }

        return Response({
            "tex_code": content,
            "layout": layout_response,
        })
    
    try:
        slot = acquire_compile_slot(rate_limit_peer_key(request.META.get("REMOTE_ADDR")))
    except CompilationRateLimited:
        return Response({"error": "Too many compilation requests"}, status=429)
    except CompilationCapacityExceeded:
        return Response({"error": "Compiler is busy"}, status=429)

    try:
        with tempfile.TemporaryDirectory() as tempdir:
            tex_file_path = os.path.join(tempdir, "document.tex")
            with open(tex_file_path, "w", encoding="utf-8") as f:
                f.write(content)

            output_dir = os.path.join(tempdir, "output")
            os.mkdir(output_dir)
            diagnostic_path = os.path.join(tempdir, "tectonic.log")
            try:
                compile_tex(tex_file_path, output_dir, diagnostic_path)
            except FileNotFoundError:
                return Response(
                    {"error": "Tectonic is not installed on the backend."},
                    status=500,
                )
            except CompilationTimedOut as exc:
                return latex_error(str(exc))
            except CompilationFailure as exc:
                return latex_error(str(exc))
            except Exception as exc:
                return latex_error(str(exc), status.HTTP_500_INTERNAL_SERVER_ERROR)
        
            pdf_file_path = os.path.join(output_dir, "document.pdf")
            if os.path.exists(pdf_file_path):
                if os.path.getsize(pdf_file_path) > settings.LATEX_MAX_OUTPUT_BYTES:
                    return Response(
                        {"error": "Generated PDF exceeds maximum size"}, status=413
                    )
                with open(pdf_file_path, "rb") as pdf_file:
                    response = FileResponse(
                        BytesIO(pdf_file.read()), content_type="application/pdf"
                    )
                response["Content-Disposition"] = 'inline; filename="document.pdf"'
                return response
            return Response({"error": "PDF not generated"}, status=500)
    finally:
        slot.release()


@api_view(["POST"])
@permission_classes([AllowAny])
def youtube_resources(request):
    topics = request.data.get("topics", [])
    if not isinstance(topics, list):
        return Response({"error": "topics must be a list"}, status=400)
    if len(topics) > YOUTUBE_MAX_TOPICS:
        topics = topics[:YOUTUBE_MAX_TOPICS]

    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        return Response(
            {
                "resources": [],
                "configured": False,
                "message": "YOUTUBE_API_KEY is not configured.",
            }
        )

    seen = set()
    sanitized_topics = []
    valid_topics = get_valid_youtube_topics()
    for topic in topics:
        class_name = str((topic or {}).get("className") or "").strip()
        category = str((topic or {}).get("category") or "").strip()
        if not class_name or not category:
            continue
        if (class_name, category) not in valid_topics:
            return Response({"error": "Invalid topic requested"}, status=400)
        lookup_key = (class_name, category)
        if lookup_key in seen:
            continue
        seen.add(lookup_key)
        sanitized_topics.append({"className": class_name, "category": category})

    resources = []
    errors = []
    for topic in sanitized_topics:
        cached_resource = get_cached_youtube_resource(topic["className"], topic["category"])
        if cached_resource is not None:
            if cached_resource:
                resources.append(cached_resource)
            continue

        try:
            resource = fetch_top_youtube_video(topic["className"], topic["category"], api_key)
        except RuntimeError as exc:
            errors.append(str(exc))
            continue

        set_cached_youtube_resource(topic["className"], topic["category"], resource or {})
        if resource and resource["videoId"]:
            resources.append(resource)

    return Response(
        {
            "resources": resources,
            "configured": True,
            "errors": errors,
        }
    )


# ------------------------------------------------------------------
# CRUD API ViewSets for Templates, CheatSheets, and Problems
# ------------------------------------------------------------------

class TemplateViewSet(viewsets.ModelViewSet):
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        subject = self.request.query_params.get('subject')
        if subject:
            queryset = queryset.filter(subject=subject)
        return queryset


class CheatSheetViewSet(viewsets.ModelViewSet):
    queryset = CheatSheet.objects.all()
    serializer_class = CheatSheetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='from-template')
    def from_template(self, request):
        template_id = request.data.get("template_id")
        title = request.data.get("title", "Untitled")
        
        if not template_id:
            return Response({"error": "template_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        template = get_object_or_404(Template, pk=template_id)
        
        cheatsheet = CheatSheet.objects.create(
            title=title,
            user=request.user,
            template=template,
            latex_content=template.latex_content,
            margins=template.default_margins,
            columns=template.default_columns,
        )
        
        serializer = self.get_serializer(cheatsheet)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PracticeProblemViewSet(viewsets.ModelViewSet):
    queryset = PracticeProblem.objects.all()
    serializer_class = PracticeProblemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        cheat_sheet_id = self.request.query_params.get('cheat_sheet')
        if cheat_sheet_id:
            queryset = queryset.filter(cheat_sheet=cheat_sheet_id)
        return queryset
