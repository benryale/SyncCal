#django imports 
from django.db.models import Q
#Rest framework imports
from rest_framework import viewsets, permissions, serializers
#local imports 
from .models import Event, Category
from .serializers import EventSerializer, CategorySerializer
from api.models import FriendRequest
# This should handle everything catgegory related (deleting, creating, updating, etc)
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

# This should handle everything event related (deleting, creating, updating, etc)
class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return Event.objects.none()
            
        return Event.objects.filter(
            Q(organizer=user) | Q(shared_with=user)
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
            
            # Extract ids of actual friends
            friend_ids = []
            for req in accepted_requests:
                if req.from_user == user:
                    friend_ids.append(req.to_user.id)
                else:
                    friend_ids.append(req.from_user.id)
                
            # we must validate that every user they are sharing with is a friend
            for shared_user_id in new_shared_users:
                if int(shared_user_id) not in friend_ids:
                    raise serializers.ValidationError('You can only share events with your friends.')
        
        serializer.save()
            
