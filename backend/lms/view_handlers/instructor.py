
from django.http import FileResponse
from rest_framework.response import Response
from rest_framework.views import APIView


from django.shortcuts import get_object_or_404
from submissions.models import  LearnerSubmission
from submissions.audit import serialize_grading_audit, serialize_process_logs
from rest_framework.permissions import IsAuthenticated

from django.conf import settings
from django.utils import timezone

import logging
from lms.models import AssessmentMapping

from django.utils.dateparse import parse_datetime
from django.db import transaction
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from config.celery import app as celery_app
from grading.models import CriterionResult, RubricBand, RubricCriterion
from grading.services.submission_grader import determine_overall_band
from submissions.audit import record_submission_event

from rest_framework import status

logger = logging.getLogger(__name__)



class InstructorMappingDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_mapping(self, request, mapping_id):
        mapping = get_object_or_404(
            AssessmentMapping.objects.select_related(
                "cohort",
                "assignment",
            ),
            id=mapping_id,
            is_active=True,
        )

        session_mapping_id = request.session.get(
            "lti_mapping_id"
        )
        is_instructor = request.session.get(
            "lti_is_instructor",
            False,
        )

        if (
            not request.user.is_superuser
            and (
                not is_instructor
                or session_mapping_id != str(mapping.id)
            )
        ):
            return None, Response(
                {
                    "detail": (
                        "Instructor access is required "
                        "for this assessment."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return mapping, None

    def get(self, request, mapping_id):
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        lms_due_date = mapping.due_date

        submissions = (
            LearnerSubmission.objects
            .filter(
                context__cohort=mapping.cohort,
                assignment_level__assignment=mapping.assignment,
            )
            .select_related(
                "learner",
                "assignment_level",
            )
            .prefetch_related(
                "criterion_results__rubric_criterion",
                "process_logs",
            )
            .order_by(
                "learner__username",
                "-attempt_number",
            )
        )

        learners = {}

        for submission in submissions:
            learner = submission.learner
            learner_key = str(learner.id)

            if learner_key not in learners:
                learners[learner_key] = {
                    "id": learner_key,
                    "learner_id": learner.username,
                    "name": (
                        learner.get_full_name()
                        or learner.username
                    ),
                    "email": learner.email,
                    "attempts": [],
                }

            if submission.status in (
                LearnerSubmission.Status.COMPLETED,
            ):
                display_status = "Graded"
            elif submission.status in (
                LearnerSubmission.Status.ERROR,
            ):
                display_status = "Not Graded"
            elif submission.status in (
                LearnerSubmission.Status.UPLOADED,
                LearnerSubmission.Status.PROCESSING,
            ):
                display_status = "Processing"
            elif submission.status == "manual_review":
                display_status = "Manual Review"
            else:
                display_status = (
                    submission.get_status_display()
                )

            learners[learner_key]["attempts"].append(
                {
                    "id": str(submission.id),
                    "attempt_number": submission.attempt_number,
                    "level_code": (
                        submission.assignment_level.level_code
                    ),
                    "level_name": (
                        submission.assignment_level.display_name
                    ),
                    "status": submission.status,
                    "status_display": display_status,
                    "final_score": (
                        str(submission.final_score)
                        if submission.final_score is not None
                        else None
                    ),
                    "maximum_score": (
                        str(submission.maximum_score)
                        if submission.maximum_score is not None
                        else None
                    ),
                    "achieved_band": submission.achieved_band,
                    "feedback": submission.feedback,
                    "original_filename": (
                        submission.original_filename
                    ),
                    "has_submitted_file": bool(
                        submission.submitted_file
                    ),
                    "submitted_at": (
                        submission.submitted_at
                    ),
                    "completed_at": (
                        submission.completed_at
                    ),
                    "grading_audit": serialize_grading_audit(
                        submission
                    ),
                    "process_logs": serialize_process_logs(
                        submission
                    ),
                    "is_manual_override": any(
                        log.event_code == "FACULTY_OVERRIDE_CREATED"
                        for log in submission.process_logs.all()
                    ),
                    "manual_override_by": next(
                        (
                            log.details.get("faculty_name")
                            for log in submission.process_logs.all()
                            if (
                                log.event_code == "FACULTY_OVERRIDE_CREATED"
                                and isinstance(log.details, dict)
                                and log.details.get("faculty_name")
                            )
                        ),
                        None,
                    ),
                    "criterion_results": [
                        {
                            "id": str(result.id),
                            "rubric_criterion": str(
                                result.rubric_criterion_id
                            ),
                            "criterion_code": (
                                result.rubric_criterion.criterion_code
                            ),
                            "criterion_title": (
                                result.rubric_criterion.title
                            ),
                            "awarded_marks": str(
                                result.awarded_marks
                            ),
                            "maximum_score": str(
                                result.rubric_criterion.maximum_score
                            ),
                            "achievement_band": (
                                result.achievement_band
                            ),
                            "feedback": result.feedback,
                        }
                        for result
                        in submission.criterion_results.all()
                    ],
                    "configured_criteria": [
                        {
                            "rubric_criterion": str(criterion.id),
                            "criterion_code": criterion.criterion_code,
                            "criterion_title": criterion.title,
                            "maximum_score": str(criterion.maximum_score),
                        }
                        for criterion in RubricCriterion.objects.filter(
                            assignment_level=submission.assignment_level,
                        ).order_by("sequence")
                    ],
                }
            )

        return Response(
            {
                "mapping": {
                    "id": str(mapping.id),
                    "cohort_code": (
                        mapping.cohort.cohort_code
                    ),
                    "cohort_name": (
                        mapping.cohort.cohort_name
                    ),
                    "assignment_code": (
                        mapping.assignment.assignment_code
                    ),
                    "assignment_title": (
                        mapping.assignment.assignment_title
                    ),
                    "due_date": (
                        lms_due_date.isoformat()
                        if lms_due_date
                        else None
                    ),
                    "deadline_passed": (
                        lms_due_date is not None
                        and timezone.now() > lms_due_date
                    ),
                    "lms_platform_url": settings.LTI_PLATFORM_ISSUER.rstrip("/"),
                    "lms_course_id": mapping.external_context_id,
                    "lms_resource_link_id": mapping.external_resource_link_id,
                    "show_result_to_learner": mapping.show_result_to_learner,
                },
                "learners": list(learners.values()),
            }
        )

    def patch(self, request, mapping_id):
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        # Learner result visibility update.
        if "show_result_to_learner" in request.data:
            show_result_to_learner = request.data.get(
                "show_result_to_learner"
            )

            if not isinstance(show_result_to_learner, bool):
                return Response(
                    {
                        "detail": (
                            "show_result_to_learner must be true or false."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            mapping.show_result_to_learner = (
                show_result_to_learner
            )
            mapping.updated_by = request.user
            mapping.save(
                update_fields=[
                    "show_result_to_learner",
                    "updated_by",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "show_result_to_learner":
                        mapping.show_result_to_learner,
                },
                status=status.HTTP_200_OK,
            )

        # Existing LMS due-date sync continues below.
        course_id = request.data.get("course_id")
        resource_link_id = request.data.get(
            "resource_link_id"
        )

        if not course_id or not resource_link_id:
            return Response(
                {
                    "detail": (
                        "course_id and resource_link_id are required "
                        "for LMS due-date sync."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if course_id != mapping.external_context_id:
            return Response(
                {
                    "detail": (
                        "The LMS course does not match this assessment mapping."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        if resource_link_id != mapping.external_resource_link_id:
            return Response(
                {
                    "detail": (
                        "The LMS resource does not match this assessment mapping."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        due_date_value = request.data.get("due_date")

        parsed_due_date = None

        if due_date_value not in (None, ""):
            if not isinstance(due_date_value, str):
                return Response(
                    {
                        "detail": (
                            "LMS due date must be an ISO-8601 string or null."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            parsed_due_date = parse_datetime(
                due_date_value
            )

            if parsed_due_date is None:
                return Response(
                    {
                        "detail": (
                            "Unable to parse the LMS due date."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if timezone.is_naive(parsed_due_date):
                parsed_due_date = timezone.make_aware(
                    parsed_due_date
                )

        if mapping.due_date != parsed_due_date:
            mapping.due_date = parsed_due_date
            mapping.updated_by = request.user
            mapping.save(
                update_fields=[
                    "due_date",
                    "updated_by",
                    "updated_at",
                ]
            )

        return Response(
            {
                "id": str(mapping.id),
                "due_date": (
                    mapping.due_date.isoformat()
                    if mapping.due_date
                    else None
                ),
                "deadline_passed": (
                    mapping.due_date is not None
                    and timezone.now() > mapping.due_date
                ),
            },
            status=status.HTTP_200_OK,
        )


class InstructorSubmissionOverrideView(
    InstructorMappingDashboardView
):
    """Create a new completed attempt from an instructor manual override.

    The override reuses the latest attempt's retained file reference, skips
    extraction/task mapping/AI grading, calculates criterion and overall bands
    from the configured rubric ranges, then queues the existing AGS passback.
    """

    http_method_names = ["post", "options"]

    @staticmethod
    def _criterion_band(criterion, awarded_marks):
        maximum_score = Decimal(str(criterion.maximum_score))
        if maximum_score <= 0:
            raise ValueError(
                f"Criterion {criterion.criterion_code} has an invalid maximum score."
            )

        percentage = (
            (awarded_marks / maximum_score) * Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        matching_bands = list(
            RubricBand.objects.filter(
                rubric_criterion=criterion,
                minimum_percentage__lte=percentage,
                maximum_percentage__gte=percentage,
            ).order_by("sequence")
        )

        if not matching_bands:
            raise ValueError(
                f"No grading band is configured for {criterion.criterion_code} "
                f"at {percentage}%."
            )

        band_codes = {band.band_code for band in matching_bands}
        if len(band_codes) != 1:
            raise ValueError(
                f"Multiple grading bands match {criterion.criterion_code} "
                f"at {percentage}%."
            )

        return matching_bands[0].band_code

    def post(self, request, mapping_id, submission_id):
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        if "show_result_to_learner" in request.data:
            show_result_to_learner = request.data.get(
                "show_result_to_learner"
            )

            if not isinstance(show_result_to_learner, bool):
                return Response(
                    {
                        "detail": (
                            "show_result_to_learner must be true or false."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            mapping.show_result_to_learner = show_result_to_learner
            mapping.updated_by = request.user
            mapping.save(
                update_fields=[
                    "show_result_to_learner",
                    "updated_by",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "show_result_to_learner":
                        mapping.show_result_to_learner,
                },
                status=status.HTTP_200_OK,
            )

        source_submission = get_object_or_404(
            LearnerSubmission.objects.select_related(
                "learner",
                "context",
                "context__cohort",
                "assignment_level",
                "assignment_level__assignment",
            ).prefetch_related(
                "criterion_results__rubric_criterion",
            ),
            id=submission_id,
            context__cohort=mapping.cohort,
            assignment_level__assignment=mapping.assignment,
        )

        allowed_override_statuses = {
            LearnerSubmission.Status.UPLOADED,
            LearnerSubmission.Status.PROCESSING,
            LearnerSubmission.Status.COMPLETED,
            LearnerSubmission.Status.ERROR,
            LearnerSubmission.Status.MANUAL_REVIEW,
        }

        if source_submission.status not in allowed_override_statuses:
            return Response(
                {
                    "detail": (
                        "This submission cannot be manually reviewed "
                        "in its current status."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        criteria_payload = request.data.get("criteria")
        overall_feedback = request.data.get("overall_feedback", "")

        if not isinstance(criteria_payload, list) or not criteria_payload:
            return Response(
                {"detail": "All rubric criteria and manual scores are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(overall_feedback, str) or not overall_feedback.strip():
            return Response(
                {"detail": "Overall feedback is required for a faculty override."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment_level = source_submission.assignment_level
        configured_criteria = list(
            RubricCriterion.objects.filter(
                assignment_level=assignment_level,
            ).order_by("sequence")
        )
        criteria_by_id = {str(item.id): item for item in configured_criteria}

        received_ids = [
            str(item.get("rubric_criterion", ""))
            for item in criteria_payload
            if isinstance(item, dict)
        ]

        if (
            len(received_ids) != len(configured_criteria)
            or len(set(received_ids)) != len(received_ids)
            or set(received_ids) != set(criteria_by_id)
        ):
            return Response(
                {"detail": "Submit exactly one manual result for every configured criterion."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated_results = []
        total_earned = Decimal("0.00")
        total_maximum = Decimal("0.00")

        for item in criteria_payload:
            criterion_id = str(item.get("rubric_criterion"))
            criterion = criteria_by_id[criterion_id]
            feedback = item.get("feedback", "")

            if not isinstance(feedback, str) or not feedback.strip():
                return Response(
                    {
                        "detail": (
                            f"Feedback is required for {criterion.criterion_code}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                awarded_marks = Decimal(str(item.get("awarded_marks"))).quantize(
                    Decimal("0.01"),
                    rounding=ROUND_HALF_UP,
                )
            except (InvalidOperation, TypeError, ValueError):
                return Response(
                    {"detail": f"Enter a valid score for {criterion.criterion_code}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            maximum_score = Decimal(str(criterion.maximum_score))
            if awarded_marks < 0 or awarded_marks > maximum_score:
                return Response(
                    {
                        "detail": (
                            f"{criterion.criterion_code} must be between 0 and "
                            f"{maximum_score}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                achievement_band = self._criterion_band(
                    criterion,
                    awarded_marks,
                )
            except ValueError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_409_CONFLICT,
                )

            total_earned += awarded_marks
            total_maximum += maximum_score
            validated_results.append(
                (criterion, awarded_marks, achievement_band, feedback.strip())
            )

        if total_maximum <= 0:
            return Response(
                {"detail": "The configured rubric maximum score must be greater than zero."},
                status=status.HTTP_409_CONFLICT,
            )

        overall_percentage = float(
            ((total_earned / total_maximum) * Decimal("100")).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
        )

        try:
            achieved_band = determine_overall_band(
                assignment_level,
                overall_percentage,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            locked_attempts = list(
                LearnerSubmission.objects.select_for_update()
                .filter(
                    learner=source_submission.learner,
                    context__cohort=mapping.cohort,
                    assignment_level__assignment=mapping.assignment,
                )
                .order_by("-attempt_number", "-submitted_at")
            )

            latest_submission = locked_attempts[0] if locked_attempts else None
            if latest_submission is None or latest_submission.id != source_submission.id:
                return Response(
                    {
                        "detail": (
                            "A newer attempt now exists. Refresh the instructor view "
                            "before applying a grade override."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            new_submission = LearnerSubmission.objects.create(
                context=source_submission.context,
                learner=source_submission.learner,
                assignment_level=source_submission.assignment_level,
                submission_track=source_submission.submission_track,
                submitted_file=(
                    source_submission.submitted_file.name
                    if source_submission.submitted_file
                    else ""
                ),
                original_filename=source_submission.original_filename,
                attempt_number=source_submission.attempt_number + 1,
                status=LearnerSubmission.Status.COMPLETED,
                final_score=total_earned.quantize(Decimal("0.01")),
                maximum_score=total_maximum.quantize(Decimal("0.01")),
                achieved_band=achieved_band,
                feedback=overall_feedback.strip(),
                completed_at=timezone.now(),
            )

            CriterionResult.objects.bulk_create([
                CriterionResult(
                    submission=new_submission,
                    rubric_criterion=criterion,
                    awarded_marks=awarded_marks,
                    achievement_band=achievement_band,
                    feedback=feedback,
                )
                for (
                    criterion,
                    awarded_marks,
                    achievement_band,
                    feedback,
                ) in validated_results
            ])

            record_submission_event(
                new_submission,
                stage="manual_override",
                status="success",
                event_code="FACULTY_OVERRIDE_CREATED",
                message="Faculty created a manual grade override from the latest attempt.",
                details={
                    "source_submission_id": str(source_submission.id),
                    "source_attempt_number": source_submission.attempt_number,
                    "faculty_user_id": str(request.user.id),
                    "faculty_name": (
                        request.user.get_full_name() or request.user.username
                    ),
                    "previous_final_score": (
                        str(source_submission.final_score)
                        if source_submission.final_score is not None
                        else None
                    ),
                    "new_final_score": str(new_submission.final_score),
                    "maximum_score": str(new_submission.maximum_score),
                    "overall_percentage": overall_percentage,
                    "achieved_band": achieved_band,
                },
            )

        ags_queued = True
        try:
            celery_app.send_task(
                "submissions.tasks.push_submission_grade_task",
                args=[str(new_submission.id)],
            )
        except Exception as exc:
            ags_queued = False
            logger.exception(
                "Unable to queue AGS passback for faculty override %s",
                new_submission.id,
            )
            record_submission_event(
                new_submission,
                stage="grade_posting",
                status="warning",
                event_code="AGS_OVERRIDE_QUEUE_ERROR",
                message="The faculty override was saved, but LMS grade posting could not be queued.",
                details={
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
            )

        return Response(
            {
                "id": str(new_submission.id),
                "attempt_number": new_submission.attempt_number,
                "final_score": str(new_submission.final_score),
                "maximum_score": str(new_submission.maximum_score),
                "overall_percentage": overall_percentage,
                "achieved_band": new_submission.achieved_band,
                "feedback": new_submission.feedback,
                "ags_queued": ags_queued,
            },
            status=status.HTTP_201_CREATED,
        )


class InstructorSubmissionDownloadView(
    InstructorMappingDashboardView
):
    """Download only the latest retained learner submission file."""

    http_method_names = ["get", "head", "options"]

    def get(self, request, mapping_id, submission_id):
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        submission = get_object_or_404(
            LearnerSubmission.objects.select_related(
                "learner",
                "context",
                "assignment_level",
            ),
            id=submission_id,
            context__cohort=mapping.cohort,
            assignment_level__assignment=mapping.assignment,
        )

        latest_submission = (
            LearnerSubmission.objects
            .filter(
                learner=submission.learner,
                context__cohort=mapping.cohort,
                assignment_level__assignment=mapping.assignment,
            )
            .order_by(
                "-attempt_number",
                "-submitted_at",
            )
            .first()
        )

        if (
            latest_submission is None
            or latest_submission.id != submission.id
        ):
            return Response(
                {
                    "detail": (
                        "Only the learner's latest submission "
                        "file is available for download."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not submission.submitted_file:
            return Response(
                {
                    "detail": (
                        "The latest submission file is no longer "
                        "available."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            file_handle = submission.submitted_file.open("rb")
        except (FileNotFoundError, OSError):
            return Response(
                {
                    "detail": (
                        "The latest submission file could not be found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            file_handle,
            as_attachment=True,
            filename=(
                submission.original_filename
                or f"submission-{submission.id}"
            ),
        )
