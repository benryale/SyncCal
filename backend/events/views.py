# django imports
from django.db.models import Q
# rest framework imports
from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
# local imports
from .models import Event, Category, EventInvite
from .serializers import EventSerializer, CategorySerializer, EventInviteSerializer
from api.models import FriendRequest


# handles all category CRUD (create, read, update, delete)
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


# handles all event CRUD with permission filtering
class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return Event.objects.none()

        # show events the user owns or has accepted an invite to
        accepted_event_ids = EventInvite.objects.filter(
            user=user, status='accepted'
        ).values_list('event_id', flat=True)

        return Event.objects.filter(
            Q(organizer=user) | Q(id__in=accepted_event_ids)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(organizer=self.request.user)

    def perform_update(self, serializer):
        user = self.request.user

        if 'shared_with' in self.request.data:
            new_shared_users = self.request.data.getlist('shared_with')

            accepted_requests = FriendRequest.objects.filter(
                (Q(from_user=user) | Q(to_user=user)) & Q(status='accepted')
            )

            # figure out who our actual friends are
            friend_ids = []
            for req in accepted_requests:
                if req.from_user == user:
                    friend_ids.append(req.to_user.id)
                else:
                    friend_ids.append(req.from_user.id)

            # make sure every shared user is actually a friend
            for shared_user_id in new_shared_users:
                if int(shared_user_id) not in friend_ids:
                    raise serializers.ValidationError('You can only share events with your friends.')

        serializer.save()


# send an invite for an event to a friend
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_event_invite(request):
    event_id = request.data.get('event_id')
    user_id = request.data.get('user_id')

    if not event_id or not user_id:
        return Response({'error': 'event_id and user_id are required'}, status=status.HTTP_400_BAD_REQUEST)

    # make sure this event belongs to the person sending the invite
    try:
        event = Event.objects.get(id=event_id, organizer=request.user)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found or you are not the organizer'}, status=status.HTTP_404_NOT_FOUND)

    # can't invite yourself
    if int(user_id) == request.user.id:
        return Response({'error': 'You cannot invite yourself'}, status=status.HTTP_400_BAD_REQUEST)

    # check that the person being invited is actually a friend
    is_friend = FriendRequest.objects.filter(
        (Q(from_user=request.user, to_user_id=user_id) | Q(from_user_id=user_id, to_user=request.user)),
        status='accepted'
    ).exists()

    if not is_friend:
        return Response({'error': 'You can only invite friends'}, status=status.HTTP_400_BAD_REQUEST)

    # create the invite (or let them know it already exists)
    invite, created = EventInvite.objects.get_or_create(
        event=event,
        user_id=user_id,
        defaults={'status': 'pending'}
    )

    if not created:
        return Response({'error': 'Invite already sent'}, status=status.HTTP_400_BAD_REQUEST)

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
