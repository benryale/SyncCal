from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User

from events.zone_utils import validate_iana_timezone

"""this file defines the database models for our application including user profiles and friend requests. 
"""
# one row per User; auto-created via post_save signal
class UserProfile(models.Model):
    # one to one relationship to user; cascade delete so profile goes away if user is deleted; reverse relation is user.user_profile
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_profile')
    timezone   = models.CharField(max_length=64, default='UTC')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        # validate timezone is a valid timezone string. Could be messy if invalid timezone is stored in db. 
        super().clean()
        # shared with EventSeries.clean so zone rules stay in sync
        try:
            validate_iana_timezone(self.timezone)
        except ValidationError as exc:
            raise ValidationError({'timezone': exc.messages})

    def __str__(self):
        # return username and timezone for debugging. not used in API responses
        return f'{self.user.username} ({self.timezone})'


class FriendRequest(models.Model):
    """this class represents a friend request between two users. It has a from_user, to_user, status, and created_at timestamp."""
    #pretty obv
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
        # prevent duplicate friend requests between the same users
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        # return string of the form "from_user -> to_user (status)" for debugging. not used in API responses
        return f'{self.from_user.username} -> {self.to_user.username} ({self.status})'
    



#create another database that extend the default User from Django 
class Profile(models.Model):
    #Create an OnetoOne relationship to User (default to auth User)
    user = models.OneToOneField( User, on_delete=models.CASCADE, related_name='profile' )    #image store to avatars/
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
