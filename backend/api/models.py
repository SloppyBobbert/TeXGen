from django.db import models


class Template(models.Model):
    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    latex_content = models.TextField()
    columns = models.IntegerField(default=2)
    margin = models.CharField(max_length=20, default="0.5in")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CheatSheet(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True, default="")
    template = models.ForeignKey(
        Template, on_delete=models.SET_NULL, null=True, blank=True
    )
    columns = models.IntegerField(default=2)
    margin = models.CharField(max_length=20, default="0.5in")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class PracticeProblem(models.Model):
    cheat_sheet = models.ForeignKey(
        CheatSheet, on_delete=models.CASCADE, related_name="problems"
    )
    question = models.TextField()
    answer = models.TextField(blank=True, default="")
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Problem {self.order} - {self.cheat_sheet.title}"
