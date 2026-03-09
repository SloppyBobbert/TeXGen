from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    path("classes/", views.get_classes, name="get-classes"),
    path("generate-sheet/", views.generate_sheet, name="generate-sheet"),
    path("compile/", views.compile_latex, name="compile-latex"),
    
    # CRUD endpoints
    path("templates/", views.template_list, name="template-list"),
    path("templates/<int:pk>/", views.template_detail, name="template-detail"),
    path("cheatsheets/", views.cheatsheet_list, name="cheatsheet-list"),
    path("cheatsheets/from-template/", views.cheatsheet_from_template, name="cheatsheet-from-template"),
    path("cheatsheets/<int:pk>/", views.cheatsheet_detail, name="cheatsheet-detail"),
    path("problems/", views.problem_list, name="problem-list"),
    path("problems/<int:pk>/", views.problem_detail, name="problem-detail"),
]
