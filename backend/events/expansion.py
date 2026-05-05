from datetime import datetime
from typing import Iterator

from .models import EventSeries
from .zone_utils import add_duration_wallclock, expand_rrule

"""this file contains the logic to expand an event series into concrete occurrences, 
applying overrides as necessary. This is used for both api and calendar generation."""
def resolve_occurrences(
    series: EventSeries,
    window_start: datetime,
    window_end: datetime,
) -> Iterator[dict]:
    """yield one dict per concrete occurrence in [start, end], applying override merge"""
    if series.rrule is None:
        rule_instants = (
            [series.dtstart] if window_start <= series.dtstart <= window_end else []
        )
    else:
        rule_instants = expand_rrule(
            series.dtstart, series.rrule, series.timezone, window_start, window_end
        )

    overrides = {ov.recurrence_id: ov for ov in series.overrides.all()}

    for rid in rule_instants:
        ov = overrides.get(rid)
        if ov is not None and ov.is_cancelled:
            continue

        # start/end overrides are absolute UTC; not reinterpreted through series.timezone
        start = ov.start_override if ov is not None and ov.start_override is not None else rid
        end = (
            ov.end_override
            if ov is not None and ov.end_override is not None
            else add_duration_wallclock(rid, series.duration, series.timezone)
        )

        yield {
            'recurrence_id': rid,
            'start':         start,
            'end':           end,
            'title':       ov.title_override       if ov is not None and ov.title_override       is not None else series.title,
            'description': ov.description_override if ov is not None and ov.description_override is not None else series.description,
            'location':    ov.location_override    if ov is not None and ov.location_override    is not None else series.location,
            'priority':    ov.priority_override    if ov is not None and ov.priority_override    is not None else series.priority,
        }


def occurrence_payload(series, occurrence):
    # flat dict shape returned by GET /api/events/?start&end
    rid = occurrence['recurrence_id']
    rid_iso = rid.isoformat() if hasattr(rid, 'isoformat') else str(rid)
    start = occurrence['start']
    end = occurrence['end']
    start_iso = start.isoformat() if hasattr(start, 'isoformat') else str(start)
    end_iso = end.isoformat() if hasattr(end, 'isoformat') else str(end)
    return {
        'id': f"{series.id}:{rid_iso}",
        'series_id': series.id,
        'recurrence_id': rid_iso,
        'is_recurring': series.rrule is not None,
        'title': occurrence['title'],
        'description': occurrence['description'],
        'location': occurrence['location'],
        'priority': occurrence['priority'],
        'start': start_iso,
        'end': end_iso,
        # legacy field names for Calendar.jsx
        'start_date': start_iso,
        'end_date': end_iso,
        'organizer': series.organizer.username,
        'organizer_id': series.organizer_id,
        'timezone': series.timezone,
        'color': series.color or '#3B82F6',
        'rrule': series.rrule,
        'shared_with': list(series.shared_with.values_list('id', flat=True)),
        'created_at': series.created_at.isoformat() if series.created_at else None,
        'updated_at': series.updated_at.isoformat() if series.updated_at else None,
    }
