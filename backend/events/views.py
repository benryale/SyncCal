# django imports
import re
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
# rest framework imports
from rest_framework.authtoken.models import Token
from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth.models import User
# local imports
from .merge import (
    COLLISION_FIELDS,
    bulk_edit_sets_field,
    clear_override_field,
    override_has_field,
    override_is_empty,
    override_value_for_field,
)
from .models import EventSeries, Category, EventInvite, EventOccurrenceOverride
from .serializers import EventSeriesSerializer, CategorySerializer, EventInviteSerializer
from .zone_utils import add_duration_wallclock
from api.models import FriendRequest


# body key → override column
_OVERRIDE_FIELD_MAP = {
    'start':       'start_override',
    'end':         'end_override',
    'title':       'title_override',
    'description': 'description_override',
    'location':    'location_override',
    'priority':    'priority_override',
}


def _parse_rid(value):
    dt = parse_datetime(str(value))
    if dt is None:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt


def _fmt_until(dt):
    return dt.strftime('%Y%m%dT%H%M%SZ')


def _serialize_value(v):
    return tuple(x.isoformat() if hasattr(x, 'isoformat') else x for x in v)


def _write_override_field(ov, field, v_b):
    # symmetric counterpart to merge.clear_override_field
    if field == 'time':
        ov.start_override, ov.end_override = v_b
    elif field == 'title':
        ov.title_override = v_b[0]
    elif field == 'description':
        ov.description_override = v_b[0]
    elif field == 'location':
        ov.location_override = v_b[0]
    elif field == 'priority':
        ov.priority_override = v_b[0]


# handles all category CRUD (create, read, update, delete)
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


# handles all event CRUD with permission filtering
class EventSeriesViewSet(viewsets.ModelViewSet):
    serializer_class = EventSeriesSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # if user is anonymous, return empty queryset
        if user.is_anonymous:
            return EventSeries.objects.none()
        #check if react is asking for friends calenar
        owner_ids = self.request.query_params.get('owner_id__in')
        if owner_ids:
            #convert string of ids into list of ints
            owner_ids = [int(id) for id in owner_ids.split(',') if id.isdigit()]
            #return the events where organizer is in the list of owner_ids
            return EventSeries.objects.filter(organizer_id__in = owner_ids)
        #if no friend is selected, just return events of the logged in user
        accepted_event_ids = EventInvite.objects.filter(
            user = user,
            status = 'accepted'
        ).values_list('event_id', flat=True)
        return EventSeries.objects.filter(Q(organizer=user) | Q(id__in=accepted_event_ids)).distinct()


    def perform_create(self, serializer):
        # default tz to organizer preference unless payload sent one
        extra = {'organizer': self.request.user}
        if 'timezone' not in serializer.validated_data:
            profile = getattr(self.request.user, 'profile', None)
            extra['timezone'] = profile.timezone if profile is not None else 'UTC'
        serializer.save(**extra)



    def perform_update(self, serializer):
        serializer.save()


# send an invite for an event to a friend
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_event_invite(request):
    """This function allows the organizer of an event to invite a friend to that event.
    It checks that the invited user is actually a friend and that the event exists and is organized by the logged-in user."""
    event_id = request.data.get('event_id')
    username = request.data.get('username')

    if not event_id or not username:
        return Response({'error': 'event_id and username are required'}, status=status.HTTP_400_BAD_REQUEST)

    #retieve the user being invited and check that they exist. 
    try:
        invited_user = User.objects.get(username=username)
        user_id = invited_user.id
    except User.DoesNotExist:
        return Response({'error':f'User "{username}" is not found'}, status=status.HTTP_404_NOT_FOUND)
    #get the event and check logged in user is the organizer
    try:
        event = EventSeries.objects.get(id=event_id, organizer=request.user)
    except EventSeries.DoesNotExist:
        return Response({'error': 'Event not found or you are not the organizer'}, status=status.HTTP_404_NOT_FOUND)

    #Check that the person being invited is actually a friend
    is_friend = FriendRequest.objects.filter(
        (Q(from_user=request.user, to_user_id=user_id) | Q(from_user_id=user_id, to_user=request.user)),
        status='accepted'
    ).exists()

    if not is_friend:
        return Response({'error': 'You can only invite your friends to events'}, status=status.HTTP_403_FORBIDDEN)

    # Create the invite
    invite, created = EventInvite.objects.get_or_create(
        event=event,
        user_id=user_id,
        defaults={'status': 'pending'}
    )

    if not created:
        return Response({'error': 'This user has already been invited to this event'}, status=status.HTTP_400_BAD_REQUEST)

    return Response(EventInviteSerializer(invite).data, status=status.HTTP_201_CREATED)

