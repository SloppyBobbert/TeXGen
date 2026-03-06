from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"templates", views.TemplateViewSet, basename="template")
router.register(r"cheatsheets", views.CheatSheetViewSet, basename="cheatsheet")
router.register(r"problems", views.PracticeProblemViewSet, basename="problem")

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    path("compile/", views.compile_latex, name="compile-latex"),
    path(
        "cheatsheets/from-template/",
        views.create_from_template,
        name="create-from-template",
    ),
    path("", include(router.urls)),
]
