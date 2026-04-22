"""Pure timezone math for SyncCal recurring events.

  - RRULE expansion runs in local wall-clock time, then projects to UTC.
  - Duration addition uses wall-clock semantics, not UTC arithmetic.
  - Ambiguous times: fold=0 picks pre-transition; nonexistent times use zoneinfo's default.
"""

import zoneinfo
from datetime import datetime, timedelta, timezone

from dateutil.rrule import rrulestr
from django.core.exceptions import ValidationError


# DST-broken flat abbreviations — user who types 'EST' meant America/New_York
_LEGACY_FLAT_BLOCKLIST = frozenset({
    'EST', 'EDT', 'CST', 'CDT', 'MST', 'MDT', 'PST', 'PDT',
    'CST6CDT', 'EST5EDT', 'MST7MDT', 'PST8PDT',
    'GMT+0', 'GMT-0', 'GMT0',
})


def validate_iana_timezone(tz_name: str) -> None:
    if not tz_name or tz_name in _LEGACY_FLAT_BLOCKLIST or tz_name not in zoneinfo.available_timezones():
        raise ValidationError(f'"{tz_name}" is not a recognised IANA timezone')
    try:
        zoneinfo.ZoneInfo(tz_name)
    except zoneinfo.ZoneInfoNotFoundError as exc:
        raise ValidationError(f'"{tz_name}" could not be loaded: {exc}')

_MAX_ITERATIONS = 10_000


def local_to_utc(local_naive: datetime, tz_name: str, fold: int = 0) -> datetime:
    """naive local datetime → UTC-aware datetime; `fold` disambiguates fall-back times."""
    tz = zoneinfo.ZoneInfo(tz_name)
    local_aware = local_naive.replace(tzinfo=tz, fold=fold)
    return local_aware.astimezone(timezone.utc)


def utc_to_local_naive(utc_aware: datetime, tz_name: str) -> datetime:
    tz = zoneinfo.ZoneInfo(tz_name)
    return utc_aware.astimezone(tz).replace(tzinfo=None)


def add_duration_wallclock(dtstart_utc: datetime, duration: timedelta, tz_name: str) -> datetime:
    """add `duration` as wall-clock in tz_name and project back to UTC."""
    end_local_naive = utc_to_local_naive(dtstart_utc, tz_name) + duration
    return local_to_utc(end_local_naive, tz_name)


def expand_rrule(
    dtstart_utc: datetime,
    rrule_text: str,
    tz_name: str,
    window_start: datetime,
    window_end: datetime,
) -> list[datetime]:
    """expand RRULE in naive-local space, project to UTC, return instants in [window_start, window_end].

    ignoretz=True treats UNTIL as a local wall-clock cutoff so dateutil stays in naive-local space.
    """
    tz = zoneinfo.ZoneInfo(tz_name)
    dtstart_local = utc_to_local_naive(dtstart_utc, tz_name)
    rule = rrulestr(rrule_text, dtstart=dtstart_local, ignoretz=True)

    results = []
    for count, local_naive in enumerate(rule):
        if count >= _MAX_ITERATIONS:
            raise ValueError(
                f'expand_rrule exceeded {_MAX_ITERATIONS} iterations — '
                'verify that RRULE contains UNTIL= and the window range is reasonable'
            )
        utc_dt = local_naive.replace(tzinfo=tz).astimezone(timezone.utc)

        if utc_dt > window_end:
            break
        if utc_dt >= window_start:
            results.append(utc_dt)

    return results
