from importlib import import_module

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from events.models import EventSeries
from events.zone_utils import validate_iana_timezone
from .models import UserProfile

# Pull the data-migration module directly so we can exercise backfill_profiles
# the same way Django's RunPython would. The module name starts with a digit,
# so the regular `from . import ...` form doesn't work.
_BACKFILL_MIGRATION = import_module('api.migrations.0004_backfill_userprofiles')

"""this file contains tests for the api app that require the db. 
these tests include signals, data migrations, and any other code more easily tested with db 
than with pure unit tests. """
class UserProfileSignalTests(TestCase):

    def test_create_user_creates_profile_with_default_utc(self):
        # creating a user should auto-create a UserProfile with timezone=UTC
        u = User.objects.create_user(username='alice', password='pw')
        self.assertTrue(hasattr(u, 'profile'))
        self.assertEqual(u.profile.timezone, 'UTC')

    def test_save_on_existing_user_does_not_duplicate_profile(self):
        # saving an existing user should not create a new profile or change the existing one
        u = User.objects.create_user(username='bob', password='pw')
        original_pk = u.profile.pk
        u.email = 'bob@x.com'
        u.save()
        u.profile.refresh_from_db()
        self.assertEqual(u.profile.pk, original_pk)
        self.assertEqual(UserProfile.objects.filter(user=u).count(), 1)


class BackfillUserProfileMigrationTests(TestCase):
    """this class tests the data migration that backfills userprofiles for existing users at the time of our initial userprofile implementation. """
    class _FakeApps:
        # we only need the User and UserProfile models for this test, so we can keep it simple
        def get_model(self, *args):
            if len(args) == 1 and args[0] == 'auth.User':
                return User
            if args == ('api', 'UserProfile'):
                return UserProfile
            raise ValueError(args)

    def _backfill(self):
        _BACKFILL_MIGRATION.backfill_profiles(self._FakeApps(), schema_editor=None)

    def test_backfill_creates_missing_profile_at_utc(self):
        u = User.objects.create_user(username='charlie', password='pw')
        UserProfile.objects.filter(user=u).delete()
        self.assertFalse(UserProfile.objects.filter(user=u).exists())

        self._backfill()
        self.assertTrue(UserProfile.objects.filter(user=u, timezone='UTC').exists())

    def test_backfill_is_idempotent(self):
        u = User.objects.create_user(username='dave', password='pw')
        self._backfill()
        self._backfill()
        self.assertEqual(UserProfile.objects.filter(user=u).count(), 1)

    def test_backfill_does_not_touch_existing_non_utc_profiles(self):
        u = User.objects.create_user(username='erin', password='pw')
        u.profile.timezone = 'Europe/London'
        u.profile.save(update_fields=['timezone'])
        self._backfill()
        u.profile.refresh_from_db()
        self.assertEqual(u.profile.timezone, 'Europe/London')


class ValidateIanaTimezoneTests(TestCase):

    def test_accepts_canonical_zones(self):
        for tz in ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']:
            validate_iana_timezone(tz)  # must not raise

    def test_accepts_legacy_alias_without_canonicalizing(self):
        # legacy alias; accept as-is
        validate_iana_timezone('US/Eastern')

    def test_rejects_empty_string(self):
        with self.assertRaises(ValidationError):
            validate_iana_timezone('')

    def test_rejects_legacy_flat_abbreviation_EST(self):
        # EST is fixed-offset, no DST — users meant America/New_York
        with self.assertRaises(ValidationError):
            validate_iana_timezone('EST')

    def test_rejects_raw_offset(self):
        with self.assertRaises(ValidationError):
            validate_iana_timezone('+0500')

    def test_rejects_made_up_zone(self):
        with self.assertRaises(ValidationError):
            validate_iana_timezone('Europe/Atlantis')


