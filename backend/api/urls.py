from django.urls import path, include
from . import views as api_views
from rest_framework.routers import DefaultRouter
from events import views as event_views
#setup api router
router = DefaultRouter()
router.register(r'categories',event_views.CategoryViewSet)
router.register(r'events',event_views.EventViewSet)
urlpatterns = [
    path('health/', api_views.health),
    path('auth/register/', api_views.register),
    path('auth/login/', api_views.login_view),
    path('users/search/', api_views.search_users),
    path('friends/request/', api_views.send_friend_request),
    path('',include(router.urls)), # This gives React access to GET, POST, PUT/DELETE /api/events
]