from django.apps import AppConfig
"""Thsi file defines config for the accounts app and imports signals to register post_save handlers"""

class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        import accounts.signals  # noqa: F401 – registers post_save handlers
