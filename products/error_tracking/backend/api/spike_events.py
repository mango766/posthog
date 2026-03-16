from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets

from posthog.schema import ProductKey

from posthog.api.routing import TeamAndOrgViewSetMixin

from products.error_tracking.backend.models import ErrorTrackingSpikeEvent


class ErrorTrackingSpikeEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorTrackingSpikeEvent
        fields = [
            "id",
            "issue_id",
            "detected_at",
            "computed_baseline",
            "current_bucket_value",
            "issue_name",
            "issue_description",
        ]
        read_only_fields = fields


@extend_schema(tags=[ProductKey.ERROR_TRACKING])
class ErrorTrackingSpikeEventViewSet(TeamAndOrgViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    scope_object = "error_tracking"
    serializer_class = ErrorTrackingSpikeEventSerializer
    queryset = ErrorTrackingSpikeEvent.objects.all()

    def safely_get_queryset(self, queryset):
        qs = queryset.filter(team_id=self.team.id).order_by("-detected_at")
        issue_id = self.request.query_params.get("issue_id")
        if issue_id:
            qs = qs.filter(issue_id=issue_id)
        return qs
