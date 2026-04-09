from django.db import models
from django.contrib.auth.models import User


class FriendRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]
    from_user = models.ForeignKey(User, related_name='sent_requests', on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name='received_requests', on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f'{self.from_user.username} -> {self.to_user.username} ({self.status})'
    
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
    