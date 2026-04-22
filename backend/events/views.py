# django imports
from django.db.models import Q
# rest framework imports
from rest_framework.authtoken.models import Token
from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth.models import User
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
        # if user is anonymous, return empty queryset
        if user.is_anonymous:
            return Event.objects.none()
        #check if react is asking for friends calenar
        owner_ids = self.request.query_params.get('owner_id__in')
        if owner_ids:
            #convert string of ids into list of ints
            owner_ids = [int(id) for id in owner_ids.split(',') if id.isdigit()]
            #return the events where organizer is in the list of owner_ids
            return Event.objects.filter(organizer_id__in = owner_ids)
        #if no friend is selected, just return events of the logged in user
        accepted_event_ids = EventInvite.objects.filter(
            user = user,
            status = 'accepted'
        ).values_list('event_id', flat=True)
        return Event.objects.filter(Q(organizer=user) | Q(id__in=accepted_event_ids)).distinct()
        

    def perform_create(self, serializer):
        serializer.save(organizer=self.request.user)
        
        

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

    # 1. Get the user's ID from their username
    try:
        invited_user = User.objects.get(username=username)
        user_id = invited_user.id
    except User.DoesNotExist:
        return Response({'error':f'User "{username}" is not found'}, status=status.HTTP_404_NOT_FOUND)

    # 2. Get the event (You accidentally deleted this block!)
    try:
        event = Event.objects.get(id=event_id, organizer=request.user)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found or you are not the organizer'}, status=status.HTTP_404_NOT_FOUND)

    # 3. Check that the person being invited is actually a friend
    is_friend = FriendRequest.objects.filter(
        (Q(from_user=request.user, to_user_id=user_id) | Q(from_user_id=user_id, to_user=request.user)), 
        status='accepted'
    ).exists()
    
    if not is_friend:
        return Response({'error': 'You can only invite your friends to events'}, status=status.HTTP_403_FORBIDDEN)
    
    # 4. Create the invite
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
