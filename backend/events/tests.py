import datetime
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .expansion import resolve_occurrences
from .models import EventOccurrenceOverride, EventInvite, EventSeries
from .serializers import EventSeriesSerializer
from .zone_utils import add_duration_wallclock, expand_rrule, local_to_utc

# fixed UTC base keeps tests reproducible regardless of when they run
BASE_TIME = datetime.datetime(2026, 4, 21, 10, 0, 0, tzinfo=datetime.timezone.utc)
UNTIL_FAR  = '20280101T000000Z'   # well past all test dates


def _make_series(user, rrule=None, **kwargs):
    defaults = dict(
        title='Weekly standup',
        dtstart=BASE_TIME,
        duration=timedelta(hours=1),
        organizer=user,
    )
    defaults.update(kwargs)
    if rrule is not None:
        defaults['rrule'] = rrule
    return EventSeries.objects.create(**defaults)


def _bounded_rrule(until=UNTIL_FAR):
    return f'FREQ=WEEKLY;BYDAY=MO;UNTIL={until}'


class EventSeriesModelTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='organizer', password='pass')
        self.series = _make_series(self.user, rrule=_bounded_rrule())

    def test_non_recurring_series_has_null_rrule_and_no_overrides(self):
        s = _make_series(self.user)   # no rrule arg → NULL
        self.assertIsNone(s.rrule)
        self.assertEqual(s.overrides.count(), 0)

    def test_edit_override_leaves_other_fields_inheriting_from_series(self):
        rid = BASE_TIME + timedelta(weeks=1)
        ov = EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=rid,
            title_override='Revised',
        )
        self.assertEqual(ov.title_override, 'Revised')
        self.assertIsNone(ov.start_override)
        self.assertIsNone(ov.end_override)
        self.assertIsNone(ov.priority_override)
        self.assertIsNone(ov.description_override)
        self.assertIsNone(ov.location_override)

    def test_clean_rejects_rrule_without_until(self):
        s = EventSeries(
            title='Unbounded', organizer=self.user,
            dtstart=BASE_TIME, duration=timedelta(hours=1),
            rrule='FREQ=WEEKLY;BYDAY=MO',   # missing UNTIL=
        )
        with self.assertRaises(ValidationError):
            s.clean()

    def test_clean_accepts_rrule_with_until(self):
        s = EventSeries(
            title='Bounded', organizer=self.user,
            dtstart=BASE_TIME, duration=timedelta(hours=1),
            rrule=_bounded_rrule(),
        )
        s.clean()   # must not raise

    def test_clean_accepts_null_rrule(self):
        s = EventSeries(
            title='One-off', organizer=self.user,
            dtstart=BASE_TIME, duration=timedelta(hours=1),
            rrule=None,
        )
        s.clean()   # must not raise

    def test_delete_series_cascades_overrides(self):
        rid = BASE_TIME + timedelta(weeks=1)
        EventOccurrenceOverride.objects.create(series=self.series, recurrence_id=rid)
        series_pk = self.series.pk
        self.series.delete()
        self.assertEqual(
            EventOccurrenceOverride.objects.filter(series_id=series_pk).count(), 0
        )


class EventOccurrenceOverrideTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='organizer', password='pass')
        self.series = _make_series(self.user, rrule=_bounded_rrule())
        self.rid = BASE_TIME + timedelta(weeks=1)

    def test_cancel_occurrence_sets_is_cancelled(self):
        ov = EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=self.rid,
            is_cancelled=True,
        )
        self.assertTrue(ov.is_cancelled)

    def test_cancel_twice_is_idempotent(self):
        ov1, created1 = EventOccurrenceOverride.objects.update_or_create(
            series=self.series,
            recurrence_id=self.rid,
            defaults={'is_cancelled': True},
        )
        self.assertTrue(created1)

        ov2, created2 = EventOccurrenceOverride.objects.update_or_create(
            series=self.series,
            recurrence_id=self.rid,
            defaults={'is_cancelled': True},
        )
        self.assertFalse(created2)
        self.assertEqual(ov1.pk, ov2.pk)
        self.assertEqual(
            EventOccurrenceOverride.objects.filter(
                series=self.series, recurrence_id=self.rid
            ).count(),
            1,
        )

    def test_unique_together_prevents_duplicate_override(self):
        EventOccurrenceOverride.objects.create(
            series=self.series, recurrence_id=self.rid
        )
        with self.assertRaises(IntegrityError):
            EventOccurrenceOverride.objects.create(
                series=self.series, recurrence_id=self.rid
            )


