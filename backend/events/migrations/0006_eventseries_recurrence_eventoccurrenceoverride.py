import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0005_rename_event_to_eventseries'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventseries',
            name='rrule',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='eventseries',
            name='timezone',
            field=models.CharField(default='UTC', max_length=63),
        ),
        migrations.CreateModel(
            name='EventOccurrenceOverride',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recurrence_id', models.DateTimeField()),
                ('is_cancelled', models.BooleanField(default=False)),
                ('title', models.CharField(blank=True, max_length=150, null=True)),
                ('start_date', models.DateTimeField(blank=True, null=True)),
                ('end_date', models.DateTimeField(blank=True, null=True)),
                ('priority', models.IntegerField(blank=True, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('location', models.CharField(blank=True, max_length=255, null=True)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='events.category')),
                ('series', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='overrides', to='events.eventseries')),
            ],
            options={
                'unique_together': {('series', 'recurrence_id')},
            },
        ),
    ]
