from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('search-products/', views.search_products, name='search_products'),
    path('validate-and-update-style/', views.validate_and_update_style, name='validate_and_update_style'),
]