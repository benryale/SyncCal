from rest_framework import serializers
from .models import Category, Event

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        
class EventSerializer(serializers.ModelSerializer):
    organizer = serializers.ReadOnlyField(source='organizer.username')
    class Meta:
        model = Event
        fields = '__all__'