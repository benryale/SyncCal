from django.urls import path, include
from . import views as api_views
from rest_framework.routers import DefaultRouter
from events import views as event_views
#setup api router
router = DefaultRouter()
router.register(r'categories',event_views.CategoryViewSet)
router.register(r'events',event_views.EventViewSet, basename='event') # We need to specify basename here because we have a custom get_queryset method in our EventViewSet that filters events based on the logged in user, so we can't rely on the default queryset to determine the basename for the router. By explicitly setting basename='event', we ensure that the router generates the correct URL patterns for our EventViewSet.
urlpatterns = [
    path('health/', api_views.health),
    path('auth/register/', api_views.register),
    path('auth/login/', api_views.login_view),
    path('users/search/', api_views.search_users),
    path('friends/request/', api_views.send_friend_request),
    path('friends/request/<int:request_id>/respond/', api_views.respond_to_friend_request),
    path('friends/requests/', api_views.list_friend_requests),
    path('friends/', api_views.list_friends),
    # event invite endpoints
    path('events/invites/', event_views.list_event_invites),
    path('events/invites/send/', event_views.send_event_invite),
    path('events/invites/<int:invite_id>/respond/', event_views.respond_to_event_invite),
    path('',include(router.urls)), # This gives React access to GET, POST, PUT/DELETE /api/events
]