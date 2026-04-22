from rest_framework import serializers
from .models import Category, Event, EventInvite

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class EventInviteSerializer(serializers.ModelSerializer):
    organizer_username = serializers.ReadOnlyField(source='event.organizer.username')
    
    event_title = serializers.ReadOnlyField(source='event.title')
    
    event_start = serializers.DateTimeField(source='event.start_date', read_only=True)
    event_end = serializers.DateTimeField(source='event.end_date', read_only=True)
    
    class Meta:
        model = EventInvite
        fields = ['id', 'event', 'user', 'status', 'event_title', 'event_start', 'event_end', 'organizer_username']

class EventSerializer(serializers.ModelSerializer):
    organizer = serializers.ReadOnlyField(source='organizer.username')
    shared_with = serializers.PrimaryKeyRelatedField(many=True, read_only=True)# tells django to 
    # use the primary key of the related objects (users) when serializing the shared_with field, and that this field is read-only (i.e., it cannot be modified through this serializer).
    class Meta:
        model = Event
        fields = '__all__'
