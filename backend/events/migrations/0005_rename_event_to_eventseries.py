from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_eventinvite'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='Event',
            new_name='EventSeries',
        ),
    ]
