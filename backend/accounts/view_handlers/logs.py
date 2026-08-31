import json
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from ..permissions import CanViewPortalLogs
from submissions.models import SubmissionProcessLog


class PortalLogView(APIView):
    permission_classes = [CanViewPortalLogs]

    LOG_FILES = {
        "backend": "backend.log",
        "celery": "celery.log",
        "errors": "error.log",
    }

    def _grading_logs(self, request, lines):
        base_queryset = SubmissionProcessLog.objects.all()

        filter_options = {
            "cohorts": list(
                base_queryset.order_by("cohort_code")
                .values_list("cohort_code", flat=True)
                .distinct()
            ),
            "assignments": list(
                base_queryset.order_by("assignment_code")
                .values_list("assignment_code", flat=True)
                .distinct()
            ),
            "learners": list(
                base_queryset.exclude(learner_email="")
                .order_by("learner_email")
                .values_list("learner_email", flat=True)
                .distinct()
            ),
            "attempts": list(
                base_queryset.order_by("attempt_number")
                .values_list("attempt_number", flat=True)
                .distinct()
            ),
            "stages": list(
                base_queryset.order_by("stage")
                .values_list("stage", flat=True)
                .distinct()
            ),
            "statuses": list(
                base_queryset.order_by("status")
                .values_list("status", flat=True)
                .distinct()
            ),
        }

        queryset = base_queryset
        cohort = request.query_params.get("cohort")
        assignment = request.query_params.get("assignment")
        learner = request.query_params.get("learner")
        attempt = request.query_params.get("attempt")
        stage = request.query_params.get("stage")
        event_status = request.query_params.get("status")

        if cohort:
            queryset = queryset.filter(cohort_code=cohort)
        if assignment:
            queryset = queryset.filter(assignment_code=assignment)
        if learner:
            queryset = queryset.filter(learner_email=learner)
        if attempt:
            try:
                queryset = queryset.filter(attempt_number=int(attempt))
            except ValueError:
                return Response(
                    {"detail": "Attempt must be a number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if stage:
            queryset = queryset.filter(stage=stage)
        if event_status:
            queryset = queryset.filter(status=event_status)

        entries = list(queryset.order_by("-created_at")[:lines])
        entries.reverse()

        formatted_lines = []
        for entry in entries:
            timestamp = timezone.localtime(
                entry.created_at
            ).isoformat(timespec="seconds")

            parts = [
                timestamp,
                f"cohort={entry.cohort_code}",
                f"assignment={entry.assignment_code}",
                (
                    f"learner={entry.learner_email}"
                    if entry.learner_email
                    else f"learner={entry.learner_username}"
                ),
                f"attempt={entry.attempt_number}",
                f"submission={entry.submission_id}",
                f"stage={entry.stage}",
                f"status={entry.status}",
            ]

            if entry.event_code:
                parts.append(f"code={entry.event_code}")
            if entry.message:
                parts.append(f"message={entry.message}")
            if entry.details:
                parts.append(
                    "details="
                    + json.dumps(
                        entry.details,
                        ensure_ascii=False,
                        default=str,
                    )
                )

            formatted_lines.append(" | ".join(parts))

        return Response(
            {
                "source": "grading",
                "lines": formatted_lines,
                "grading_filters": filter_options,
                "message": (
                    None
                    if formatted_lines
                    else "No grading-attempt log entries match the current filters."
                ),
            },
            status=status.HTTP_200_OK,
        )

    def get(self, request):
        source = request.query_params.get("source", "backend")

        try:
            lines = int(request.query_params.get("lines", "200"))
        except ValueError:
            lines = 200
        lines = max(1, min(lines, 1000))

        if source == "grading":
            return self._grading_logs(request, lines)

        if source not in self.LOG_FILES:
            return Response(
                {"detail": "Invalid log source."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.conf import settings

        log_path = settings.LOG_DIR / self.LOG_FILES[source]
        if not log_path.exists():
            return Response(
                {
                    "source": source,
                    "lines": [],
                    "message": "No log entries yet.",
                },
                status=status.HTTP_200_OK,
            )

        with log_path.open(
            "r",
            encoding="utf-8",
            errors="replace",
        ) as handle:
            content = handle.readlines()[-lines:]

        return Response(
            {
                "source": source,
                "lines": [
                    line.rstrip("\n")
                    for line in content
                ],
            },
            status=status.HTTP_200_OK,
        )
