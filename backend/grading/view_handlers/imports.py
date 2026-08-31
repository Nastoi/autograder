import csv
import io
from decimal import Decimal

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse
from rest_framework.views import APIView


from django.shortcuts import get_object_or_404
from django.db import transaction
from courses.configuration_locks import require_lock_owner

from lms.permissions import IsMappingAdmin




from ..models import (
    RubricCriterion,
    Task,
)

from ..serializers import RubricCriterionSerializer


class AssignmentLevelConfigurationCsvImportView(APIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    ALLOWED_REQUIREMENT_FIELDS = {
        "title",
        "skill_statement_code",
        "skill_statement",
        "objective",
        "scenario",
        "instructions",
        "deliverables",
        "expected_outcome",
    }

    @transaction.atomic
    def post(self, request, assignment_level_id):
        assignment_level = get_object_or_404(
            AssignmentLevel,
            id=assignment_level_id,
        )

        require_lock_owner(
            assignment_level.id,
            request.user,
        )

        upload = request.FILES.get("file")

        if upload is None:
            return DRFResponse(
                {"detail": "CSV file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not upload.name.lower().endswith(".csv"):
            return DRFResponse(
                {"detail": "Please upload a .csv file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            decoded = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return DRFResponse(
                {"detail": "CSV must be UTF-8 encoded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(decoded))
        expected_headers = {
            "record_type",
            "title",
            "skill_statement_code",
            "skill_statement",
            "objective",
            "scenario",
            "instructions",
            "deliverables",
            "expected_outcome",
            "task_code",
            "task_title",
            "task_description",
            "criterion_code",
            "criterion_title",
            "criterion_description",
            "maximum_score",
        }
        actual_headers = set(reader.fieldnames or [])

        if not expected_headers.issubset(actual_headers):
            missing = sorted(expected_headers - actual_headers)
            return DRFResponse(
                {
                    "detail": (
                        "CSV is missing required columns: "
                        + ", ".join(missing)
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        rows = list(reader)

        if not rows:
            return DRFResponse(
                {"detail": "CSV contains no data rows."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requirement_updates = {}
        task_rows = []
        criterion_rows = []
        errors = []
        configuration_row_found = False

        for row_number, row in enumerate(rows, start=2):
            record_type = row.get("record_type", "").strip().lower()

            if not record_type:
                continue

            if record_type == "configuration":
                if configuration_row_found:
                    errors.append(
                        f"Row {row_number}: only one configuration row is allowed."
                    )
                    continue

                configuration_row_found = True

                requirement_updates = {
                    "title": row.get("title", "").strip(),
                    "skill_statement_code": row.get(
                        "skill_statement_code",
                        "",
                    ).strip(),
                    "skill_statement": row.get(
                        "skill_statement",
                        "",
                    ).strip(),
                    "objective": row.get("objective", "").strip(),
                    "scenario": row.get("scenario", "").strip(),
                    "instructions": row.get(
                        "instructions",
                        "",
                    ).strip(),
                    "deliverables": [
                        item.strip()
                        for item in row.get(
                            "deliverables",
                            "",
                        ).split("|")
                        if item.strip()
                    ],
                    "expected_outcome": row.get(
                        "expected_outcome",
                        "",
                    ).strip(),
                }

            elif record_type == "task":
                code = row.get("task_code", "").strip()
                title = row.get("task_title", "").strip()
                description = row.get(
                    "task_description",
                    "",
                ).strip()

                if not code:
                    errors.append(
                        f"Row {row_number}: task_code is required."
                    )
                    continue

                if not title:
                    errors.append(
                        f"Row {row_number}: task_title is required."
                    )
                    continue

                task_rows.append(
                    {
                        "task_code": code,
                        "title": title,
                        "instructions": description,
                    }
                )

            elif record_type == "criterion":
                code = row.get("criterion_code", "").strip()
                title = row.get("criterion_title", "").strip()
                description = row.get(
                    "criterion_description",
                    "",
                ).strip()
                maximum_score = row.get(
                    "maximum_score",
                    "",
                ).strip()

                if not code:
                    errors.append(
                        f"Row {row_number}: criterion_code is required."
                    )
                    continue

                if not title:
                    errors.append(
                        f"Row {row_number}: criterion_title is required."
                    )
                    continue

                if not maximum_score:
                    errors.append(
                        f"Row {row_number}: maximum_score is required."
                    )
                    continue

                try:
                    numeric_maximum_score = Decimal(maximum_score)
                except Exception:
                    errors.append(
                        f"Row {row_number}: invalid maximum_score "
                        f"'{maximum_score}'."
                    )
                    continue

                if numeric_maximum_score <= 0:
                    errors.append(
                        f"Row {row_number}: maximum_score must be "
                        "greater than zero."
                    )
                    continue

                criterion_rows.append(
                    {
                        "criterion_code": code,
                        "title": title,
                        "description": description,
                        "maximum_score": numeric_maximum_score,
                    }
                )

            else:
                errors.append(
                    f"Row {row_number}: record_type must be "
                    "configuration, task, or criterion."
                )

        if not configuration_row_found:
            errors.append(
                "CSV must contain one configuration row."
            )

        task_codes = [row["task_code"].upper() for row in task_rows]
        criterion_codes = [
            row["criterion_code"].upper()
            for row in criterion_rows
        ]

        if len(task_codes) != len(set(task_codes)):
            errors.append("CSV contains duplicate task codes.")

        if len(criterion_codes) != len(set(criterion_codes)):
            errors.append("CSV contains duplicate criterion codes.")

        if errors:
            return DRFResponse(
                {"errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requirements_updated = False

        if requirement_updates:
            for field, value in requirement_updates.items():
                setattr(assignment_level, field, value)

            assignment_level.save(
                update_fields=[
                    *requirement_updates.keys(),
                    "updated_at",
                ]
            )
            requirements_updated = True

        # CSV import is authoritative for this assignment level.
        # Replace existing Tasks and Criteria instead of appending to them.
        #
        # Deleting criteria also removes their RubricBands and
        # TaskCriteriaMappings through the existing CASCADE relationships.
        # Deleting tasks removes their task mappings as well.
        RubricCriterion.objects.filter(
            assignment_level=assignment_level,
        ).delete()

        Task.objects.filter(
            assignment_level=assignment_level,
        ).delete()

        for sequence, row in enumerate(task_rows, start=1):
            Task.objects.create(
                assignment_level=assignment_level,
                task_code=row["task_code"],
                title=row["title"],
                instructions=row["instructions"],
                sequence=sequence,
            )

        for sequence, row in enumerate(criterion_rows, start=1):
            serializer = RubricCriterionSerializer(
                data={
                    "assignment_level": str(assignment_level.id),
                    "criterion_code": row["criterion_code"],
                    "title": row["title"],
                    "description": row["description"],
                    "maximum_score": str(row["maximum_score"]),
                    "sequence": sequence,
                    "ai_gradable": True,
                    "deterministic": False,
                }
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

        return DRFResponse(
            {
                "assignment_level": str(assignment_level.id),
                "level_code": assignment_level.level_code,
                "requirements_updated": requirements_updated,
                "configuration_replaced": True,
                "tasks_created": len(task_rows),
                "criteria_created": len(criterion_rows),
            },
            status=status.HTTP_200_OK,
        )
