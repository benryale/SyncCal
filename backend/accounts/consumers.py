import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

""" This file defines websocket consumers for real time updates. 
The syncal "consumer" listens for updates to calendar events, friend requests, invites, and sends 
the updates to connected clients."""
class SyncCalConsumer(AsyncWebsocketConsumer):
    """This class defines the set of functions that will be called when a client connects, disconnects, or sends a message to the websocket."""
    async def connect(self):
        """the connect function is called when a clients connects to the websocket. 
        it checks for an authentication token in the string and if valid, it adds the client to two groups
        a personal group for updates specific to that user, and a friend group for updates related to friends. """
        token_key = self._get_token()
        self.user = await self._get_user(token_key)

        if self.user is None:
            await self.close(code=4001)
            return

        self.personal_group = f"user_{self.user.id}"
        self.friend_group   = f"friend_{self.user.id}"

        await self.channel_layer.group_add(self.personal_group, self.channel_name)
        await self.channel_layer.group_add(self.friend_group,   self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        """the disconnect function is called when a client disconnects from the websocket.
        This is essential for clearing out resources and makings ure the server doesn't try to send updates
        to a client that is no longer connected."""
        # disconnect from personal group to stop receiving personal updates
        if hasattr(self, 'personal_group'):
            await self.channel_layer.group_discard(self.personal_group, self.channel_name)
            #disconnect from friend group to stop receiving friend updates
        if hasattr(self, 'friend_group'):
            await self.channel_layer.group_discard(self.friend_group,   self.channel_name)

    async def receive(self, text_data):
        pass

    async def calendar_event_update(self, event):
        """this function is called when there is an update to a calendar event.
        the event parameter is a dictionary that contains the details of the update, and this function sends the update to the client in JSON format."""
        await self.send(text_data=json.dumps(event['payload']))

    async def friend_request_update(self, event):
        """similar to the calendar event update function, 
        this function is called when there is an update to a friend request, and it sends the update to the client in JSON format."""
        await self.send(text_data=json.dumps(event['payload']))

    async def invite_update(self, event):
        """similar to previous two functions, this function is called when there is an update to 
        an invite and sends update to client in JSON format. """
        await self.send(text_data=json.dumps(event['payload']))

    def _get_token(self):
        """this function is essential for extracting the authentication token from the query
        string when a client connects to the websocket. This token is used to authenticate the user 
        and determine which updates they should receive."""
        qs = self.scope.get('query_string', b'').decode('utf-8')
        for part in qs.split('&'):
            if part.startswith('token='):
                return part[len('token='):]
        return None

    @database_sync_to_async
    def _get_user(self, token_key):
        """this function retreives user associaated with the provided authentication token.
        """
        from rest_framework.authtoken.models import Token
        if not token_key:
            return None
        try:
            return Token.objects.select_related('user').get(key=token_key).user
        except Token.DoesNotExist:
            return None
