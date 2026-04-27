from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0011_eventoccurrenceoverride_rename_and_timestamp'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventseries',
            name='color',
            field=models.CharField(max_length=7, default='#3B82F6', blank=True),
        ),
    ]
