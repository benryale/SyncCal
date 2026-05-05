from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'events', views.EventSeriesViewSet, basename='event')

urlpatterns = [
    # event invite endpoints
    path('events/invites/', views.list_event_invites),
    path('events/invites/send/', views.send_event_invite),
    path('events/invites/<int:invite_id>/respond/', views.respond_to_event_invite),
    # range/ must come before <recurrence_id>/ or it captures 'range'
    path('events/<int:series_id>/occurrences/range/', views.edit_occurrence_range),
    path('events/<int:series_id>/occurrences/<str:recurrence_id>/cancel/', views.cancel_occurrence),
    path('events/<int:series_id>/occurrences/<str:recurrence_id>/', views.edit_occurrence),
    path('events/<int:series_id>/split/', views.split_series),
    path('', include(router.urls)),
]