class SplitSeriesAPITests(APITestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(username='organizer', password='pass')
        self.client.force_authenticate(user=self.organizer)

        self.R           = BASE_TIME + timedelta(weeks=3)
        self.r_minus_one = BASE_TIME + timedelta(weeks=2)

        self.series = _make_series(
            self.organizer,
            rrule=_bounded_rrule(),
        )

    def _split(self, fields=None):
        return self.client.post(
            f'/api/events/{self.series.pk}/split/',
            {
                'recurrence_id': self.R.isoformat(),
                'r_minus_one':   self.r_minus_one.isoformat(),
                'fields':        fields or {},
            },
            format='json',
        )

    def test_split_no_overrides_produces_two_series_no_conflicts(self):
        r = self._split()

        self.assertEqual(r.status_code, 201)
        self.assertIn('original_series', r.data)
        self.assertIn('new_series',      r.data)
        self.assertEqual(r.data['pending_conflicts'], [])
        self.assertEqual(EventSeries.objects.count(), 2)

        self.series.refresh_from_db()
        r_minus_one_fmt = self.r_minus_one.strftime('%Y%m%dT%H%M%SZ')
        self.assertIn(f'UNTIL={r_minus_one_fmt}', self.series.rrule)

        tail = EventSeries.objects.get(pk=r.data['new_series']['id'])
        self.assertEqual(tail.dtstart, self.R)
        self.assertEqual(tail.organizer, self.organizer)

    def test_split_disjoint_override_is_moved_to_tail(self):
        ov = EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=self.R,
            start_override=self.R + timedelta(hours=1),
        )

        r = self._split(fields={'title': 'Renamed'})

        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['pending_conflicts'], [])

        ov.refresh_from_db()
        tail_id = r.data['new_series']['id']
        self.assertEqual(ov.series_id, tail_id)
        self.assertEqual(ov.recurrence_id, self.R)

    def test_split_colliding_override_stays_on_original_and_is_surfaced(self):
        ov = EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=self.R,
            title_override='Custom title',
        )

        r = self._split(fields={'title': 'Renamed'})

        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.data['pending_conflicts']), 1)
        self.assertEqual(r.data['pending_conflicts'][0]['id'], ov.pk)

        ov.refresh_from_db()
        self.assertEqual(ov.series_id, self.series.pk)

    def test_split_requires_r_minus_one(self):
        r = self.client.post(
            f'/api/events/{self.series.pk}/split/',
            {'recurrence_id': self.R.isoformat(), 'fields': {}},
            format='json',
        )
        self.assertEqual(r.status_code, 400)

    def test_split_rejects_non_organizer(self):
        other = User.objects.create_user(username='other', password='pass')
        self.client.force_authenticate(user=other)
        r = self._split()
        self.assertEqual(r.status_code, 403)


class EventSeriesSerializerDSTTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='organizer', password='pass')

    def test_end_date_uses_wallclock_addition_across_spring_forward(self):
        series = EventSeries.objects.create(
            title='Overnight shift',
            organizer=self.user,
            dtstart=datetime.datetime(2025, 3, 9, 4, 0, tzinfo=datetime.timezone.utc),
            duration=timedelta(hours=10),
            timezone='America/New_York',
        )
        data = EventSeriesSerializer(series).data
        self.assertEqual(
            data['end_date'],
            datetime.datetime(2025, 3, 9, 13, 0, tzinfo=datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
        )

    def test_write_path_stores_wallclock_duration_across_spring_forward(self):
        payload = {
            'title': 'Overnight shift',
            'timezone': 'America/New_York',
            'start_date': '2025-03-09T04:00:00Z',
            'end_date':   '2025-03-09T13:00:00Z',
        }
        serializer = EventSeriesSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        series = serializer.save(organizer=self.user)
        # wall-clock delta = 10h even though UTC elapsed is 9h
        self.assertEqual(series.duration, timedelta(hours=10))

    def test_write_path_defaults_to_utc_when_timezone_omitted(self):
        payload = {
            'title': 'UTC event',
            'start_date': '2025-06-01T10:00:00Z',
            'end_date':   '2025-06-01T11:30:00Z',
        }
        serializer = EventSeriesSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        series = serializer.save(organizer=self.user)
        self.assertEqual(series.timezone, 'UTC')
        self.assertEqual(series.duration, timedelta(hours=1, minutes=30))


class EventInviteFlowTests(APITestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(username='organizer', password='pass')
        self.invitee   = User.objects.create_user(username='invitee',   password='pass')
        self.series = _make_series(self.organizer, rrule=_bounded_rrule())
        self.client.force_authenticate(user=self.organizer)

    def test_accepted_invite_fk_resolves_to_eventseries(self):
        invite = EventInvite.objects.create(
            event=self.series,
            user=self.invitee,
            status='accepted',
        )
        reloaded = EventInvite.objects.select_related('event').get(pk=invite.pk)
        self.assertIsInstance(reloaded.event, EventSeries)
        self.assertEqual(reloaded.event.pk, self.series.pk)
        self.assertEqual(reloaded.status, 'accepted')

    def test_accepted_invite_stays_on_original_series_after_split(self):
        invite = EventInvite.objects.create(
            event=self.series,
            user=self.invitee,
            status='accepted',
        )

        R           = BASE_TIME + timedelta(weeks=3)
        r_minus_one = BASE_TIME + timedelta(weeks=2)

        r = self.client.post(
            f'/api/events/{self.series.pk}/split/',
            {
                'recurrence_id': R.isoformat(),
                'r_minus_one':   r_minus_one.isoformat(),
                'fields':        {},
            },
            format='json',
        )
        self.assertEqual(r.status_code, 201)

        invite.refresh_from_db()
        self.assertEqual(invite.event_id, self.series.pk)
        self.assertIsInstance(invite.event, EventSeries)


class ZoneUtilsDSTEdgeTests(TestCase):

    def test_nonexistent_spring_forward_uses_default_fold(self):
        result = local_to_utc(datetime.datetime(2025, 3, 9, 2, 30), 'America/New_York')
        self.assertEqual(result, datetime.datetime(2025, 3, 9, 7, 30, tzinfo=datetime.timezone.utc))

    def test_ambiguous_fall_back_fold_0_picks_pre_transition(self):
        result = local_to_utc(datetime.datetime(2025, 11, 2, 1, 30), 'America/New_York', fold=0)
        self.assertEqual(result, datetime.datetime(2025, 11, 2, 5, 30, tzinfo=datetime.timezone.utc))

    def test_ambiguous_fall_back_fold_1_picks_post_transition(self):
        result = local_to_utc(datetime.datetime(2025, 11, 2, 1, 30), 'America/New_York', fold=1)
        self.assertEqual(result, datetime.datetime(2025, 11, 2, 6, 30, tzinfo=datetime.timezone.utc))


class WallClockDurationTests(TestCase):

    NY = 'America/New_York'

    def test_spring_forward_overnight_loses_a_utc_hour(self):
        # 2025-03-08 23:00 NY (EST) → 2025-03-09 04:00 UTC
        start_utc = datetime.datetime(2025, 3, 9, 4, 0, tzinfo=datetime.timezone.utc)
        end_utc = add_duration_wallclock(start_utc, timedelta(hours=10), self.NY)
        # Target local wall clock: 2025-03-09 09:00 NY (EDT) = 13:00 UTC
        self.assertEqual(end_utc, datetime.datetime(2025, 3, 9, 13, 0, tzinfo=datetime.timezone.utc))
        self.assertEqual(end_utc - start_utc, timedelta(hours=9))

    def test_fall_back_evening_gains_a_utc_hour(self):
        # 2025-11-01 20:00 NY (EDT) → 2025-11-02 00:00 UTC
        start_utc = datetime.datetime(2025, 11, 2, 0, 0, tzinfo=datetime.timezone.utc)
        end_utc = add_duration_wallclock(start_utc, timedelta(hours=10), self.NY)
        # Target local wall clock: 2025-11-02 06:00 NY (EST) = 11:00 UTC
        self.assertEqual(end_utc, datetime.datetime(2025, 11, 2, 11, 0, tzinfo=datetime.timezone.utc))
        self.assertEqual(end_utc - start_utc, timedelta(hours=11))

    def test_utc_timezone_degenerates_to_pure_utc_math(self):
        start_utc = datetime.datetime(2025, 6, 1, 12, 0, tzinfo=datetime.timezone.utc)
        end_utc = add_duration_wallclock(start_utc, timedelta(hours=10), 'UTC')
        self.assertEqual(end_utc, start_utc + timedelta(hours=10))


class WeeklyRRuleDSTTests(TestCase):

    NY = 'America/New_York'
    DTSTART = datetime.datetime(2025, 2, 3, 23, 0, tzinfo=datetime.timezone.utc)
    RRULE   = 'FREQ=WEEKLY;UNTIL=20251201T000000Z'

    def test_spring_forward_shifts_utc_instant_one_hour_earlier(self):
        window_start = datetime.datetime(2025, 2, 1, tzinfo=datetime.timezone.utc)
        window_end   = datetime.datetime(2025, 3, 18, tzinfo=datetime.timezone.utc)
        occurrences = expand_rrule(self.DTSTART, self.RRULE, self.NY, window_start, window_end)

        self.assertEqual(occurrences, [
            datetime.datetime(2025, 2,  3, 23, 0, tzinfo=datetime.timezone.utc),
            datetime.datetime(2025, 2, 10, 23, 0, tzinfo=datetime.timezone.utc),
            datetime.datetime(2025, 2, 17, 23, 0, tzinfo=datetime.timezone.utc),
            datetime.datetime(2025, 2, 24, 23, 0, tzinfo=datetime.timezone.utc),
            datetime.datetime(2025, 3,  3, 23, 0, tzinfo=datetime.timezone.utc),
            datetime.datetime(2025, 3, 10, 22, 0, tzinfo=datetime.timezone.utc),
            datetime.datetime(2025, 3, 17, 22, 0, tzinfo=datetime.timezone.utc),
        ])

    def test_fall_back_restores_original_utc_instant(self):
        window_start = datetime.datetime(2025, 11, 1, tzinfo=datetime.timezone.utc)
        window_end   = datetime.datetime(2025, 11, 4, tzinfo=datetime.timezone.utc)
        occurrences = expand_rrule(self.DTSTART, self.RRULE, self.NY, window_start, window_end)

        self.assertEqual(occurrences, [
            datetime.datetime(2025, 11, 3, 23, 0, tzinfo=datetime.timezone.utc),
        ])


class ResolveOccurrencesMergeTests(TestCase):

    WINDOW_START = datetime.datetime(2025, 4, 1, tzinfo=datetime.timezone.utc)
    WINDOW_END   = datetime.datetime(2025, 5, 1, tzinfo=datetime.timezone.utc)

    def setUp(self):
        self.user = User.objects.create_user(username='organizer', password='pass')
        # Weekly Monday rule anchored in April — no DST transitions to worry about;
        # every occurrence is EDT, so UTC instants are stable and easy to assert on.
        self.series = _make_series(
            self.user,
            rrule='FREQ=WEEKLY;BYDAY=MO;UNTIL=20250501T000000Z',
            dtstart=datetime.datetime(2025, 4, 7, 14, 0, tzinfo=datetime.timezone.utc),  # 10am EDT Mon
            duration=timedelta(hours=2),
            timezone='America/New_York',
            title='Standup',
            description='Template desc',
            location='Template loc',
            priority=2,
        )
        # Override targets the 2025-04-14 occurrence throughout the tests.
        self.target_rid = datetime.datetime(2025, 4, 14, 14, 0, tzinfo=datetime.timezone.utc)

    def _resolve(self):
        return list(resolve_occurrences(self.series, self.WINDOW_START, self.WINDOW_END))

    def _occurrence_at(self, rid):
        matches = [o for o in self._resolve() if o['recurrence_id'] == rid]
        self.assertEqual(len(matches), 1, f'expected exactly one occurrence at {rid}')
        return matches[0]

    def test_title_only_override_inherits_other_fields(self):
        EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=self.target_rid,
            title_override='Renamed',
        )
        o = self._occurrence_at(self.target_rid)
        self.assertEqual(o['title'],       'Renamed')
        self.assertEqual(o['description'], 'Template desc')
        self.assertEqual(o['location'],    'Template loc')
        self.assertEqual(o['priority'],    2)
        # derived start/end: unchanged — rule-produced rid and wall-clock duration apply
        self.assertEqual(o['start'], self.target_rid)
        self.assertEqual(o['end'],   self.target_rid + timedelta(hours=2))

    def test_cancelled_override_is_omitted(self):
        EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=self.target_rid,
            is_cancelled=True,
        )
        rids = [o['recurrence_id'] for o in self._resolve()]
        self.assertNotIn(self.target_rid, rids)
        self.assertEqual(len(rids), 3)

    def test_start_override_does_not_drag_end(self):
        moved_start = self.target_rid + timedelta(hours=1)   # 11am EDT
        EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=self.target_rid,
            start_override=moved_start,
        )
        o = self._occurrence_at(self.target_rid)
        self.assertEqual(o['start'], moved_start)
        self.assertEqual(o['end'], self.target_rid + timedelta(hours=2))

    def test_start_and_end_override_used_verbatim(self):
        moved_start = self.target_rid + timedelta(hours=1)
        moved_end   = self.target_rid + timedelta(hours=4)
        EventOccurrenceOverride.objects.create(
            series=self.series,
            recurrence_id=self.target_rid,
            start_override=moved_start,
            end_override=moved_end,
        )
        o = self._occurrence_at(self.target_rid)
        self.assertEqual(o['start'], moved_start)
        self.assertEqual(o['end'],   moved_end)


