from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers
from . import zone_utils
from .models import Category, EventSeries, EventInvite

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class EventInviteSerializer(serializers.ModelSerializer):
    organizer_username = serializers.ReadOnlyField(source='event.organizer.username')

    event_title = serializers.ReadOnlyField(source='event.title')

    event_start = serializers.DateTimeField(source='event.dtstart', read_only=True)
    event_end = serializers.SerializerMethodField()

    def get_event_end(self, obj):
        return zone_utils.add_duration_wallclock(
            obj.event.dtstart, obj.event.duration, obj.event.timezone
        )

    class Meta:
        model = EventInvite
        fields = ['id', 'event', 'user', 'status', 'event_title', 'event_start', 'event_end', 'organizer_username']

class EventSeriesSerializer(serializers.ModelSerializer):
    organizer = serializers.ReadOnlyField(source='organizer.username')
    shared_with = serializers.PrimaryKeyRelatedField(many=True, read_only=True)# tells django to
    # use the primary key of the related objects (users) when serializing the shared_with field, and that this field is read-only (i.e., it cannot be modified through this serializer).

    dtstart = serializers.DateTimeField(required=False)
    duration = serializers.DurationField(required=False)

    # compat shim for Calendar.jsx start_date/end_date
    start_date = serializers.DateTimeField(required=False)
    end_date = serializers.DateTimeField(required=False)

    timezone = serializers.CharField(required=False)

    class Meta:
        model = EventSeries
        fields = [
            'id', 'title', 'category', 'dtstart', 'duration', 'priority',
            'description', 'location', 'organizer', 'shared_with',
            'rrule', 'timezone', 'color', 'created_at', 'updated_at',
            'start_date', 'end_date',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # keep compat fields populated for Calendar.jsx
        data['start_date'] = data['dtstart']
        end_utc = zone_utils.add_duration_wallclock(
            instance.dtstart, instance.duration, instance.timezone
        )
        data['end_date'] = self.fields['dtstart'].to_representation(end_utc)
        return data

    def validate_timezone(self, value):
        try:
            zone_utils.validate_iana_timezone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])
        return value

    def validate(self, data):
        start = data.pop('start_date', None)
        end = data.pop('end_date', None)
        if start is not None and end is not None:
            # compat write path: translate legacy fields into the canonical pair.
            tz_name = data.get('timezone')
            if tz_name is None:
                tz_name = self.instance.timezone if self.instance is not None else 'UTC'
            data['dtstart'] = start
            start_local = zone_utils.utc_to_local_naive(start, tz_name)
            end_local = zone_utils.utc_to_local_naive(end, tz_name)
            data['duration'] = end_local - start_local
        elif start is not None or end is not None:
            raise serializers.ValidationError(
                'start_date and end_date must both be provided together'
            )
        return data
