"""
api/signals.py
--------------
Signals for the 'api' app.

1. Auto-create UserProfile when a User is first created.
2. Push real-time WebSocket notifications when a FriendRequest is saved,
   so the recipient's browser updates immediately without polling.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile, FriendRequest


# ── existing: create profile on user creation ────────────────────────────── #

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


# ── new: push friend-request notifications over WebSocket ────────────────── #

def _push(group: str, payload: dict):
    """Fire-and-forget group_send; silently swallows errors (Redis may be down)."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(group, {
            'type': 'friend.request.update',
            'payload': payload,
        })
    except Exception:
        pass  # never let a WebSocket failure break the HTTP request


@receiver(post_save, sender=FriendRequest)
def on_friend_request_saved(sender, instance: FriendRequest, created: bool, **kwargs):
    """
    Push to both users whenever a FriendRequest row changes.

    - created=True  → new request  → notify the *recipient* (to_user)
    - status=accepted/declined → notify the *sender* (from_user) so their
      search results / friend list update live
    """
    payload_base = {
        'type': 'friend_request',   # discriminator on the frontend
        'action': 'created' if created else instance.status,
        'id': instance.id,
        'from_user_id': instance.from_user_id,
        'from_username': instance.from_user.username,
        'to_user_id': instance.to_user_id,
        'to_username': instance.to_user.username,
        'status': instance.status,
    }

    if created:
        # A new request arrived – push to the recipient so their bell lights up
        _push(f"user_{instance.to_user_id}", payload_base)
    else:
        # Status changed (accepted/declined) – push to the sender so they know
        _push(f"user_{instance.from_user_id}", payload_base)
        # Also push to recipient so their requests tab refreshes
        _push(f"user_{instance.to_user_id}", payload_base)