class OverrideZoneAsymmetryTests(TestCase):

    def test_start_override_unchanged_after_series_timezone_change(self):
        user = User.objects.create_user(username='organizer', password='pass')
        series = _make_series(
            user,
            dtstart=datetime.datetime(2025, 6, 15, 13, 0, tzinfo=datetime.timezone.utc),
            duration=timedelta(hours=1),
            timezone='America/New_York',
        )
        pinned = datetime.datetime(2025, 6, 15, 14, 0, tzinfo=datetime.timezone.utc)
        override = EventOccurrenceOverride.objects.create(
            series=series,
            recurrence_id=series.dtstart,
            start_override=pinned,
        )

        series.timezone = 'America/Los_Angeles'
        series.save(update_fields=['timezone', 'updated_at'])

        override.refresh_from_db()
        self.assertEqual(override.start_override, pinned)


class ConflictDetectionZoneAgnosticTests(TestCase):

    def test_overlap_detected_across_different_source_timezones(self):
        user = User.objects.create_user(username='organizer', password='pass')

        # A: 2025-04-07 10:00–12:00 EDT = 14:00–16:00 UTC (defined in NY)
        a = _make_series(
            user,
            dtstart=datetime.datetime(2025, 4, 7, 14, 0, tzinfo=datetime.timezone.utc),
            duration=timedelta(hours=2),
            timezone='America/New_York',
            title='NY meeting',
        )
        # B: 2025-04-07 08:00–10:00 PDT = 15:00–17:00 UTC (defined in LA)
        b = _make_series(
            user,
            dtstart=datetime.datetime(2025, 4, 7, 15, 0, tzinfo=datetime.timezone.utc),
            duration=timedelta(hours=2),
            timezone='America/Los_Angeles',
            title='LA meeting',
        )

        window = (datetime.datetime(2025, 4, 7, tzinfo=datetime.timezone.utc),
                  datetime.datetime(2025, 4, 8, tzinfo=datetime.timezone.utc))
        oa = list(resolve_occurrences(a, *window))[0]
        ob = list(resolve_occurrences(b, *window))[0]

        self.assertTrue(oa['start'] < ob['end'] and ob['start'] < oa['end'])
