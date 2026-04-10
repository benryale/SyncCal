from django.db import models
from django.contrib.auth.models import User

# Create your models here.

#First we define what an event looks like. Taken from Geeks for Geeks tutorial
class Category(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class Event(models.Model):
    title = models.CharField(max_length=150) # Changed from 'name' to 'title' to match FullCalendar
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    priority = models.IntegerField(default=1)
    description = models.TextField(blank=True, default='')
    location = models.CharField(max_length=255, blank=True, default='')
    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organized_events')
    shared_with = models.ManyToManyField('auth.User', related_name='events_shared_with_me', blank=True)
    def __str__(self):
        return self.title