from django.apps import AppConfig


class EventsConfig(AppConfig):
    name = 'events'

    def ready(self):
        import events.signals  # noqa: F401 – registers post_save / post_delete handlers
