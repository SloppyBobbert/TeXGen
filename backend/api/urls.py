from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    path("classes/", views.get_classes, name="get-classes"),
    path("generate-sheet/", views.generate_sheet, name="generate-sheet"),
    path("compile/", views.compile_latex, name="compile-latex"),
]
