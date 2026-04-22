import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework.authtoken.models import Token


class CalendarConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time calendar updates.

    Each authenticated user joins two channel groups:
      1. user_{user_id}          – private messages for this user only
      2. friend_{friend_id}      – broadcasts whenever a friend mutates an event

    When an event is created / updated / deleted, the backend signals module
    (see signals.py) calls channel_layer.group_send() on all relevant groups.
    The consumer forwards the message to the connected browser tab.
    """

    async def connect(self):
        # Authenticate via token sent as a query-string param:
        # ws://host/ws/calendar/?token=<drf-token>
        token_key = self._get_token_from_scope()
        self.user = await self._get_user_from_token(token_key)

        if self.user is None:
            await self.close(code=4001)
            return

        self.user_group = f"user_{self.user.id}"

        # Join the user's private group
        await self.channel_layer.group_add(self.user_group, self.channel_name)

        # Join a "friend broadcast" group so friends can push updates to us.
        # Named friend_{self.user.id} – any of this user's friends will send
        # to this group when they mutate their own events.
        await self.channel_layer.group_add(
            f"friend_{self.user.id}", self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "user_group"):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
        if hasattr(self, "user") and self.user:
            await self.channel_layer.group_discard(
                f"friend_{self.user.id}", self.channel_name
            )

    async def receive(self, text_data):
        # We don't currently handle any client→server messages,
        # but we keep this here to avoid silent drops.
        pass

    # ------------------------------------------------------------------ #
    # Message handlers – called by channel_layer.group_send()             #
    # The "type" key maps to a method name with dots replaced by underscores
    # ------------------------------------------------------------------ #

    async def calendar_event_update(self, event):
        """Relay a calendar mutation event to the browser."""
        await self.send(text_data=json.dumps(event["payload"]))

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _get_token_from_scope(self):
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        for part in query_string.split("&"):
            if part.startswith("token="):
                return part[len("token="):]
        return None

    @database_sync_to_async
    def _get_user_from_token(self, token_key):
        if not token_key:
            return None
        try:
            token = Token.objects.select_related("user").get(key=token_key)
            return token.user
        except Token.DoesNotExist:
            return None