# accept or decline an event invite
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def respond_to_event_invite(request, invite_id):
    response_status = request.data.get('status')

    if response_status not in ['accepted', 'declined']:
        return Response({'error': 'Status must be accepted or declined'}, status=status.HTTP_400_BAD_REQUEST)

    # only the person who was invited can respond
    try:
        invite = EventInvite.objects.get(id=invite_id, user=request.user)
    except EventInvite.DoesNotExist:
        return Response({'error': 'Invite not found'}, status=status.HTTP_404_NOT_FOUND)

    invite.status = response_status
    invite.save()

    return Response(EventInviteSerializer(invite).data)


# get all pending invites for the logged in user
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_event_invites(request):
    invites = EventInvite.objects.filter(user=request.user).select_related('event', 'user')
    serializer = EventInviteSerializer(invites, many=True)
    return Response(serializer.data)


# cancel single occurrence, clear override fields, idempotent
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_occurrence(request, series_id, recurrence_id):
    """this function allows the organizer of an event to cancel a single occurence of a recurring event series. """
    series = get_object_or_404(EventSeries, id=series_id)
    if series.organizer != request.user:
        return Response({'error': 'Only the organizer can modify occurrences'}, status=status.HTTP_403_FORBIDDEN)

    rid = _parse_rid(recurrence_id)
    if rid is None:
        return Response({'error': 'Invalid recurrence_id — expected ISO 8601 UTC datetime'}, status=status.HTTP_400_BAD_REQUEST)

    EventOccurrenceOverride.objects.update_or_create(
        series=series,
        recurrence_id=rid,
        defaults={
            'is_cancelled':       True,
            'title_override':     None,
            'start_override':     None,
            'end_override':       None,
            'priority_override':  None,
            'description_override': None,
            'location_override':  None,
        },
    )
    return Response({'series_id': series_id, 'recurrence_id': rid.isoformat(), 'is_cancelled': True})


