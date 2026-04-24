import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class SyncCalConsumer(AsyncWebsocketConsumer):

    async def connect(self):
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
        if hasattr(self, 'personal_group'):
            await self.channel_layer.group_discard(self.personal_group, self.channel_name)
        if hasattr(self, 'friend_group'):
            await self.channel_layer.group_discard(self.friend_group,   self.channel_name)

    async def receive(self, text_data):
        pass

    async def calendar_event_update(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    async def friend_request_update(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    async def invite_update(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    def _get_token(self):
        qs = self.scope.get('query_string', b'').decode('utf-8')
        for part in qs.split('&'):
            if part.startswith('token='):
                return part[len('token='):]
        return None

    @database_sync_to_async
    def _get_user(self, token_key):
        from rest_framework.authtoken.models import Token
        if not token_key:
            return None
        try:
            return Token.objects.select_related('user').get(key=token_key).user
        except Token.DoesNotExist:
            return None
