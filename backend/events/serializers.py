from rest_framework import serializers
from .models import Category, Event, EventInvite

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class EventInviteSerializer(serializers.ModelSerializer):
    # show the username and event title instead of just ids
    username = serializers.ReadOnlyField(source='user.username')
    event_title = serializers.ReadOnlyField(source='event.title')

    class Meta:
        model = EventInvite
        fields = ['id', 'event', 'user', 'username', 'event_title', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']

class EventSerializer(serializers.ModelSerializer):
    organizer = serializers.ReadOnlyField(source='organizer.username')

    class Meta:
        model = Event
        fields = '__all__'