class AuthTimezoneEndpointTests(APITestCase):

    def test_register_with_valid_timezone_stores_it_and_returns_it(self):
        r = self.client.post(
            '/api/auth/register/',
            {'username': 'alice', 'email': 'a@x.com', 'password': 'pw',
             'timezone': 'America/New_York'},
            format='json',
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['timezone'], 'America/New_York')
        self.assertEqual(
            UserProfile.objects.get(user__username='alice').timezone,
            'America/New_York',
        )

    def test_register_with_invalid_timezone_succeeds_with_utc(self):
        # bad tz is swallowed on register so signup doesnt fail
        r = self.client.post(
            '/api/auth/register/',
            {'username': 'bob', 'email': 'b@x.com', 'password': 'pw',
             'timezone': 'Bogus/Zone'},
            format='json',
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['timezone'], 'UTC')
        self.assertEqual(
            UserProfile.objects.get(user__username='bob').timezone,
            'UTC',
        )

    def test_register_without_timezone_defaults_to_utc(self):
        r = self.client.post(
            '/api/auth/register/',
            {'username': 'cara', 'email': 'c@x.com', 'password': 'pw'},
            format='json',
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['timezone'], 'UTC')

    def test_login_returns_timezone(self):
        u = User.objects.create_user(username='dean', password='pw')
        u.profile.timezone = 'Asia/Tokyo'
        u.profile.save(update_fields=['timezone'])

        r = self.client.post(
            '/api/auth/login/',
            {'username': 'dean', 'password': 'pw'},
            format='json',
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body['timezone'], 'Asia/Tokyo')
        self.assertEqual(body['username'], 'dean')
        self.assertIn('token', body)

    def test_login_lazy_creates_missing_profile(self):
        # simulate a user without a profile
        u = User.objects.create_user(username='evan', password='pw')
        UserProfile.objects.filter(user=u).delete()

        r = self.client.post(
            '/api/auth/login/',
            {'username': 'evan', 'password': 'pw'},
            format='json',
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['timezone'], 'UTC')
        self.assertTrue(UserProfile.objects.filter(user=u, timezone='UTC').exists())


class CurrentUserEndpointTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='frida', password='pw')
        self.user.profile.timezone = 'America/Los_Angeles'
        self.user.profile.save(update_fields=['timezone'])
        self.token, _ = Token.objects.get_or_create(user=self.user)

    def _auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_get_requires_authentication(self):
        r = self.client.get('/api/users/me/')
        self.assertEqual(r.status_code, 401)

    def test_get_returns_id_username_email_timezone(self):
        self._auth()
        r = self.client.get('/api/users/me/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {
            'id':       self.user.id,
            'username': 'frida',
            'email':    '',
            'timezone': 'America/Los_Angeles',
        })

    def test_patch_updates_timezone(self):
        self._auth()
        r = self.client.patch('/api/users/me/', {'timezone': 'Europe/London'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['timezone'], 'Europe/London')
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.timezone, 'Europe/London')

    def test_patch_with_invalid_timezone_returns_400_and_does_not_mutate(self):
        self._auth()
        r = self.client.patch('/api/users/me/', {'timezone': 'EST'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('timezone', r.json())
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.timezone, 'America/Los_Angeles')

    def test_patch_without_timezone_field_returns_400(self):
        self._auth()
        r = self.client.patch('/api/users/me/', {}, format='json')
        self.assertEqual(r.status_code, 400)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.timezone, 'America/Los_Angeles')


class EventSeriesOrganizerTimezoneTests(APITestCase):

    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='pw')
        self.alice.profile.timezone = 'America/Los_Angeles'
        self.alice.profile.save(update_fields=['timezone'])
        self.token, _ = Token.objects.get_or_create(user=self.alice)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def _create_event(self, payload):
        body = {
            'title': payload.get('title', 'Smoke event'),
            'start_date': payload.get('start_date', '2025-05-01T10:00:00Z'),
            'end_date':   payload.get('end_date',   '2025-05-01T11:00:00Z'),
        }
        if 'timezone' in payload:
            body['timezone'] = payload['timezone']
        return self.client.post('/api/events/', body, format='json')

    def test_create_without_payload_timezone_inherits_organizer_profile(self):
        r = self._create_event({})
        self.assertEqual(r.status_code, 201, r.content)
        series = EventSeries.objects.get(id=r.json()['id'])
        self.assertEqual(series.timezone, 'America/Los_Angeles')

    def test_create_with_payload_timezone_honors_payload(self):
        r = self._create_event({'timezone': 'America/New_York'})
        self.assertEqual(r.status_code, 201, r.content)
        series = EventSeries.objects.get(id=r.json()['id'])
        self.assertEqual(series.timezone, 'America/New_York')

    def test_organizer_preference_change_does_not_backpropagate_to_existing_series(self):
        r = self._create_event({})
        series_id = r.json()['id']

        self.alice.profile.timezone = 'Asia/Tokyo'
        self.alice.profile.save(update_fields=['timezone'])

        series = EventSeries.objects.get(id=series_id)
        self.assertEqual(series.timezone, 'America/Los_Angeles')

        r2 = self._create_event({'title': 'Post-preference-change'})
        series2 = EventSeries.objects.get(id=r2.json()['id'])
        self.assertEqual(series2.timezone, 'Asia/Tokyo')

    def test_create_with_organizer_missing_profile_falls_back_to_utc(self):
        bob = User.objects.create_user(username='bob', password='pw')
        UserProfile.objects.filter(user=bob).delete()
        bob_token, _ = Token.objects.get_or_create(user=bob)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {bob_token.key}')

        r = self._create_event({})
        self.assertEqual(r.status_code, 201, r.content)
        series = EventSeries.objects.get(id=r.json()['id'])
        self.assertEqual(series.timezone, 'UTC')
