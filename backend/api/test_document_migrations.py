from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class DocumentPersistenceMigrationTests(TransactionTestCase):
    migrate_from = [("api", "0009_template_selected_formulas")]
    migrate_to = [("api", "0012_enforce_document_persistence")]

    def tearDown(self):
        MigrationExecutor(connection).migrate(self.migrate_to)
        super().tearDown()

    def test_backfill_preserves_layout_and_converts_ordered_formula_selections(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        Template = old_apps.get_model("api", "Template")
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        user = get_user_model().objects.create_user(username="migration-user")
        selections = [
            {
                "class": "ALGEBRA I",
                "category": "Linear Equations",
                "name": "Slope Formula",
            },
            {
                "class": "ALGEBRA I",
                "category": "Linear Equations",
                "name": "Slope-Intercept Form",
            },
        ]
        template = Template.objects.create(
            name="Legacy template",
            subject="algebra",
            latex_content="Template body",
            default_columns=3,
            default_margins="0.5in",
            selected_formulas=selections,
        )
        sheet = CheatSheet.objects.create(
            title="Legacy sheet",
            user_id=user.pk,
            latex_content="\\documentclass{article}\\begin{document}raw\\end{document}",
            content_source="manual",
            columns=2,
            margins="0.25in",
            font_size="10pt",
            spacing="tiny",
            orientation="landscape",
            selected_formulas=selections,
        )

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        apps = executor.loader.project_state(self.migrate_to).apps
        Template = apps.get_model("api", "Template")
        CheatSheet = apps.get_model("api", "CheatSheet")

        template = Template.objects.get(pk=template.pk)
        sheet = CheatSheet.objects.get(pk=sheet.pk)
        expected_selections = [
            {"formula_id": "algebra-i.slope-formula"},
            {"formula_id": "algebra-i.slope-intercept-form"},
        ]
        self.assertEqual(template.schema_version, 1)
        self.assertEqual(template.revision, 1)
        self.assertEqual(template.source_mode, "generated")
        self.assertEqual(template.formula_selections, expected_selections)
        self.assertEqual(template.default_columns, 3)
        self.assertEqual(template.default_margins, "0.5in")
        self.assertEqual(template.default_font_size, "9pt")
        self.assertEqual(template.default_spacing, "small")
        self.assertEqual(template.default_orientation, "portrait")
        self.assertEqual(sheet.schema_version, 1)
        self.assertEqual(sheet.revision, 1)
        self.assertEqual(sheet.source_mode, "raw")
        self.assertEqual(sheet.formula_selections, expected_selections)
        self.assertEqual(sheet.columns, 2)
        self.assertEqual(sheet.margins, "0.25in")
        self.assertEqual(sheet.font_size, "10pt")
        self.assertEqual(sheet.spacing, "tiny")
        self.assertEqual(sheet.orientation, "landscape")

    def test_backfill_infers_empty_generated_and_raw_modes_with_empty_selections(self):
        executor = MigrationExecutor(connection)
        executor = MigrationExecutor(connection)
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        Template = old_apps.get_model("api", "Template")
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        user = get_user_model().objects.create_user(username="mode-migration-user")
        empty_template = Template.objects.create(name="Empty", subject="math", latex_content="", selected_formulas=[])
        raw_template = Template.objects.create(name="Raw", subject="math", latex_content="Raw", selected_formulas=[])
        empty_sheet = CheatSheet.objects.create(title="Empty", user_id=user.pk, latex_content="", content_source="generated", selected_formulas=[])
        generated_sheet = CheatSheet.objects.create(title="Generated", user_id=user.pk, latex_content="Generated", content_source="generated", selected_formulas=[])

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        apps = executor.loader.project_state(self.migrate_to).apps
        Template = apps.get_model("api", "Template")
        CheatSheet = apps.get_model("api", "CheatSheet")

        self.assertEqual(Template.objects.get(pk=empty_template.pk).source_mode, "empty")
        self.assertEqual(Template.objects.get(pk=raw_template.pk).source_mode, "raw")
        self.assertEqual(CheatSheet.objects.get(pk=empty_sheet.pk).source_mode, "empty")
        generated_sheet = CheatSheet.objects.get(pk=generated_sheet.pk)
        self.assertEqual(generated_sheet.source_mode, "generated")
        self.assertEqual(generated_sheet.formula_selections, [])

    def test_backfill_rejects_unresolved_legacy_selection_with_row_id(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        user = get_user_model().objects.create_user(username="invalid-migration-user")
        sheet = CheatSheet.objects.create(
            title="Invalid",
            user_id=user.pk,
            latex_content="content",
            selected_formulas=[{"class": "NOPE", "category": "NOPE", "name": "NOPE"}],
        )

        with self.assertRaisesRegex(ValueError, rf"CheatSheet id={sheet.pk}: selection 0"):
            MigrationExecutor(connection).migrate(self.migrate_to)

        executor = MigrationExecutor(connection)
        executor.migrate([("api", "0010_expand_document_persistence")])
        apps = executor.loader.project_state([("api", "0010_expand_document_persistence")]).apps
        apps.get_model("api", "CheatSheet").objects.filter(pk=sheet.pk).delete()
        MigrationExecutor(connection).migrate(self.migrate_to)

    def test_backfill_preflights_all_invalid_layouts_without_partial_mutation(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        Template = old_apps.get_model("api", "Template")
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        user = get_user_model().objects.create_user(username="layout-migration-user")
        valid_sheet = CheatSheet.objects.create(title="Valid", user_id=user.pk, latex_content="content")
        bad_columns = CheatSheet.objects.create(title="Bad columns", user_id=user.pk, columns=6)
        bad_orientation = CheatSheet.objects.create(title="Bad orientation", user_id=user.pk, orientation="sideways")
        bad_template = Template.objects.create(name="Bad template", subject="math", latex_content="", default_columns=0)

        expected = (
            rf"CheatSheet id={bad_columns.pk} field=columns value=6.*"
            rf"CheatSheet id={bad_orientation.pk} field=orientation value='sideways'.*"
            rf"Template id={bad_template.pk} field=default_columns value=0"
        )
        with self.assertRaisesRegex(ValueError, expected):
            MigrationExecutor(connection).migrate(self.migrate_to)

        executor = MigrationExecutor(connection)
        executor.migrate([("api", "0010_expand_document_persistence")])
        apps = executor.loader.project_state([("api", "0010_expand_document_persistence")]).apps
        Template = apps.get_model("api", "Template")
        CheatSheet = apps.get_model("api", "CheatSheet")
        self.assertIsNone(CheatSheet.objects.get(pk=valid_sheet.pk).schema_version)
        self.assertIsNone(CheatSheet.objects.get(pk=valid_sheet.pk).formula_selections)

        CheatSheet.objects.filter(pk=bad_columns.pk).update(columns=4)
        CheatSheet.objects.filter(pk=bad_orientation.pk).update(orientation="portrait")
        Template.objects.filter(pk=bad_template.pk).update(default_columns=4)
        MigrationExecutor(connection).migrate(self.migrate_to)
        self.assertEqual(CheatSheet.objects.get(pk=valid_sheet.pk).schema_version, 1)

    def test_database_constraints_reject_invalid_persistence_values(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        apps = executor.loader.project_state(self.migrate_to).apps
        Template = apps.get_model("api", "Template")

        with self.assertRaises(IntegrityError):
            Template.objects.create(name="Bad schema", subject="math", latex_content="", schema_version=2)
        with self.assertRaises(IntegrityError):
            Template.objects.create(name="Bad mode", subject="math", latex_content="", source_mode="manual")
        with self.assertRaises(IntegrityError):
            Template.objects.create(name="Bad columns", subject="math", latex_content="", default_columns=0)
        with self.assertRaises(IntegrityError):
            Template.objects.create(name="Too many columns", subject="math", latex_content="", default_columns=6)
        with self.assertRaises(IntegrityError):
            Template.objects.create(name="Bad orientation", subject="math", latex_content="", default_orientation="sideways")

    def test_backfill_accepts_historical_category_alias_and_rejects_duplicate_resolution(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        user = get_user_model().objects.create_user(username="alias-migration-user")
        alias_sheet = CheatSheet.objects.create(
            title="Alias",
            user_id=user.pk,
            selected_formulas=[{"class": "ALGEBRA I", "category": "Historical rename", "name": "Slope Formula"}],
        )
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        apps = executor.loader.project_state(self.migrate_to).apps
        self.assertEqual(
            apps.get_model("api", "CheatSheet").objects.get(pk=alias_sheet.pk).formula_selections,
            [{"formula_id": "algebra-i.slope-formula"}],
        )

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        duplicate = CheatSheet.objects.create(
            title="Duplicate",
            user_id=user.pk,
            selected_formulas=[
                {"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"},
                {"class": "ALGEBRA I", "category": "Historical rename", "name": "Slope Formula"},
            ],
        )
        with self.assertRaisesRegex(ValueError, rf"CheatSheet id={duplicate.pk}: selection 1.*duplicate"):
            MigrationExecutor(connection).migrate(self.migrate_to)
        MigrationExecutor(connection).migrate([("api", "0010_expand_document_persistence")])
        apps = MigrationExecutor(connection).loader.project_state([("api", "0010_expand_document_persistence")]).apps
        apps.get_model("api", "CheatSheet").objects.filter(pk=duplicate.pk).delete()
        MigrationExecutor(connection).migrate(self.migrate_to)

    def test_backfill_aggregates_invalid_values_before_mutation(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        Template = old_apps.get_model("api", "Template")
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        user = get_user_model().objects.create_user(username="all-invalid-migration-user")
        valid_sheet = CheatSheet.objects.create(title="Valid", user_id=user.pk)
        sheet = CheatSheet.objects.create(
            title="Invalid", user_id=user.pk, columns=6, margins="3in", font_size="20pt", spacing="7pt",
            latex_content="é" * 131073,
        )
        template = Template.objects.create(name="Invalid", subject="math", latex_content="", default_columns=6, default_margins="3in")
        expected = (
            rf"CheatSheet id={sheet.pk} field=columns value=6.*"
            rf"CheatSheet id={sheet.pk} field=font_size value='20pt'.*"
            rf"CheatSheet id={sheet.pk} field=spacing value='7pt'.*"
            rf"CheatSheet id={sheet.pk} field=margins value='3in'.*"
            rf"CheatSheet id={sheet.pk} field=latex_content bytes=262146 exceeds 262144.*"
            rf"Template id={template.pk} field=default_columns value=6.*"
            rf"Template id={template.pk} field=default_margins value='3in'"
        )
        with self.assertRaisesRegex(ValueError, expected):
            MigrationExecutor(connection).migrate(self.migrate_to)
        executor = MigrationExecutor(connection)
        executor.migrate([("api", "0010_expand_document_persistence")])
        apps = executor.loader.project_state([("api", "0010_expand_document_persistence")]).apps
        self.assertIsNone(apps.get_model("api", "CheatSheet").objects.get(pk=valid_sheet.pk).schema_version)
        apps.get_model("api", "CheatSheet").objects.filter(pk=sheet.pk).delete()
        apps.get_model("api", "Template").objects.filter(pk=template.pk).delete()
        MigrationExecutor(connection).migrate(self.migrate_to)

    def test_downgrade_preserves_legacy_document_fields(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        Template = old_apps.get_model("api", "Template")
        CheatSheet = old_apps.get_model("api", "CheatSheet")
        user = get_user_model().objects.create_user(username="downgrade-migration-user")
        selections = [{"class": "ALGEBRA I", "category": "Linear Equations", "name": "Slope Formula"}]
        template = Template.objects.create(name="Template", subject="math", latex_content="template source", default_columns=3, default_margins="0.5in", selected_formulas=selections)
        sheet = CheatSheet.objects.create(title="Sheet", user_id=user.pk, latex_content="sheet source", content_source="manual", columns=2, margins="0.25in", font_size="10pt", spacing="tiny", orientation="landscape", selected_formulas=selections)
        executor.migrate(self.migrate_to)
        MigrationExecutor(connection).migrate(self.migrate_from)
        apps = MigrationExecutor(connection).loader.project_state(self.migrate_from).apps
        restored_template = apps.get_model("api", "Template").objects.get(pk=template.pk)
        restored_sheet = apps.get_model("api", "CheatSheet").objects.get(pk=sheet.pk)
        self.assertEqual((restored_template.latex_content, restored_template.selected_formulas, restored_template.default_columns, restored_template.default_margins), ("template source", selections, 3, "0.5in"))
        self.assertEqual((restored_sheet.latex_content, restored_sheet.content_source, restored_sheet.selected_formulas, restored_sheet.columns, restored_sheet.margins, restored_sheet.font_size, restored_sheet.spacing, restored_sheet.orientation), ("sheet source", "manual", selections, 2, "0.25in", "10pt", "tiny", "landscape"))
