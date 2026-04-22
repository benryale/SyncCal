from django.db import migrations
from django.db.models import DurationField, ExpressionWrapper, F


def populate_dtstart_duration(apps, schema_editor):
    EventSeries = apps.get_model('events', 'EventSeries')
    EventSeries.objects.filter(rrule='').update(rrule=None)
    EventSeries.objects.update(
        dtstart=F('start_date'),
        duration=ExpressionWrapper(
            F('end_date') - F('start_date'),
            output_field=DurationField(),
        ),
    )


def reverse_populate(apps, schema_editor):
    apps.get_model('events', 'EventSeries').objects.all().update(dtstart=None, duration=None)


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0007_eventseries_add_series_fields'),
    ]

    operations = [
        migrations.RunPython(populate_dtstart_duration, reverse_populate),
    ]
