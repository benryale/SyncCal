from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health),
    path('auth/register/', views.register),
    path('auth/login/', views.login_view),
]