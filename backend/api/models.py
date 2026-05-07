from django.conf import settings
from django.db import models

from .latex_utils import get_body_font_command, get_document_class, get_spacing_values

class Template(models.Model):
    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    latex_content = models.TextField()
    default_columns = models.IntegerField(default=2)
    default_margins = models.CharField(max_length=20, default="0.5in")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class CheatSheet(models.Model):
    CONTENT_SOURCE_CHOICES = [
        ("empty", "Empty"),
        ("generated", "Generated"),
        ("manual", "Manual"),
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def _build_practice_problems_section(self):
        problems = list(self.problems.all())
        if not problems:
            return ""

        section_lines = [r"\noindent Practice Problems\par"]
        for problem in problems:
            section_lines.append(
                f"Problem {problem.order}: {problem.question_latex}"
            )
            if problem.answer_latex:
                section_lines.append(f"Answer: {problem.answer_latex}")
            section_lines.append("")

        return "\n".join(section_lines).rstrip()

    def _inject_practice_problems_into_document(self, content):
        practice_problems = self._build_practice_problems_section()
        if not practice_problems:
            return content

        end_document = r"\end{document}"
        end_multicols = r"\end{multicols}"

        insert_before = end_document
        if end_multicols in content and content.rfind(end_multicols) < content.rfind(end_document):
            insert_before = end_multicols

        insert_index = content.rfind(insert_before)
        if insert_index == -1:
            return content

        return (
            f"{content[:insert_index].rstrip()}\n\n"
            f"{practice_problems}\n"
            f"{content[insert_index:]}"
        )
    
    def build_full_latex(self):
        """
        Build a complete LaTeX document from the cheat sheet's content.
        If the content already contains \\begin{document}, return it as-is.
        Otherwise, wrap it in a proper document structure.
        """
        content = self.latex_content or ""
        
        # If it's already a complete document, keep its layout and inject problems if needed
        if r"\begin{document}" in content and r"\end{document}" in content:
            return self._inject_practice_problems_into_document(content)
            
        # Build document header
        document_class, document_class_size = get_document_class(self.font_size)
        spacing_values = get_spacing_values(self.spacing, self.font_size)

        doc_options = f"{document_class_size},fleqn,letterpaper"
        if self.orientation == "landscape":
            doc_options += ",landscape"

        geometry_options = f"letterpaper,margin={self.margins}"
        if self.orientation == "landscape":
            geometry_options += ",landscape"

        header = [
            f"\\documentclass[{doc_options}]{{{document_class}}}",
            "\\usepackage[utf8]{inputenc}",
            "\\usepackage{amsmath, amssymb}",
            "\\usepackage{adjustbox}",
            f"\\usepackage[{geometry_options}]{{geometry}}",
            f"\\setlength{{\\baselineskip}}{{{spacing_values['baseline_skip']}}}",
            f"\\setlength{{\\parskip}}{{{spacing_values['paragraph_skip']}}}",
        ]
            
        # Add multicolumn support if needed
        if self.columns > 1:
            header.append("\\usepackage{multicol}")
            
        # Start document
        document_parts = header + ["\\begin{document}", get_body_font_command(self.font_size)]
        
        # Add title if exists
        if self.title:
            document_parts.append(f"\\title{{{self.title}}}")
            document_parts.append("\\maketitle")
            
        # Add multicolumn environment if needed
        if self.columns > 1:
            document_parts.append(f"\\begin{{multicols}}{{{self.columns}}}")
            
        # Add main content
        document_parts.append(content)
        
        practice_problems = self._build_practice_problems_section()
        if practice_problems:
            document_parts.append(practice_problems)
        
        # Close multicolumn environment if needed
        if self.columns > 1:
            document_parts.append("\\end{multicols}")
            
        # End document
        document_parts.append("\\end{document}")
        
        return "\n".join(document_parts)


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
