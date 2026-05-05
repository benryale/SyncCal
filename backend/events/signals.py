"""
events/signals.py
-----------------
Push real-time WebSocket messages whenever an EventSeries or EventInvite changes.

Broadcast targets:
  EventSeries created/updated/deleted:
    → user_{organizer_id}          the organizer's own open tabs
    → friend_{friend_id}           every accepted friend's open tabs
                                   (so their overlay view refreshes)

  EventInvite created:
    → user_{invited_user_id}       the invitee's bell icon lights up immediately
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import EventSeries, EventInvite
from .visibility import accepted_friend_ids, entitled_viewer_ids, redact_event_dict



def _push(group: str, msg_type: str, payload: dict):
    """Fire-and-forget; never crashes the calling request."""
    try:
        cl = get_channel_layer()
        if cl is None:
            return
        async_to_sync(cl.group_send)(group, {'type': msg_type, 'payload': payload})
    except Exception:
        pass


def _serialize_event(ev: EventSeries) -> dict:
    """Minimal dict that Calendar.jsx can consume directly."""
    from events.zone_utils import add_duration_wallclock
    end = add_duration_wallclock(ev.dtstart, ev.duration, ev.timezone)
    return {
        'id': ev.id,
        'title': ev.title,
        'start_date': ev.dtstart.isoformat(),
        'end_date': end.isoformat() if hasattr(end, 'isoformat') else str(end),
        'timezone': ev.timezone,
        'location': ev.location,
        'description': ev.description,
        'priority': ev.priority,
        'organizer': ev.organizer.username,
        'organizer_id': ev.organizer_id,
        'color': getattr(ev, 'color', '#3B82F6') or '#3B82F6',
        'rrule': ev.rrule,
    }


def _broadcast_event(action: str, event: EventSeries):
    organizer_id = event.organizer_id
    full_data = _serialize_event(event)
    full_payload = {'type': 'calendar_event', 'action': action, 'event': full_data}
    _push(f"user_{organizer_id}", 'calendar.event.update', full_payload)
    try:
        redacted_data = redact_event_dict(dict(full_data))
        redacted_payload = {'type': 'calendar_event', 'action': action, 'event': redacted_data}
        entitled = entitled_viewer_ids(event)
        for fid in accepted_friend_ids(organizer_id):
            payload = full_payload if fid in entitled else redacted_payload
            _push(f"friend_{fid}", 'calendar.event.update', payload)
    except Exception:
        pass



@receiver(post_save, sender=EventSeries)
def on_event_series_saved(sender, instance: EventSeries, created: bool, **kwargs):
    action = 'created' if created else 'updated'
    _broadcast_event(action, instance)


@receiver(post_delete, sender=EventSeries)
def on_event_series_deleted(sender, instance: EventSeries, **kwargs):
    # delete payload carries no leakable fields
    payload = {
        'type': 'calendar_event',
        'action': 'deleted',
        'event': {'id': instance.id, 'organizer_id': instance.organizer_id},
    }
    _push(f"user_{instance.organizer_id}", 'calendar.event.update', payload)
    try:
        for fid in accepted_friend_ids(instance.organizer_id):
            _push(f"friend_{fid}", 'calendar.event.update', payload)
    except Exception:
        pass



@receiver(post_save, sender=EventInvite)
def on_invite_saved(sender, instance: EventInvite, created: bool, **kwargs):
    """
    When a new invite is created, push to the invitee so their bell updates.
    When an invite status changes (accepted/declined), push back to the organizer
    so their shared_with / attendance view is up-to-date.
    """
    from events.zone_utils import add_duration_wallclock
    ev = instance.event
    end = add_duration_wallclock(ev.dtstart, ev.duration, ev.timezone)

    invite_payload = {
        'type': 'invite',
        'action': 'created' if created else instance.status,
        'id': instance.id,
        'event_id': ev.id,
        'event_title': ev.title,
        'event_start': ev.dtstart.isoformat(),
        'event_end': end.isoformat() if hasattr(end, 'isoformat') else str(end),
        'organizer_username': ev.organizer.username,
        'invitee_username': instance.user.username,
        'status': instance.status,
    }

    if created:
        _push(f"user_{instance.user_id}", 'invite.update', invite_payload)
    else:
        _push(f"user_{ev.organizer_id}", 'invite.update', invite_payload)
        _push(f"user_{instance.user_id}", 'invite.update', invite_payload)
