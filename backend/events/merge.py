"""Field-scoped merge taxonomy per U4. Five collision fields: time, title,
description, location, priority. `time` is a coupled group — override-layer
{start_override, end_override}, series-layer {dtstart, timezone, duration}.
is_cancelled and rrule are NOT in the collision set."""

COLLISION_FIELDS = ('time', 'title', 'description', 'location', 'priority')

_OVERRIDE_COLUMNS = {
    'time':        ('start_override', 'end_override'),
    'title':       ('title_override',),
    'description': ('description_override',),
    'location':    ('location_override',),
    'priority':    ('priority_override',),
}

_SERIES_COLUMNS = {
    'time':        ('dtstart', 'timezone', 'duration'),
    'title':       ('title',),
    'description': ('description',),
    'location':    ('location',),
    'priority':    ('priority',),
}


def override_has_field(override, field):
    """True iff the override row has any non-null column in this collision field.
    For `time`, either start_override or end_override being non-null counts."""
    return any(
        getattr(override, c) is not None
        for c in _OVERRIDE_COLUMNS[field]
    )


def override_value_for_field(override, field):
    """Returns the override's value for this field as a comparable tuple.
    Caller must check override_has_field first — this does not validate.
    For `time`, returns (start_override, end_override); for others, returns
    a single-element tuple."""
    return tuple(getattr(override, c) for c in _OVERRIDE_COLUMNS[field])


def series_value_for_field(series, field):
    """Returns the series template's value for this field as a comparable tuple."""
    return tuple(getattr(series, c) for c in _SERIES_COLUMNS[field])


def bulk_edit_sets_field(old_template_values, new_template_values, field):
    """U4's 'B sets F' predicate at the series level: True iff the post-edit
    template value differs from the pre-edit template value. Takes dicts of
    {column_name: value} for the fields being compared."""
    for col in _SERIES_COLUMNS[field]:
        if old_template_values.get(col) != new_template_values.get(col):
            return True
    return False


def clear_override_field(override, field):
    """Sets the override's columns for this field to NULL. Does not save.
    Caller is responsible for saving or deleting the override row."""
    for c in _OVERRIDE_COLUMNS[field]:
        setattr(override, c, None)


def override_is_empty(override):
    """True iff the override has no non-null override columns and is not cancelled.
    Such a row is redundant and can be deleted."""
    if override.is_cancelled:
        return False
    for field in COLLISION_FIELDS:
        if override_has_field(override, field):
            return False
    return True
