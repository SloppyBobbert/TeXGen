# DRF serializers for the backend API will be added here.
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Template, CheatSheet, PracticeProblem
from .document_contract import DocumentContractSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['username'] = user.username
        return token


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'password')
        extra_kwargs = {'password': {'write_only': True}}

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user


class TemplateSerializer(DocumentContractSerializer):
    content_source = serializers.SerializerMethodField()
    columns = serializers.SerializerMethodField()
    font_size = serializers.SerializerMethodField()
    spacing = serializers.SerializerMethodField()
    margins = serializers.SerializerMethodField()
    orientation = serializers.SerializerMethodField()

    def get_content_source(self, obj):
        return self._legacy_mode(obj.source_mode)

    def get_columns(self, obj):
        return obj.default_columns

    def get_font_size(self, obj):
        return obj.default_font_size

    def get_spacing(self, obj):
        return obj.default_spacing

    def get_margins(self, obj):
        return obj.default_margins

    def get_orientation(self, obj):
        return obj.default_orientation

    class Meta:
        model = Template
        fields = [
            "id",
            "name",
            "subject",
            "description",
            "latex_content",
            "schema_version",
            "revision",
            "source_mode",
            "source_latex",
            "layout",
            "formula_selections",
            "content_source",
            "columns",
            "font_size",
            "spacing",
            "margins",
            "orientation",
            "default_margins",
            "default_columns",
            "default_font_size",
            "default_spacing",
            "default_orientation",
            "selected_formulas",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "source_latex", "layout", "content_source", "columns", "font_size", "spacing", "margins", "orientation"]


class PracticeProblemSerializer(serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            fields["cheat_sheet"].queryset = CheatSheet.objects.filter(user=request.user)
        else:
            fields["cheat_sheet"].queryset = CheatSheet.objects.none()
        return fields

    class Meta:
        model = PracticeProblem
        fields = [
            "id",
            "cheat_sheet",
            "question_latex",
            "answer_latex",
            "order",
        ]
        read_only_fields = ["id"]


class CheatSheetSerializer(DocumentContractSerializer):
    problems = PracticeProblemSerializer(many=True, read_only=True)
    full_latex = serializers.SerializerMethodField()
    template_id = serializers.PrimaryKeyRelatedField(
        source="template", queryset=Template.objects.all(), allow_null=True, required=False
    )

    def to_internal_value(self, data):
        data = data.copy()
        if "template_id" in data and "template" in data and data["template_id"] != data["template"]:
            raise serializers.ValidationError({"template_id": "Conflicts with template."})
        return super().to_internal_value(data)

    class Meta:
        model = CheatSheet
        fields = [
            "id",
            "title",
            "template_id",
            "template",
            "latex_content",
            "schema_version",
            "revision",
            "source_mode",
            "source_latex",
            "layout",
            "formula_selections",
            "content_source",
            "margins",
            "columns",
            "font_size",
            "spacing",
            "orientation",
            "selected_formulas",
            "problems",
            "full_latex",
            "user",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at", "full_latex", "source_latex", "layout"]

    def get_full_latex(self, obj):
        """Return the fully-assembled LaTeX document string."""
        return obj.build_full_latex()
