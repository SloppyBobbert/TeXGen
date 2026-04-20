from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'templates', views.TemplateViewSet, basename='template')
router.register(r'cheatsheets', views.CheatSheetViewSet, basename='cheatsheet')
router.register(r'problems', views.PracticeProblemViewSet, basename='problem')

urlpatterns = [
    path('token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', views.RegisterView.as_view(), name='register'),
    
    path("health/", views.health_check, name="health-check"),
    path("classes/", views.get_classes, name="get-classes"),
    path("generate-sheet/", views.generate_sheet, name="generate-sheet"),
    path("compile/", views.compile_latex, name="compile-latex"),
    
    # Include the router URLs for CRUD operations
    path('', include(router.urls)),
]
