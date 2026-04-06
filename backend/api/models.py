from django.db import models


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
    title = models.CharField(max_length=200)
    latex_content = models.TextField(blank=True, default="")
    template = models.ForeignKey(
        Template, on_delete=models.SET_NULL, null=True, blank=True
    )
    columns = models.IntegerField(default=2)
    margins = models.CharField(max_length=20, default="0.5in")
    font_size = models.CharField(max_length=10, default="10pt")
    # Stores selected formulas with user-defined order: [{"class": "...", "category": "...", "name": "..."}]
    selected_formulas = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
    
    def build_full_latex(self):
        """
        Build a complete LaTeX document from the cheat sheet's content.
        If the content already contains \\begin{document}, return it as-is.
        Otherwise, wrap it in a proper document structure.
        """
        content = self.latex_content or ""
        
        # If it's already a complete document, return as-is
        if r"\begin{document}" in content:
            return content
            
        # Build document header
        header = [
            "\\documentclass{article}",
            "\\usepackage[utf8]{inputenc}",
            "\\usepackage{amsmath, amssymb}",
            f"\\usepackage[a4paper, margin={self.margins}]{{geometry}}",
        ]
        
        # Add font size if specified
        if self.font_size and self.font_size != "10pt":
            header[0] = f"\\documentclass[{self.font_size}]{{article}}"
            
        # Add multicolumn support if needed
        if self.columns > 1:
            header.append("\\usepackage{multicol}")
            
        # Start document
        document_parts = header + ["\\begin{document}"]
        
        # Add title if exists
        if self.title:
            document_parts.append(f"\\title{{{self.title}}}")
            document_parts.append("\\maketitle")
            
        # Add multicolumn environment if needed
        if self.columns > 1:
            document_parts.append(f"\\begin{{multicols}}{{{self.columns}}}")
            
        # Add main content
        document_parts.append(content)
        
        # Add practice problems if they exist
        problems = self.problems.all()
        if problems:
            document_parts.append("\\section*{Practice Problems}")
            for problem in problems:
                document_parts.append(f"\\textbf{{Problem {problem.order}:}} {problem.question_latex}")
                if problem.answer_latex:
                    document_parts.append(f"\\textbf{{Answer:}} {problem.answer_latex}")
                document_parts.append("")  # Add spacing
        
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
