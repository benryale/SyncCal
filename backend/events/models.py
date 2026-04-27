from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User

from .zone_utils import validate_iana_timezone

# Create your models here.

#First we define what an event looks like. Taken from Geeks for Geeks tutorial
class Category(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class EventSeries(models.Model):
    title = models.CharField(max_length=150) # Changed from 'name' to 'title' to match FullCalendar
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True)
    dtstart = models.DateTimeField() # RFC 5545 DTSTART
    duration = models.DurationField() # RFC 5545 DURATION
    priority = models.IntegerField(default=1)
    description = models.TextField(blank=True, default='')
    location = models.CharField(max_length=255, blank=True, default='')
    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organized_events')
    shared_with = models.ManyToManyField('auth.User', related_name='events_shared_with_me', blank=True)
    rrule = models.TextField(null=True, blank=True) # iCal RRULE text; NULL = non-recurring
    timezone = models.CharField(max_length=64, default='UTC') # IANA timezone for RRULE expansion
    color = models.CharField(max_length=7, default="#3B82F6", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        # every RRULE must have UNTIL=
        if self.rrule is not None and 'UNTIL=' not in self.rrule:
            raise ValidationError({'rrule': 'Recurring series must include UNTIL= in the RRULE'})
        # shared with UserProfile.clean
        try:
            validate_iana_timezone(self.timezone)
        except ValidationError as exc:
            raise ValidationError({'timezone': exc.messages})

    def __str__(self):
        return self.title

# tracks who was invited to an event and whether they accepted
class EventInvite(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    event = models.ForeignKey(EventSeries, on_delete=models.CASCADE, related_name='invites')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_invites')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # prevent duplicate invites for the same user on the same event
        unique_together = ('event', 'user')

    def __str__(self):
        return f"{self.user.username} -> {self.event.title} ({self.status})"

# one row per edited/cancelled occurrence
class EventOccurrenceOverride(models.Model):
    series = models.ForeignKey(EventSeries, on_delete=models.CASCADE, related_name='overrides')
    recurrence_id = models.DateTimeField() # UTC instant the rule fires before any edits
    is_cancelled = models.BooleanField(default=False)

    # null = inherit from series, non-null = diverged
    title_override = models.CharField(max_length=150, null=True, blank=True)
    start_override = models.DateTimeField(null=True, blank=True)
    end_override = models.DateTimeField(null=True, blank=True)
    priority_override = models.IntegerField(null=True, blank=True)
    description_override = models.TextField(null=True, blank=True)
    location_override = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('series', 'recurrence_id')

    def __str__(self):
        return f"{self.series.title} @ {self.recurrence_id}"
