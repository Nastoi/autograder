from collections import OrderedDict

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from lms.permissions import IsMappingAdmin

from .models import (
    LearnerSubmission,
    SubmissionContext,
    SubmissionProcessLog,
)

from .audit import serialize_grading_audit, serialize_process_logs

from django.db.models import Count, Q
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404

from django.db.models import Exists, OuterRef, Subquery
from courses.models import Cohort


class AdminSubmissionRecordsPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100

class AdminSubmissionRecordsView(APIView):

    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get(self, request):
        manual_review_logs = SubmissionProcessLog.objects.filter(
            submission_id=OuterRef("pk"),
            event_code="FACULTY_OVERRIDE_CREATED",
        )
        submissions = (
            LearnerSubmission.objects
            .select_related(
                "learner",
                "context",
                "context__cohort",
                "assignment_level",
                "assignment_level__assignment",
                "assignment_level__assignment__module",
            )
            .annotate(
                has_manual_review=Exists(manual_review_logs),
                manual_reviewer_name=Subquery(
                    manual_review_logs
                    .order_by("-created_at")
                    .values("details__faculty_name")[:1]
                ),
            )
            .order_by(
                "context__cohort__cohort_code",
                "assignment_level__assignment__assignment_code",
                "learner__username",
                "attempt_number",
                "submitted_at",
            )
        )

        cohort_id = request.query_params.get("cohort_id")
        assignment_id = request.query_params.get("assignment_id")
        search = request.query_params.get("search", "").strip()


        filter_submissions = LearnerSubmission.objects.select_related(
            "context__cohort",
            "assignment_level__assignment",
        )

        cohort_options = list(
            filter_submissions
            .values(
                "context__cohort_id",
                "context__cohort__cohort_code",
                "context__cohort__cohort_name",
            )
            .distinct()
            .order_by("context__cohort__cohort_code")
        )

        assignment_filter_source = filter_submissions

        if cohort_id:
            assignment_filter_source = assignment_filter_source.filter(
                context__cohort_id=cohort_id,
            )

        assignment_options = list(
            assignment_filter_source
            .values(
                "assignment_level__assignment_id",
                "assignment_level__assignment__assignment_code",
                "assignment_level__assignment__assignment_title",
            )
            .distinct()
            .order_by(
                "assignment_level__assignment__assignment_code"
            )
        )

        

        if cohort_id:
            submissions = submissions.filter(
                context__cohort_id=cohort_id,
            )

        if assignment_id:
            submissions = submissions.filter(
                assignment_level__assignment_id=assignment_id,
            )


        if search:
            submissions = submissions.filter(
                Q(learner__username__icontains=search)
                | Q(learner__email__icontains=search)
                | Q(learner__first_name__icontains=search)
                | Q(learner__last_name__icontains=search)
                | Q(context__cohort__cohort_code__icontains=search)
                | Q(context__cohort__cohort_name__icontains=search)
                | Q(
                    assignment_level__assignment__assignment_code__icontains=search
                )
                | Q(
                    assignment_level__assignment__assignment_title__icontains=search
                )
                | Q(original_filename__icontains=search)
            )

        summary = {
            "cohorts": submissions.values(
                "context__cohort_id"
            ).distinct().count(),

            "assignments": submissions.values(
                "assignment_level__assignment_id"
            ).distinct().count(),

            "unique_learners": submissions.values(
                "learner_id"
            ).distinct().count(),

            "total_attempts": submissions.count(),
        }


        # Gradebook learner source:
        # A learner belongs to the local cohort view once an LTI/submission
        # context has been created for that learner and cohort. This lets the
        # Final Gradebook include learners with zero submissions.
        gradebook_contexts = (
            SubmissionContext.objects
            .select_related(
                "learner",
                "cohort",
            )
            .filter(is_active=True)
            .order_by(
                "cohort__cohort_code",
                "learner__username",
            )
        )

        if cohort_id:
            gradebook_contexts = gradebook_contexts.filter(
                cohort_id=cohort_id,
            )

        gradebook_grouped = OrderedDict()

        for context in gradebook_contexts:
            cohort = context.cohort
            learner = context.learner

            cohort_key = str(cohort.id)
            learner_key = str(learner.id)

            if cohort_key not in gradebook_grouped:
                gradebook_grouped[cohort_key] = {
                    "id": cohort_key,
                    "code": cohort.cohort_code,
                    "name": cohort.cohort_name,
                    "learners": OrderedDict(),
                }

            if (
                learner_key
                not in gradebook_grouped[cohort_key]["learners"]
            ):
                gradebook_grouped[cohort_key]["learners"][learner_key] = {
                    "id": learner_key,
                    "learner_id": learner.username,
                    "username": learner.username,
                    "name": (
                        learner.get_full_name()
                        or learner.username
                    ),
                    "email": learner.email,
                }


        cohort_rows = (
            submissions
            .values(
                "context__cohort_id",
                "context__cohort__cohort_code",
                "context__cohort__cohort_name",
            )
            .annotate(
                assignment_count=Count(
                    "assignment_level__assignment_id",
                    distinct=True,
                ),
                unique_learners=Count(
                    "learner_id",
                    distinct=True,
                ),
                total_attempts=Count("id"),
            )
            .order_by(
                "context__cohort__cohort_code"
            )
        )

        paginator = AdminSubmissionRecordsPagination()

        page_cohorts = paginator.paginate_queryset(
            cohort_rows,
            request,
            view=self,
        )

        response_cohorts = [
            {
                "id": str(
                    item["context__cohort_id"]
                ),
                "code": item[
                    "context__cohort__cohort_code"
                ],
                "name": item[
                    "context__cohort__cohort_name"
                ],
                "assignment_count": item[
                    "assignment_count"
                ],
                "unique_learners": item[
                    "unique_learners"
                ],
                "total_attempts": item[
                    "total_attempts"
                ],

                # Nested records deliberately not loaded here.
                "assignments": [],
            }
            for item in page_cohorts
        ]

        response_gradebook_cohorts = []

        for cohort_group in gradebook_grouped.values():
            response_gradebook_cohorts.append(
                {
                    "id": cohort_group["id"],
                    "code": cohort_group["code"],
                    "name": cohort_group["name"],
                    "learners": list(
                        cohort_group["learners"].values()
                    ),
                }
            )

        return Response(
            {
                "count": paginator.page.paginator.count,
                "next": paginator.get_next_link(),
                "previous": paginator.get_previous_link(),
                "page": paginator.page.number,
                "page_size": paginator.get_page_size(request),
                "total_pages": paginator.page.paginator.num_pages,

                "cohorts": response_cohorts,
                "gradebook_cohorts": response_gradebook_cohorts,

                "summary": summary,
                "filter_options": {
                "cohorts": [
                    {
                        "id": str(item["context__cohort_id"]),
                        "code": item["context__cohort__cohort_code"],
                        "name": item["context__cohort__cohort_name"],
                    }
                    for item in cohort_options
                ],
                "assignments": [
                    {
                        "id": str(
                            item["assignment_level__assignment_id"]
                        ),
                        "code": item[
                            "assignment_level__assignment__assignment_code"
                        ],
                        "title": item[
                            "assignment_level__assignment__assignment_title"
                        ],
                    }
                    for item in assignment_options
                ],
            },
            }
        )


