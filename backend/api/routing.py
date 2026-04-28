from django.urls import re_path
from . import consumers
# WebSocket URL patterns for the application. This is diff from our urls.py bc these are specifically for websocket connections
#which are handled differently than regular http requests. 
websocket_urlpatterns = [
    re_path(r'^ws/synccal/$', consumers.SyncCalConsumer.as_asgi()),
]
