from django.urls import path, include
from . import views as api_views
from rest_framework.routers import DefaultRouter
from events import views as event_views
#setup api router
router = DefaultRouter()
router.register(r'categories',event_views.CategoryViewSet)
router.register(r'events',event_views.EventSeriesViewSet, basename='event') # We need to specify basename here because we have a custom get_queryset method in our EventSeriesViewSet that filters events based on the logged in user, so we can't rely on the default queryset to determine the basename for the router. By explicitly setting basename='event', we ensure that the router generates the correct URL patterns for our EventSeriesViewSet.
urlpatterns = [
    path('health/', api_views.health),
    path('auth/register/', api_views.register),
    path('auth/login/', api_views.login_view),
    path('auth/change-password/', api_views.change_password),
    # must come before router or 'me' gets captured as pk
    path('users/me/', api_views.current_user),
    path('users/search/', api_views.search_users),
    path('friends/request/', api_views.send_friend_request),
    path('friends/request/<int:request_id>/respond/', api_views.respond_to_friend_request),
    path('friends/requests/', api_views.list_friend_requests),
    path('friends/', api_views.list_friends),
    # event invite endpoints
    path('events/invites/', event_views.list_event_invites),
    path('events/invites/send/', event_views.send_event_invite),
    path('events/invites/<int:invite_id>/respond/', event_views.respond_to_event_invite),
    # range/ must come before <recurrence_id>/ or it captures 'range'
    path('events/<int:series_id>/occurrences/range/', event_views.edit_occurrence_range),
    path('events/<int:series_id>/occurrences/<str:recurrence_id>/cancel/', event_views.cancel_occurrence),
    path('events/<int:series_id>/occurrences/<str:recurrence_id>/', event_views.edit_occurrence),
    # series split
    path('events/<int:series_id>/split/', event_views.split_series),
    path('',include(router.urls)), # This gives React access to GET, POST, PUT/DELETE /api/events
]