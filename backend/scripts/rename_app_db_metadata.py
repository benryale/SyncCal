"""Update django_migrations.app and django_content_type.app_label from 'api'
to 'accounts' after the app rename. Idempotent."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "synccal.settings")

import django
django.setup()

from django.db import connection, transaction


def main() -> int:
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM django_migrations WHERE app = 'api'")
        migrations_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM django_content_type WHERE app_label = 'api'")
        content_types_count = cursor.fetchone()[0]

    if migrations_count == 0 and content_types_count == 0:
        print("Nothing to do.")
        return 0

    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("UPDATE django_migrations SET app = 'accounts' WHERE app = 'api'")
            cursor.execute("UPDATE django_content_type SET app_label = 'accounts' WHERE app_label = 'api'")

    print(f"Updated {migrations_count} django_migrations row(s), "
          f"{content_types_count} django_content_type row(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
