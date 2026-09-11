from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_enforce_document_persistence"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompileQuotaWindow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("window_start", models.DateTimeField()),
                ("count", models.PositiveIntegerField()),
                ("user", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="compile_quota_windows", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name="compilequotawindow",
            constraint=models.UniqueConstraint(fields=("user", "window_start"), name="compile_quota_window_user_start_unique"),
        ),
        migrations.AddConstraint(
            model_name="compilequotawindow",
            constraint=models.CheckConstraint(condition=models.Q(("count__gte", 1)), name="compile_quota_window_count_positive"),
        ),
    ]
