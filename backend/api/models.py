from django.conf import settings
from django.db import models

from .rendering import DocumentRenderRequest, LayoutSpec, PracticeProblemSpec, render_document

class GuestCompileBalance(models.Model):
    identity = models.UUIDField(primary_key=True, editable=False)
    used = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(used__lte=3), name="guest_compile_max_three")]


class Template(models.Model):
    SOURCE_MODE_CHOICES = [
        ("empty", "Empty"),
        ("generated", "Generated"),
        ("raw", "Raw"),
    ]

    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    latex_content = models.TextField()
    default_columns = models.IntegerField(default=4)
    default_margins = models.CharField(max_length=20, default="0.15in")
    selected_formulas = models.JSONField(default=list, blank=True)
    schema_version = models.PositiveIntegerField(default=1)
    revision = models.PositiveBigIntegerField(default=1)
    source_mode = models.CharField(max_length=20, choices=SOURCE_MODE_CHOICES, default="empty")
    formula_selections = models.JSONField(default=list, blank=True)
    generated_sections = models.JSONField(null=True, blank=True, default=None)
    default_font_size = models.CharField(max_length=10, default="9pt")
    default_spacing = models.CharField(max_length=10, default="small")
    default_orientation = models.CharField(max_length=20, default="portrait")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(schema_version=1), name="template_schema_version_is_1"),
            models.CheckConstraint(condition=models.Q(revision__gte=1), name="template_revision_gte_1"),
            models.CheckConstraint(condition=models.Q(source_mode__in=["empty", "generated", "raw"]), name="template_source_mode_valid"),
            models.CheckConstraint(condition=models.Q(default_columns__range=(1, 5)), name="template_default_columns_1_to_5"),
            models.CheckConstraint(condition=models.Q(default_orientation__in=["portrait", "landscape"]), name="template_default_orientation_valid"),
        ]

    def __str__(self):
        return self.name


class CheatSheet(models.Model):
    CONTENT_SOURCE_CHOICES = [
        ("empty", "Empty"),
        ("generated", "Generated"),
        ("manual", "Manual"),
    ]
    SOURCE_MODE_CHOICES = [
        ("empty", "Empty"),
        ("generated", "Generated"),
        ("raw", "Raw"),
    ]

    title = models.CharField(max_length=200)
    latex_content = models.TextField(blank=True, default="")
    content_source = models.CharField(
        max_length=20,
        choices=CONTENT_SOURCE_CHOICES,
        default="empty",
    )
    template = models.ForeignKey(
        Template, on_delete=models.SET_NULL, null=True, blank=True
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cheat_sheets")
    columns = models.IntegerField(default=4)
    margins = models.CharField(max_length=20, default="0.15in")
    font_size = models.CharField(max_length=10, default="9pt")
    spacing = models.CharField(max_length=10, default="small")
    orientation = models.CharField(max_length=20, default="portrait")
    # Stores selected formulas with user-defined order: [{"class": "...", "category": "...", "name": "..."}]
    selected_formulas = models.JSONField(default=list, blank=True)
    schema_version = models.PositiveIntegerField(default=1)
    revision = models.PositiveBigIntegerField(default=1)
    source_mode = models.CharField(max_length=20, choices=SOURCE_MODE_CHOICES, default="empty")
    formula_selections = models.JSONField(default=list, blank=True)
    generated_sections = models.JSONField(null=True, blank=True, default=None)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(schema_version=1), name="cheatsheet_schema_version_is_1"),
            models.CheckConstraint(condition=models.Q(revision__gte=1), name="cheatsheet_revision_gte_1"),
            models.CheckConstraint(condition=models.Q(source_mode__in=["empty", "generated", "raw"]), name="cheatsheet_source_mode_valid"),
            models.CheckConstraint(condition=models.Q(columns__range=(1, 5)), name="cheatsheet_columns_1_to_5"),
            models.CheckConstraint(condition=models.Q(orientation__in=["portrait", "landscape"]), name="cheatsheet_orientation_valid"),
        ]

    def __str__(self):
        return self.title

    @property
    def effective_source_mode(self):
        if self.source_mode == "empty" and self.latex_content.strip():
            return "generated" if self.content_source == "generated" else "raw"
        return self.source_mode

    def build_full_latex(self):
        """Compatibility API delegated to the rendering boundary."""
        problems = tuple(
            PracticeProblemSpec(problem.order, problem.question_latex, problem.answer_latex)
            for problem in self.problems.all()
        )
        return render_document(
            DocumentRenderRequest(
                source_latex=self.latex_content or "",
                source_mode=self.effective_source_mode,
                title=self.title,
                layout=LayoutSpec(self.columns, self.font_size, self.margins, self.spacing, self.orientation),
                practice_problems=problems,
            )
        )


class PracticeProblem(models.Model):
    cheat_sheet = models.ForeignKey(
        CheatSheet, on_delete=models.CASCADE, related_name="problems"
    )
    question_latex = models.TextField()
    answer_latex = models.TextField(blank=True, default="")
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Problem {self.order} - {self.cheat_sheet.title}"


class RequestThrottleWindow(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    window_start = models.PositiveBigIntegerField(db_index=True)
    count = models.PositiveIntegerField(default=0)


class CompileQuotaWindow(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="compile_quota_windows",
    )
    window_start = models.DateTimeField(db_index=True)
    count = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "window_start"],
                name="compile_quota_window_user_start_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(count__gte=1),
                name="compile_quota_window_count_positive",
            ),
        ]