# edit single occurrence, upserts override
@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def edit_occurrence(request, series_id, recurrence_id):
    """this function allows organizer of an event to edit a single occurence of a recurring event series. """
    series = get_object_or_404(EventSeries, id=series_id)
    if series.organizer != request.user:
        return Response({'error': 'Only the organizer can modify occurrences'}, status=status.HTTP_403_FORBIDDEN)

    rid = _parse_rid(recurrence_id)
    if rid is None:
        return Response({'error': 'Invalid recurrence_id — expected ISO 8601 UTC datetime'}, status=status.HTTP_400_BAD_REQUEST)

    defaults = {'is_cancelled': False}

    for key, col in _OVERRIDE_FIELD_MAP.items():
        if key not in request.data:
            continue
        val = request.data[key]
        if key in ('start', 'end'):
            dt = _parse_rid(val) if val else None
            if val and dt is None:
                return Response({'error': f'{key} must be an ISO 8601 UTC datetime'}, status=status.HTTP_400_BAD_REQUEST)
            defaults[col] = dt
        elif key == 'priority':
            try:
                defaults[col] = int(val)
            except (TypeError, ValueError):
                return Response({'error': 'priority must be an integer'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            defaults[col] = val

    override, _ = EventOccurrenceOverride.objects.update_or_create(
        series=series,
        recurrence_id=rid,
        defaults=defaults,
    )
    return Response({
        'series_id':    series_id,
        'recurrence_id': rid.isoformat(),
        'is_cancelled': override.is_cancelled,
        'updated_fields': [k for k in defaults if k != 'is_cancelled'],
    })


# bulk-edit occurrences by explicit recurrence_id list
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def edit_occurrence_range(request, series_id):
    series = get_object_or_404(EventSeries, id=series_id)
    if series.organizer != request.user:
        return Response({'error': 'Only the organizer can modify occurrences'}, status=status.HTTP_403_FORBIDDEN)

    recurrence_ids = request.data.get('recurrence_ids')
    fields         = request.data.get('fields', {})

    if not recurrence_ids or not isinstance(recurrence_ids, list):
        return Response({'error': 'recurrence_ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
    if not fields or not isinstance(fields, dict):
        return Response({'error': 'fields must be a non-empty object'}, status=status.HTTP_400_BAD_REQUEST)

    parsed_rids = []
    for raw in recurrence_ids:
        rid = _parse_rid(raw)
        if rid is None:
            return Response({'error': f'{raw!r} is not a valid recurrence_id'}, status=status.HTTP_400_BAD_REQUEST)
        parsed_rids.append(rid)

    # payload keys → U4 collision field values
    parsed_values = {}
    if 'start' in fields or 'end' in fields:
        start_raw = fields.get('start')
        end_raw   = fields.get('end')
        start_dt = _parse_rid(start_raw) if start_raw else None
        if start_raw and start_dt is None:
            return Response({'error': 'fields.start must be an ISO 8601 UTC datetime'}, status=status.HTTP_400_BAD_REQUEST)
        end_dt = _parse_rid(end_raw) if end_raw else None
        if end_raw and end_dt is None:
            return Response({'error': 'fields.end must be an ISO 8601 UTC datetime'}, status=status.HTTP_400_BAD_REQUEST)
        parsed_values['time'] = (start_dt, end_dt)
    for key in ('title', 'description', 'location'):
        if key in fields:
            parsed_values[key] = (fields[key],)
    if 'priority' in fields:
        try:
            parsed_values['priority'] = (int(fields['priority']),)
        except (TypeError, ValueError):
            return Response({'error': 'fields.priority must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    changed_fields = [f for f in COLLISION_FIELDS if f in parsed_values]
    if not changed_fields:
        return Response(
            {'error': 'fields must contain at least one of: start, end, title, description, location, priority'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    applied = []
    pending_conflicts = []
    with transaction.atomic():
        existing = {
            ov.recurrence_id: ov
            for ov in EventOccurrenceOverride.objects
                .select_for_update()
                .filter(series=series, recurrence_id__in=parsed_rids)
        }

        for rid in parsed_rids:
            ov = existing.get(rid)
            created = ov is None
            if created:
                ov = EventOccurrenceOverride(series=series, recurrence_id=rid, is_cancelled=False)

            if ov.is_cancelled:
                continue

            any_applied = False
            for field in changed_fields:
                V_B = parsed_values[field]
                if created or not override_has_field(ov, field):
                    _write_override_field(ov, field, V_B)
                    any_applied = True
                    continue
                V_O = override_value_for_field(ov, field)
                if V_O == V_B:
                    clear_override_field(ov, field)
                    any_applied = True
                else:
                    pending_conflicts.append({
                        'series_id':      series.id,
                        'recurrence_id':  rid.isoformat(),
                        'field':          field,
                        'override_value': _serialize_value(V_O),
                        'proposed_value': _serialize_value(V_B),
                    })

            if override_is_empty(ov):
                if not created:
                    ov.delete()
            else:
                ov.save()

            if any_applied:
                applied.append(rid.isoformat())

    return Response({'applied': applied, 'pending_conflicts': pending_conflicts})


# split series at R; tail becomes new series
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def split_series(request, series_id):
    recurrence_id_raw = request.data.get('recurrence_id')
    r_minus_one_raw   = request.data.get('r_minus_one')
    fields            = request.data.get('fields', {})

    if not recurrence_id_raw:
        return Response({'error': 'recurrence_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not r_minus_one_raw:
        return Response(
            {'error': 'r_minus_one is required — provide the last recurrence_id strictly before the split point'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    R = _parse_rid(recurrence_id_raw)
    if R is None:
        return Response({'error': 'recurrence_id is not a valid ISO 8601 datetime'}, status=status.HTTP_400_BAD_REQUEST)

    r_minus_one = _parse_rid(r_minus_one_raw)
    if r_minus_one is None:
        return Response({'error': 'r_minus_one is not a valid ISO 8601 datetime'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        series = get_object_or_404(EventSeries, id=series_id)
        if series.organizer != request.user:
            return Response({'error': 'Only the organizer can split a series'}, status=status.HTTP_403_FORBIDDEN)

        if not series.rrule or 'UNTIL=' not in series.rrule:
            return Response(
                {'error': 'Series has no RRULE or UNTIL= — cannot split a non-recurring or unbounded series'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # snapshot template before mutation
        old_template = {
            'title':       series.title,
            'description': series.description,
            'location':    series.location,
            'priority':    series.priority,
            'dtstart':     series.dtstart,
            'timezone':    series.timezone,
            'duration':    series.duration,
        }
        new_template = dict(old_template)
        for k in ('title', 'description', 'location', 'priority'):
            if k in fields:
                new_template[k] = fields[k]

        changed_fields = [
            f for f in COLLISION_FIELDS
            if bulk_edit_sets_field(old_template, new_template, f)
        ]

        original_rrule = series.rrule
        series.rrule = re.sub(r'UNTIL=[^;]+', f'UNTIL={_fmt_until(r_minus_one)}', series.rrule)
        series.save(update_fields=['rrule', 'updated_at'])

        new_series = EventSeries.objects.create(
            title       = new_template['title'],
            description = new_template['description'],
            location    = new_template['location'],
            priority    = new_template['priority'],
            dtstart     = R,
            duration    = new_template['duration'],
            timezone    = new_template['timezone'],
            category    = series.category,
            organizer   = series.organizer,
            rrule       = original_rrule,
        )
        new_series.shared_with.set(series.shared_with.all())

        future_overrides = list(
            EventOccurrenceOverride.objects
                .select_for_update()
                .filter(series=series, recurrence_id__gte=R)
        )

        pending_conflicts = []
        for ov in future_overrides:
            if not ov.is_cancelled:
                for field in changed_fields:
                    if not override_has_field(ov, field):
                        continue
                    V_O = override_value_for_field(ov, field)
                    if field == 'time':
                        end_utc = add_duration_wallclock(
                            ov.recurrence_id,
                            new_template['duration'],
                            new_template['timezone'],
                        )
                        V_B = (ov.recurrence_id, end_utc)
                    else:
                        V_B = (new_template[field],)
                    if V_O == V_B:
                        clear_override_field(ov, field)
                    else:
                        pending_conflicts.append({
                            'series_id':      new_series.id,
                            'recurrence_id':  ov.recurrence_id.isoformat(),
                            'field':          field,
                            'override_value': _serialize_value(V_O),
                            'proposed_value': _serialize_value(V_B),
                        })

            ov.series = new_series
            if override_is_empty(ov):
                ov.delete()
            else:
                ov.save()

    return Response(
        {
            'original_series':   EventSeriesSerializer(series).data,
            'new_series':        EventSeriesSerializer(new_series).data,
            'pending_conflicts': pending_conflicts,
        },
        status=status.HTTP_201_CREATED,
    )
