import json
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from ..permissions import CanViewPortalLogs
from submissions.models import (
    LearnerSubmission,
    SubmissionProcessLog,
)
from celery import current_app

from submissions.audit import record_submission_event


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

        if source == "queue":
            return self._queue_logs(request, lines)

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

    def _queue_logs(self, request, lines):
        queryset = (
            LearnerSubmission.objects
            .filter(
                status__in=[
                    LearnerSubmission.Status.UPLOADED,
                    LearnerSubmission.Status.PROCESSING,
                ],
            )
            .select_related(
                "learner",
                "assignment_level",
                "assignment_level__assignment",
                "context",
                "context__cohort",
            )
            .order_by("submitted_at")
        )

        submissions = list(queryset[:lines])

        queued_count = sum(
            1
            for submission in submissions
            if submission.status
            == LearnerSubmission.Status.UPLOADED
        )

        processing_count = sum(
            1
            for submission in submissions
            if submission.status
            == LearnerSubmission.Status.PROCESSING
        )


        now = timezone.now()
        formatted_lines = []

        for submission in submissions:
            elapsed = now - submission.submitted_at
            elapsed_seconds = int(elapsed.total_seconds())

            if elapsed_seconds >= 3600:
                age_state = "danger"
            elif elapsed_seconds >= 1800:
                age_state = "warning"
            else:
                age_state = "normal"

            hours, remainder = divmod(
                elapsed_seconds,
                3600,
            )
            minutes, seconds = divmod(
                remainder,
                60,
            )

            if hours > 0:
                elapsed_display = (
                    f"{hours}h {minutes}m {seconds}s"
                )
            elif minutes > 0:
                elapsed_display = (
                    f"{minutes}m {seconds}s"
                )
            else:
                elapsed_display = f"{seconds}s"

            learner = submission.learner

            learner_display = (
                learner.email
                or learner.username
            )

            assignment = (
                submission.assignment_level.assignment
            )

            cohort = submission.context.cohort

            timestamp = timezone.localtime(
                submission.submitted_at,
            ).isoformat(timespec="seconds")

            parts = [
                timestamp,
                f"status={submission.status}",
                f"waiting={elapsed_display}",
                f"age_state={age_state}",
                f"cohort={cohort.cohort_code} ({cohort.cohort_name})",
                (
                    "assignment="
                    f"{assignment.assignment_code}"
                ),
                (
                    "track="
                    f"{submission.assignment_level.level_code}"
                ),
                f"learner={learner_display}",
                f"attempt={submission.attempt_number}",
                f"submission={submission.id}",
            ]

            formatted_lines.append(
                " | ".join(parts)
            )

        return Response(
        {
            "source": "queue",
            "lines": formatted_lines,
            "queue_summary": {
                "queued": queued_count,
                "processing": processing_count,
                "total": len(submissions),
            },
            "message": (
                None
                if formatted_lines
                else "No queued or processing submissions."
            ),
        },
        status=status.HTTP_200_OK,
    )

    def post(self, request):
        submission_id = str(
            request.data.get("submission_id", "")
        ).strip()

        action = str(
            request.data.get("action", "")
        ).strip()

        if not submission_id:
            return Response(
                {"detail": "Submission ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action not in {
            "terminate",
            "terminate_requeue",
        }:
            return Response(
                {"detail": "Invalid action."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            submission = LearnerSubmission.objects.get(
                id=submission_id
            )
        except (LearnerSubmission.DoesNotExist, ValueError):
            return Response(
                {"detail": "Submission was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if submission.status != LearnerSubmission.Status.PROCESSING:
            return Response(
                {
                    "detail": (
                        "Only submissions currently marked "
                        "as processing can be terminated."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_task_id = None

        try:
            inspector = current_app.control.inspect()
            active_workers = inspector.active() or {}

            for worker_tasks in active_workers.values():
                for task in worker_tasks:
                    if (
                        task.get("name")
                        != "submissions.tasks.grade_submission_task"
                    ):
                        continue

                    args = task.get("args") or []

                    if args and str(args[0]) == submission_id:
                        active_task_id = task.get("id")
                        break

                if active_task_id:
                    break

        except Exception:
            active_task_id = None

        if active_task_id:
            current_app.control.revoke(
                active_task_id,
                terminate=True,
                signal="SIGTERM",
            )

        if action == "terminate":
            submission.status = LearnerSubmission.Status.CANCELLED
            submission.save(update_fields=["status"])

            record_submission_event(
                submission,
                stage="admin_recovery",
                status="warning",
                event_code="ADMIN_PROCESSING_TERMINATED",
                message="Processing submission was terminated by an administrator.",
                details={
                    "celery_task_id": active_task_id,
                    "active_task_found": bool(active_task_id),
                    "performed_by": (
                        request.user.email
                        or request.user.username
                    ),
                },
            )

            return Response(
                {
                    "detail": "Processing submission terminated.",
                    "submission_id": submission_id,
                    "celery_task_id": active_task_id,
                    "status": submission.status,
                },
                status=status.HTTP_200_OK,
            )

        if submission.final_score is not None:
            return Response(
                {
                    "detail": (
                        "This submission already has a score "
                        "and cannot be automatically requeued."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if submission.completed_at is not None:
            return Response(
                {
                    "detail": (
                        "This submission already has a completion "
                        "timestamp and cannot be automatically requeued."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if submission.criterion_results.exists():
            return Response(
                {
                    "detail": (
                        "This submission already has criterion results "
                        "and cannot be automatically requeued."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission.status = LearnerSubmission.Status.UPLOADED
        submission.save(update_fields=["status"])

        result = current_app.send_task(
            "submissions.tasks.grade_submission_task",
            args=[submission_id],
        )

        record_submission_event(
            submission,
            stage="admin_recovery",
            status="started",
            event_code="ADMIN_PROCESSING_REQUEUED",
            message=(
                "Processing submission was terminated "
                "and requeued by an administrator."
            ),
            details={
                "previous_celery_task_id": active_task_id,
                "new_celery_task_id": result.id,
                "active_task_found": bool(active_task_id),
                "performed_by": (
                    request.user.email
                    or request.user.username
                ),
            },
        )

        return Response(
            {
                "detail": (
                    "Processing submission terminated and requeued."
                ),
                "submission_id": submission_id,
                "previous_celery_task_id": active_task_id,
                "new_celery_task_id": result.id,
                "status": submission.status,
            },
            status=status.HTTP_200_OK,
        )