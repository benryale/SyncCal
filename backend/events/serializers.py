from rest_framework import serializers
from .models import Category, Event

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        
class EventSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username') # This will make the owner field read-only and display the username of the owner instead of the user ID
    class Meta:
        model = Event
        fields = '__all__'