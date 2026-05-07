# DRF serializers for the backend API will be added here.
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Template, CheatSheet, PracticeProblem


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
        read_only_fields = ["id", "user", "created_at", "updated_at", "full_latex"]

    def get_full_latex(self, obj):
        """Return the fully-assembled LaTeX document string."""
        return obj.build_full_latex()

    def validate(self, attrs):
        if "content_source" in attrs:
            return attrs

        current_content = getattr(self.instance, "latex_content", "")
        latex_content = attrs.get("latex_content", current_content) or ""

        if not latex_content.strip():
            attrs["content_source"] = "empty"
        else:
            attrs["content_source"] = "manual"
        return attrs


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