class AdminSubmissionCohortDetailView(APIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get(self, request, cohort_id):
        search = request.query_params.get("search", "").strip()
        assignment_id = request.query_params.get("assignment_id")

        submissions = (
            LearnerSubmission.objects
            .filter(
                context__cohort_id=cohort_id,
            )
            .select_related(
                "learner",
                "context",
                "context__cohort",
                "assignment_level",
                "assignment_level__assignment",
            )
            .order_by(
                "assignment_level__assignment__assignment_code",
                "learner__username",
                "attempt_number",
                "submitted_at",
            )
        )

        if assignment_id:
            submissions = submissions.filter(
                assignment_level__assignment_id=assignment_id,
            )

        if search:
            submissions = submissions.filter(
                Q(learner__username__icontains=search)
                | Q(learner__email__icontains=search)
                | Q(learner__first_name__icontains=search)
                | Q(learner__last_name__icontains=search)
                | Q(
                    assignment_level__assignment__assignment_code__icontains=search
                )
                | Q(
                    assignment_level__assignment__assignment_title__icontains=search
                )
                | Q(original_filename__icontains=search)
            )

        cohort = get_object_or_404(
            Cohort,
            id=cohort_id,
        )

        grouped = OrderedDict()

        for submission in submissions:
            level = submission.assignment_level
            assignment = level.assignment
            learner = submission.learner

            assignment_key = str(assignment.id)
            learner_key = str(learner.id)

            if assignment_key not in grouped:
                grouped[assignment_key] = {
                    "id": assignment_key,
                    "code": assignment.assignment_code,
                    "title": assignment.assignment_title,
                    "unique_learners": 0,
                    "total_attempts": 0,
                    "learners": OrderedDict(),
                }

            assignment_group = grouped[assignment_key]

            if learner_key not in assignment_group["learners"]:
                assignment_group["learners"][learner_key] = {
                    "id": learner_key,
                    "learner_id": learner.username,
                    "username": learner.username,
                    "name": (
                        learner.get_full_name()
                        or learner.username
                    ),
                    "email": learner.email,
                    "attempts": [],
                }

            assignment_group["learners"][learner_key]["attempts"].append(
                {
                    "id": str(submission.id),
                    "attempt_number": submission.attempt_number,
                    "level_code": level.level_code,
                    "level_name": level.display_name,
                    "status": submission.status,
                    "status_display": submission.get_status_display(),
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
                    "original_filename": submission.original_filename,
                    "submitted_at": submission.submitted_at,
                    "completed_at": submission.completed_at,

                    # Heavy detail remains lazy-loaded
                    "grading_audit": None,
                    "process_logs": [],
                    "criterion_results": [],
                }
            )

            assignment_group["total_attempts"] += 1

        assignments = []

        for assignment_group in grouped.values():
            learners = list(
                assignment_group["learners"].values()
            )

            assignment_group["unique_learners"] = len(learners)
            assignment_group["learners"] = learners

            assignments.append(assignment_group)

        return Response(
            {
                "id": str(cohort.id),
                "code": cohort.cohort_code,
                "name": cohort.cohort_name,
                "assignments": assignments,
            }
        )

    
class AdminSubmissionRecordDetailView(APIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get(self, request, submission_id):
        submission = get_object_or_404(
            LearnerSubmission.objects
            .select_related(
                "grading_audit",
            )
            .prefetch_related(
                "process_logs",
                "criterion_results__rubric_criterion",
            ),
            id=submission_id,
        )

        return Response(
            {
                "id": str(submission.id),
                "feedback": submission.feedback,
                "grading_audit": serialize_grading_audit(submission),
                "process_logs": serialize_process_logs(submission),
                "criterion_results": [
                    {
                        "id": str(result.id),
                        "rubric_criterion": str(
                            result.rubric_criterion_id
                        ),
                        "criterion_code":
                            result.rubric_criterion.criterion_code,
                        "criterion_title":
                            result.rubric_criterion.title,
                        "awarded_marks": str(
                            result.awarded_marks
                        ),
                        "maximum_score": str(
                            result.rubric_criterion.maximum_score
                        ),
                        "achievement_band":
                            result.achievement_band,
                        "feedback": result.feedback,
                    }
                    for result in submission.criterion_results.all()
                ],
            }
        )

    
class AdminGradebookView(APIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get(self, request):
        cohort_id = request.query_params.get("cohort_id")

        contexts = (
            SubmissionContext.objects
            .select_related(
                "learner",
                "cohort",
            )
            .filter(is_active=True)
            .order_by(
                "cohort__cohort_code",
                "learner__username",
            )
        )

        submissions = (
            LearnerSubmission.objects
            .select_related(
                "learner",
                "context__cohort",
                "assignment_level__assignment",
            )
            .order_by(
                "learner_id",
                "assignment_level__assignment_id",
                "attempt_number",
                "submitted_at",
            )
        )

        if cohort_id:
            contexts = contexts.filter(
                cohort_id=cohort_id,
            )
            submissions = submissions.filter(
                context__cohort_id=cohort_id,
            )

        cohorts = OrderedDict()

        # Include every learner who has an active cohort context,
        # even if they have never submitted anything.
        for context in contexts:
            cohort = context.cohort
            learner = context.learner

            cohort_key = str(cohort.id)
            learner_key = str(learner.id)

            if cohort_key not in cohorts:
                cohorts[cohort_key] = {
                    "id": cohort_key,
                    "code": cohort.cohort_code,
                    "name": cohort.cohort_name,
                    "learners": OrderedDict(),
                }

            if learner_key not in cohorts[cohort_key]["learners"]:
                cohorts[cohort_key]["learners"][learner_key] = {
                    "id": learner_key,
                    "learner_id": learner.username,
                    "username": learner.username,
                    "name": (
                        learner.get_full_name()
                        or learner.username
                    ),
                    "email": learner.email,
                    "assignment_scores": {},
                }

        # Because the queryset is ordered oldest -> newest,
        # later attempts overwrite earlier attempts.
        # The final value is therefore the learner's latest attempt
        # for that assignment.
        for submission in submissions:
            cohort = submission.context.cohort
            learner = submission.learner
            assignment = submission.assignment_level.assignment

            cohort_key = str(cohort.id)
            learner_key = str(learner.id)
            assignment_key = str(assignment.id)

            if cohort_key not in cohorts:
                continue

            learner_data = cohorts[cohort_key]["learners"].get(
                learner_key
            )

            if not learner_data:
                continue

            learner_data["assignment_scores"][assignment_key] = {
                "assignment_id": assignment_key,
                "submission_id": str(submission.id),
                "attempt_number": submission.attempt_number,
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
                "status": submission.status,
                "submitted_at": submission.submitted_at,
            }

        response_cohorts = []

        for cohort in cohorts.values():
            learners = []

            for learner in cohort["learners"].values():
                learner["assignment_scores"] = list(
                    learner["assignment_scores"].values()
                )
                learners.append(learner)

            response_cohorts.append(
                {
                    "id": cohort["id"],
                    "code": cohort["code"],
                    "name": cohort["name"],
                    "learners": learners,
                }
            )

        return Response(
            {
                "cohorts": response_cohorts,
            }
        )