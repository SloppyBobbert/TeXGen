from django.db import migrations, models


SOURCE_MODE_CHOICES = [
    ("empty", "Empty"),
    ("generated", "Generated"),
    ("raw", "Raw"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0011_backfill_document_persistence"),
    ]

    operations = [
        migrations.AlterField(model_name="template", name="default_columns", field=models.IntegerField(default=4)),
        migrations.AlterField(model_name="template", name="default_margins", field=models.CharField(default="0.15in", max_length=20)),
        migrations.AlterField(model_name="cheatsheet", name="schema_version", field=models.PositiveIntegerField(default=1)),
        migrations.AlterField(model_name="cheatsheet", name="revision", field=models.PositiveBigIntegerField(default=1)),
        migrations.AlterField(model_name="cheatsheet", name="source_mode", field=models.CharField(choices=SOURCE_MODE_CHOICES, default="empty", max_length=20)),
        migrations.AlterField(model_name="cheatsheet", name="formula_selections", field=models.JSONField(blank=True, default=list)),
        migrations.AlterField(model_name="template", name="schema_version", field=models.PositiveIntegerField(default=1)),
        migrations.AlterField(model_name="template", name="revision", field=models.PositiveBigIntegerField(default=1)),
        migrations.AlterField(model_name="template", name="source_mode", field=models.CharField(choices=SOURCE_MODE_CHOICES, default="empty", max_length=20)),
        migrations.AlterField(model_name="template", name="formula_selections", field=models.JSONField(blank=True, default=list)),
        migrations.AlterField(model_name="template", name="default_font_size", field=models.CharField(default="9pt", max_length=10)),
        migrations.AlterField(model_name="template", name="default_spacing", field=models.CharField(default="small", max_length=10)),
        migrations.AlterField(model_name="template", name="default_orientation", field=models.CharField(default="portrait", max_length=20)),
        migrations.AddConstraint(
            model_name="cheatsheet",
            constraint=models.CheckConstraint(condition=models.Q(schema_version=1), name="cheatsheet_schema_version_is_1"),
        ),
        migrations.AddConstraint(
            model_name="cheatsheet",
            constraint=models.CheckConstraint(condition=models.Q(revision__gte=1), name="cheatsheet_revision_gte_1"),
        ),
        migrations.AddConstraint(model_name="cheatsheet", constraint=models.CheckConstraint(condition=models.Q(source_mode__in=["empty", "generated", "raw"]), name="cheatsheet_source_mode_valid")),
        migrations.AddConstraint(model_name="cheatsheet", constraint=models.CheckConstraint(condition=models.Q(columns__range=(1, 5)), name="cheatsheet_columns_1_to_5")),
        migrations.AddConstraint(model_name="cheatsheet", constraint=models.CheckConstraint(condition=models.Q(orientation__in=["portrait", "landscape"]), name="cheatsheet_orientation_valid")),
        migrations.AddConstraint(
            model_name="template",
            constraint=models.CheckConstraint(condition=models.Q(schema_version=1), name="template_schema_version_is_1"),
        ),
        migrations.AddConstraint(
            model_name="template",
            constraint=models.CheckConstraint(condition=models.Q(revision__gte=1), name="template_revision_gte_1"),
        ),
        migrations.AddConstraint(model_name="template", constraint=models.CheckConstraint(condition=models.Q(source_mode__in=["empty", "generated", "raw"]), name="template_source_mode_valid")),
        migrations.AddConstraint(model_name="template", constraint=models.CheckConstraint(condition=models.Q(default_columns__range=(1, 5)), name="template_default_columns_1_to_5")),
        migrations.AddConstraint(model_name="template", constraint=models.CheckConstraint(condition=models.Q(default_orientation__in=["portrait", "landscape"]), name="template_default_orientation_valid")),
    ]
