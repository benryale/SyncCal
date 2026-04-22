from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0008_eventseries_populate_dtstart_duration'),
    ]

    operations = [
        migrations.AlterField(
            model_name='eventseries',
            name='dtstart',
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name='eventseries',
            name='duration',
            field=models.DurationField(),
        ),
    ]
