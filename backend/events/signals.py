"""
events/signals.py
-----------------
Broadcasts real-time calendar updates over WebSockets whenever an EventSeries
is created, updated, or deleted.

Broadcast strategy
==================
When user A saves an event we push to:
  1. user_{A.id}          – the creator's own open tabs
  2. friend_{friend_id}   – every accepted friend's open tabs
     (so their calendar reflects A's changes live)
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Q

from .models import EventSeries


def _serialize_event(event: EventSeries) -> dict:
    """Minimal serialization suitable for the frontend to consume directly."""
    end_dt = event.dtstart + event.duration
    return {
        "id": event.id,
        "title": event.title,
        "start_date": event.dtstart.isoformat(),
        "end_date": end_dt.isoformat(),
        "timezone": event.timezone,
        "location": event.location,
        "description": event.description,
        "priority": event.priority,
        "organizer": event.organizer.username,
        "organizer_id": event.organizer.id,
    }


def _broadcast(payload: dict, organizer_id: int):
    """
    Push *payload* to:
      • user_{organizer_id}     (the event owner's own sessions)
      • friend_{friend_id}      (each accepted friend, so their view updates)
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return  # channel layer not configured (e.g. test env without Redis)

    message = {"type": "calendar.event.update", "payload": payload}

    def send_group(group_name):
        try:
            async_to_sync(channel_layer.group_send)(group_name, message)
        except Exception:
            pass  # Redis unavailable – degrade gracefully, don't crash the request

    # Push to organizer's own sessions
    send_group(f"user_{organizer_id}")

    # Push to every accepted friend's listener group
    try:
        from api.models import FriendRequest

        friend_ids = FriendRequest.objects.filter(
            Q(from_user_id=organizer_id, status="accepted")
            | Q(to_user_id=organizer_id, status="accepted")
        ).values_list("from_user_id", "to_user_id")

        seen = set()
        for from_id, to_id in friend_ids:
            fid = to_id if from_id == organizer_id else from_id
            if fid not in seen:
                seen.add(fid)
                send_group(f"friend_{fid}")
    except Exception:
        pass  # non-critical; don't break the save


@receiver(post_save, sender=EventSeries)
def on_event_saved(sender, instance: EventSeries, created: bool, **kwargs):
    action = "created" if created else "updated"
    payload = {
        "action": action,
        "event": _serialize_event(instance),
    }
    _broadcast(payload, instance.organizer_id)


@receiver(post_delete, sender=EventSeries)
def on_event_deleted(sender, instance: EventSeries, **kwargs):
    payload = {
        "action": "deleted",
        "event": {
            "id": instance.id,
            "organizer_id": instance.organizer_id,
        },
    }
    _broadcast(payload, instance.organizer_id)
