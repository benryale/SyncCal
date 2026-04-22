from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0009_eventseries_dtstart_duration_notnull'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='eventseries',
            name='start_date',
        ),
        migrations.RemoveField(
            model_name='eventseries',
            name='end_date',
        ),
    ]
