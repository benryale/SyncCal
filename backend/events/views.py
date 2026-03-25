from rest_framework import viewsets
from .models import Category, Event
from .serializers import CategorySerializer, EventSerializer
from rest_framework.permissions import AllowAny # Just temporarily so I can test event creations

# This should handle everything catgegory related (deleting, creating, updating, etc)
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

# This should handle everything event related (deleting, creating, updating, etc)
class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer