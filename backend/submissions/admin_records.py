from collections import OrderedDict

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from lms.permissions import IsMappingAdmin

from .models import LearnerSubmission, SubmissionContext


class AdminSubmissionRecordsView(APIView):

    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get(self, request):
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

        if cohort_id:
            submissions = submissions.filter(
                context__cohort_id=cohort_id,
            )

        if assignment_id:
            submissions = submissions.filter(
                assignment_level__assignment_id=assignment_id,
            )

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

        grouped = OrderedDict()

        for submission in submissions:
            cohort = submission.context.cohort
            level = submission.assignment_level
            assignment = level.assignment
            learner = submission.learner

            cohort_key = str(cohort.id)
            assignment_key = str(assignment.id)
            learner_key = str(learner.id)

            if cohort_key not in grouped:
                grouped[cohort_key] = {
                    "id": cohort_key,
                    "code": cohort.cohort_code,
                    "name": cohort.cohort_name,
                    "assignments": OrderedDict(),
                }

            cohort_group = grouped[cohort_key]

            if assignment_key not in cohort_group["assignments"]:
                cohort_group["assignments"][assignment_key] = {
                    "id": assignment_key,
                    "code": assignment.assignment_code,
                    "title": assignment.assignment_title,
                    "unique_learners": 0,
                    "total_attempts": 0,
                    "learners": OrderedDict(),
                }

            assignment_group = cohort_group["assignments"][assignment_key]

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
                }
            )

            assignment_group["total_attempts"] += 1

        response_cohorts = []

        for cohort_group in grouped.values():
            response_assignments = []

            for assignment_group in cohort_group["assignments"].values():
                learners = list(
                    assignment_group["learners"].values()
                )

                assignment_group["unique_learners"] = len(learners)
                assignment_group["learners"] = learners
                response_assignments.append(assignment_group)

            cohort_group["assignments"] = response_assignments
            response_cohorts.append(cohort_group)

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
                "cohorts": response_cohorts,
                "gradebook_cohorts": response_gradebook_cohorts,
                "summary": {
                    "cohorts": len(response_cohorts),
                    "assignments": sum(
                        len(cohort["assignments"])
                        for cohort in response_cohorts
                    ),
                    "unique_learners": len(
                        {
                            learner["id"]
                            for cohort in response_cohorts
                            for assignment in cohort["assignments"]
                            for learner in assignment["learners"]
                        }
                    ),
                    "total_attempts": sum(
                        assignment["total_attempts"]
                        for cohort in response_cohorts
                        for assignment in cohort["assignments"]
                    ),
                },
            }
        )
