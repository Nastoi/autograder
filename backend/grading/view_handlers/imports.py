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
from courses.models import AssignmentLevel



from ..models import (
    RubricBand,
    RubricCriterion,
    Task,
    TaskCriteriaMapping,
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
            "task_evidence_required",
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
        band_rows = []
        mapping_rows = []
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
                evidence_required = row.get(
                    "task_evidence_required",
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
                        "evidence_required": evidence_required,
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
            elif record_type == "band":
                criterion_code = row.get("criterion_code", "").strip()
                band_code = row.get("band_code", "").strip()
                display_name = row.get("band_display_name", "").strip()

                minimum_percentage = row.get(
                    "band_minimum_percentage",
                    "",
                ).strip()

                maximum_percentage = row.get(
                    "band_maximum_percentage",
                    "",
                ).strip()

                descriptor = row.get(
                    "band_descriptor",
                    "",
                ).strip()

                if not criterion_code:
                    errors.append(
                        f"Row {row_number}: criterion_code is required for a band."
                    )
                    continue

                if not band_code:
                    errors.append(
                        f"Row {row_number}: band_code is required."
                    )
                    continue

                if not display_name:
                    errors.append(
                        f"Row {row_number}: band_display_name is required."
                    )
                    continue

                try:
                    numeric_minimum = Decimal(minimum_percentage)
                    numeric_maximum = Decimal(maximum_percentage)
                except Exception:
                    errors.append(
                        f"Row {row_number}: band minimum and maximum "
                        "percentages must be valid numbers."
                    )
                    continue

                if (
                    numeric_minimum < 0
                    or numeric_maximum > 100
                    or numeric_minimum > numeric_maximum
                ):
                    errors.append(
                        f"Row {row_number}: band percentage range must "
                        "be between 0 and 100 and minimum cannot exceed maximum."
                    )
                    continue

                band_rows.append(
                    {
                        "criterion_code": criterion_code,
                        "band_code": band_code,
                        "display_name": display_name,
                        "minimum_percentage": numeric_minimum,
                        "maximum_percentage": numeric_maximum,
                        "descriptor": descriptor,
                    }
                )

            elif record_type == "mapping":
                task_code = row.get("task_code", "").strip()
                criterion_code = row.get("criterion_code", "").strip()
                inferred_weight = row.get("inferred_weight", "").strip()
                ai_explanation = row.get(
                    "ai_explanation",
                    "",
                ).strip()

                if not task_code:
                    errors.append(
                        f"Row {row_number}: task_code is required for a mapping."
                    )
                    continue

                if not criterion_code:
                    errors.append(
                        f"Row {row_number}: criterion_code is required for a mapping."
                    )
                    continue

                try:
                    numeric_weight = Decimal(inferred_weight)
                except Exception:
                    errors.append(
                        f"Row {row_number}: inferred_weight must be a valid number."
                    )
                    continue

                if numeric_weight < 0 or numeric_weight > 100:
                    errors.append(
                        f"Row {row_number}: inferred_weight must be between 0 and 100."
                    )
                    continue

                mapping_rows.append(
                    {
                        "task_code": task_code,
                        "criterion_code": criterion_code,
                        "inferred_weight": numeric_weight,
                        "ai_explanation": ai_explanation,
                    }
                )    
            else:
                errors.append(
                    f"Row {row_number}: record_type must be "
                    "configuration, task, criterion, band, or mapping."
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

        imported_task_codes = set(task_codes)
        imported_criterion_codes = set(criterion_codes)

        for row in band_rows:
            criterion_code = row["criterion_code"].upper()

            if criterion_code not in imported_criterion_codes:
                errors.append(
                    (
                        "Band references criterion code "
                        f"'{row['criterion_code']}', but that criterion "
                        "is not included in this CSV."
                    )
                )

        for row in mapping_rows:
            task_code = row["task_code"].upper()
            criterion_code = row["criterion_code"].upper()

            if task_code not in imported_task_codes:
                errors.append(
                    (
                        "Mapping references task code "
                        f"'{row['task_code']}', but that task "
                        "is not included in this CSV."
                    )
                )

            if criterion_code not in imported_criterion_codes:
                errors.append(
                    (
                        "Mapping references criterion code "
                        f"'{row['criterion_code']}', but that criterion "
                        "is not included in this CSV."
                    )
                )

        band_keys = [
            (
                row["criterion_code"].upper(),
                row["band_code"].lower(),
            )
            for row in band_rows
        ]

        if len(band_keys) != len(set(band_keys)):
            errors.append(
                "CSV contains duplicate band codes for the same criterion."
            )

        mapping_keys = [
            (
                row["task_code"].upper(),
                row["criterion_code"].upper(),
            )
            for row in mapping_rows
        ]

        if len(mapping_keys) != len(set(mapping_keys)):
            errors.append(
                "CSV contains duplicate task-to-criterion mappings."
            )
            
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
                evidence_required=row["evidence_required"],
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

            tasks_by_code = {
                task.task_code.upper(): task
                for task in Task.objects.filter(
                    assignment_level=assignment_level,
                )
            }

            criteria_by_code = {
                criterion.criterion_code.upper(): criterion
                for criterion in RubricCriterion.objects.filter(
                    assignment_level=assignment_level,
                )
            }

            if band_rows:
                band_criterion_codes = {
                    row["criterion_code"].upper()
                    for row in band_rows
                }

                missing_band_criteria = sorted(
                    code
                    for code in band_criterion_codes
                    if code not in criteria_by_code
                )

                if missing_band_criteria:
                    return DRFResponse(
                        {
                            "errors": [
                                (
                                    "Band rows reference unknown criterion codes: "
                                    + ", ".join(missing_band_criteria)
                                )
                            ]
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                RubricBand.objects.filter(
                    rubric_criterion__assignment_level=assignment_level,
                ).delete()

                band_sequence_by_criterion = {}

                for row in band_rows:
                    criterion_code = row["criterion_code"].upper()
                    criterion = criteria_by_code[criterion_code]

                    next_sequence = (
                        band_sequence_by_criterion.get(
                            criterion_code,
                            0,
                        )
                        + 1
                    )

                    band_sequence_by_criterion[
                        criterion_code
                    ] = next_sequence

                    RubricBand.objects.create(
                        rubric_criterion=criterion,
                        band_code=row["band_code"],
                        display_name=row["display_name"],
                        minimum_percentage=row[
                            "minimum_percentage"
                        ],
                        maximum_percentage=row[
                            "maximum_percentage"
                        ],
                        descriptor=row["descriptor"],
                        sequence=next_sequence,
                    )

            if mapping_rows:
                missing_mapping_tasks = sorted(
                    {
                        row["task_code"].upper()
                        for row in mapping_rows
                        if row["task_code"].upper()
                        not in tasks_by_code
                    }
                )

                missing_mapping_criteria = sorted(
                    {
                        row["criterion_code"].upper()
                        for row in mapping_rows
                        if row["criterion_code"].upper()
                        not in criteria_by_code
                    }
                )

                mapping_errors = []

                if missing_mapping_tasks:
                    mapping_errors.append(
                        "Mapping rows reference unknown task codes: "
                        + ", ".join(missing_mapping_tasks)
                    )

                if missing_mapping_criteria:
                    mapping_errors.append(
                        "Mapping rows reference unknown criterion codes: "
                        + ", ".join(missing_mapping_criteria)
                    )

                if mapping_errors:
                    return DRFResponse(
                        {"errors": mapping_errors},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                for row in mapping_rows:
                    task = tasks_by_code[
                        row["task_code"].upper()
                    ]

                    criterion = criteria_by_code[
                        row["criterion_code"].upper()
                    ]

                    TaskCriteriaMapping.objects.create(
                        assignment_level=assignment_level,
                        task=task,
                        rubric_criterion=criterion,
                        inferred_weight=row["inferred_weight"],
                        ai_explanation=row["ai_explanation"],
                    )
                    
        return DRFResponse(
        {
            "assignment_level": str(assignment_level.id),
            "level_code": assignment_level.level_code,
            "requirements_updated": requirements_updated,
            "configuration_replaced": True,
            "tasks_created": len(task_rows),
            "criteria_created": len(criterion_rows),
            "bands_created": (
                len(band_rows)
                if band_rows
                else RubricBand.objects.filter(
                    rubric_criterion__assignment_level=assignment_level,
                ).count()
            ),
            "mappings_created": len(mapping_rows),
        },
        status=status.HTTP_200_OK,
    )
