


#from django.contrib import admin
#from .models import Template, CheatSheet, PracticeProblem
#
#
#@admin.register(Template)
#class TemplateAdmin(admin.ModelAdmin):
#    list_display = ("name", "subject", "default_columns", "default_margins", "updated_at")
#    list_filter = ("subject",)
#    search_fields = ("name", "description")
#
#
#class PracticeProblemInline(admin.TabularInline):
#    model = PracticeProblem
#    extra = 1
#
#
#@admin.register(CheatSheet)
#class CheatSheetAdmin(admin.ModelAdmin):
#    list_display = ("title", "template", "columns", "margins", "font_size", "updated_at")
#    list_filter = ("template",)
#    search_fields = ("title",)
#    inlines = [PracticeProblemInline]
#
#
#@admin.register(PracticeProblem)
#class PracticeProblemAdmin(admin.ModelAdmin):
#    list_display = ("cheat_sheet", "order", "question_latex")
#    list_filter = ("cheat_sheet",)
