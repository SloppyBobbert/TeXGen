# DRF serializers for the backend API will be added here.
from rest_framework import serializers
from .models import Template, CheatSheet, PracticeProblem


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = [
            "id",
            "name",
            "subject",
            "description",
            "latex_content",
            "default_margins",
            "default_columns",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PracticeProblemSerializer(serializers.ModelSerializer):
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


class CheatSheetSerializer(serializers.ModelSerializer):
    problems = PracticeProblemSerializer(many=True, read_only=True)
    full_latex = serializers.SerializerMethodField()

    class Meta:
        model = CheatSheet
        fields = [
            "id",
            "title",
            "template",
            "latex_content",
            "margins",
            "columns",
            "font_size",
            "selected_formulas",
            "problems",
            "full_latex",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "full_latex"]

    def get_full_latex(self, obj):
        """Return the fully-assembled LaTeX document string."""
        return obj.build_full_latex()


class CompileRequestSerializer(serializers.Serializer):
    """Accepts either raw content OR a cheat_sheet id to compile."""

    content = serializers.CharField(required=False, default="")
    cheat_sheet_id = serializers.IntegerField(required=False, default=None)

    def validate(self, data):
        if not data.get("content") and not data.get("cheat_sheet_id"):
            raise serializers.ValidationError(
                "Provide either 'content' or 'cheat_sheet_id'."
            )
        return data
