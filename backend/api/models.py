from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User

from events.zone_utils import validate_iana_timezone


# one row per User; auto-created via post_save signal
class UserProfile(models.Model):
    user       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    timezone   = models.CharField(max_length=64, default='UTC')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        # shared with EventSeries.clean so zone rules stay in sync
        try:
            validate_iana_timezone(self.timezone)
        except ValidationError as exc:
            raise ValidationError({'timezone': exc.messages})

    def __str__(self):
        return f'{self.user.username} ({self.timezone})'


class FriendRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]
    ## models.Model provide create read update delete query;
    ## 
    # Who sends request
    from_user = models.ForeignKey(User, related_name='sent_requests', on_delete=models.CASCADE)
    # Who receives request
    to_user = models.ForeignKey(User, related_name='received_requests', on_delete=models.CASCADE)
    # pending/accepted/declined
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    #created time 
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f'{self.from_user.username} -> {self.to_user.username} ({self.status})'
    

"""
class Event(models.Model):
    title = models.CharField(max_length=155)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    priority = models.IntegerField()
    description = models.TextField(blank=True)
    
    #now we can define the owner since every event must be linked to a user
    owner = models.ForeignKey(User, related_name='owned_events', on_delete=models.CASCADE)
    
    #Shared events can be linked to many users, but it doesnt have to be 
    shared_with = models.ManyToManyField(User, related_name='shared_events', blank=True)
    
    def __str__(self):
        return self.title
"""


#create another database that extend the default User from Django 
class Profile(models.Model):
    #Create an OnetoOne relationship to User (default to auth User)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    #image store to avatars/
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
