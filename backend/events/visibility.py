# event-level visibility helpers shared across views, serializers, and signals
from django.db.models import Q

from accounts.models import FriendRequest
from .models import EventInvite


def accepted_friend_ids(user_id):
    # set of user ids who have an accepted FriendRequest with `user_id`
    rows = FriendRequest.objects.filter(
        Q(from_user_id=user_id, status='accepted') |
        Q(to_user_id=user_id, status='accepted')
    ).values_list('from_user_id', 'to_user_id')
    ids = set()
    for fid, tid in rows:
        ids.add(tid if fid == user_id else fid)
    return ids


def user_can_see_event_details(user, event):
    # True iff `user` is organizer, in shared_with, or has an accepted invite
    if user is None or not user.is_authenticated:
        return False
    if event.organizer_id == user.id:
        return True
    if event.shared_with.filter(pk=user.id).exists():
        return True
    if EventInvite.objects.filter(event=event, user=user, status='accepted').exists():
        return True
    return False


def entitled_viewer_ids(event):
    # set of non-organizer user ids entitled to full details for this event
    shared_ids = set(event.shared_with.values_list('id', flat=True))
    accepted_ids = set(
        EventInvite.objects
            .filter(event=event, status='accepted')
            .values_list('user_id', flat=True)
    )
    return shared_ids | accepted_ids


# non-time fields blanked when recipient isn't entitled
REDACTED_FIELDS = (
    'title', 'description', 'location', 'priority',
    'rrule', 'shared_with', 'color', 'category',
    'created_at', 'updated_at',
)


def redact_event_dict(data):
    # in-place blank-out of non-time fields. Returns the same dict for chaining.
    for f in REDACTED_FIELDS:
        if f not in data:
            continue
        v = data[f]
        if isinstance(v, list):
            data[f] = []
        elif isinstance(v, str):
            data[f] = ''
        else:
            data[f] = None
    return data
