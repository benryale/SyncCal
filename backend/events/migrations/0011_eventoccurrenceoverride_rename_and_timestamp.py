import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0010_eventseries_remove_legacy_date_fields'),
    ]

    operations = [
        migrations.RenameField(
            model_name='eventoccurrenceoverride',
            old_name='title',
            new_name='title_override',
        ),
        migrations.RenameField(
            model_name='eventoccurrenceoverride',
            old_name='start_date',
            new_name='start_override',
        ),
        migrations.RenameField(
            model_name='eventoccurrenceoverride',
            old_name='end_date',
            new_name='end_override',
        ),
        migrations.RenameField(
            model_name='eventoccurrenceoverride',
            old_name='priority',
            new_name='priority_override',
        ),
        migrations.RenameField(
            model_name='eventoccurrenceoverride',
            old_name='description',
            new_name='description_override',
        ),
        migrations.RenameField(
            model_name='eventoccurrenceoverride',
            old_name='location',
            new_name='location_override',
        ),
        migrations.RemoveField(
            model_name='eventoccurrenceoverride',
            name='category',
        ),
        migrations.AddField(
            model_name='eventoccurrenceoverride',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='eventoccurrenceoverride',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
