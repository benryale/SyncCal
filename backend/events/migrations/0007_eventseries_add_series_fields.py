import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0006_eventseries_recurrence_eventoccurrenceoverride'),
    ]

    operations = [
        migrations.AlterField(
            model_name='eventseries',
            name='rrule',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='eventseries',
            name='timezone',
            field=models.CharField(default='UTC', max_length=64),
        ),
        migrations.AddField(
            model_name='eventseries',
            name='dtstart',
            field=models.DateTimeField(null=True),
        ),
        migrations.AddField(
            model_name='eventseries',
            name='duration',
            field=models.DurationField(null=True),
        ),
        migrations.AddField(
            model_name='eventseries',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='eventseries',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
