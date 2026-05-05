from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health),
    path('auth/register/', views.register),
    path('auth/login/', views.login_view),
    path('auth/change-password/', views.change_password),
    # must come before router or 'me' gets captured as pk
    path('users/me/', views.current_user),
    path('users/search/', views.search_users),
    path('friends/request/', views.send_friend_request),
    path('friends/request/<int:request_id>/respond/', views.respond_to_friend_request),
    path('friends/requests/', views.list_friend_requests),
    path('friends/', views.list_friends),
]
