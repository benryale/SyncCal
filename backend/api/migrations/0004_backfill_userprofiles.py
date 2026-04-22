from django.conf import settings
from django.db import migrations


def backfill_profiles(apps, schema_editor):
    # use historical models not api.models
    User = apps.get_model(settings.AUTH_USER_MODEL)
    UserProfile = apps.get_model('api', 'UserProfile')

    existing_user_ids = set(UserProfile.objects.values_list('user_id', flat=True))
    missing = User.objects.exclude(id__in=existing_user_ids)
    UserProfile.objects.bulk_create(
        [UserProfile(user_id=u.id, timezone='UTC') for u in missing]
    )


def delete_all_profiles(apps, schema_editor):
    UserProfile = apps.get_model('api', 'UserProfile')
    UserProfile.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_userprofile'),
    ]

    operations = [
        migrations.RunPython(backfill_profiles, reverse_code=delete_all_profiles),
    ]
