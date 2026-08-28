from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_template_selected_formulas"),
    ]

    operations = [
        migrations.AddField(
            model_name="cheatsheet",
            name="schema_version",
            field=models.PositiveBigIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="cheatsheet",
            name="revision",
            field=models.PositiveBigIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="cheatsheet",
            name="source_mode",
            field=models.CharField(max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="cheatsheet",
            name="formula_selections",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="template",
            name="schema_version",
            field=models.PositiveIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="template",
            name="revision",
            field=models.PositiveIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="template",
            name="source_mode",
            field=models.CharField(max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="template",
            name="formula_selections",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="template",
            name="default_font_size",
            field=models.CharField(max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="template",
            name="default_spacing",
            field=models.CharField(max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="template",
            name="default_orientation",
            field=models.CharField(max_length=20, null=True),
        ),
    ]
