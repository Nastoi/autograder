from decimal import Decimal

from .models import AssignmentLevel


def get_assignment_level_configuration_errors(level):
    errors = []

    required_text_fields = {
        "title": level.title,
        "skill_statement": level.skill_statement,
        "objective": level.objective,
        "scenario": level.scenario,
        "expected_outcome": level.expected_outcome,
    }

    for field_name, value in required_text_fields.items():
        if not str(value or "").strip():
            errors.append(
                f"{field_name.replace('_', ' ').title()} is required."
            )

    tasks = list(
        level.grading_tasks.all()
    )

    if not tasks:
        errors.append("At least one task is required.")

    for task in tasks:
        if not str(task.task_code or "").strip():
            errors.append("Every task must have a task code.")

        if not str(task.title or "").strip():
            errors.append(
                f"Task {task.task_code or ''} must have a title."
            )

        if not str(task.evidence_required or "").strip():
            errors.append(
                f"Task {task.task_code or task.title or ''} must have Evidence Required."
            )
            

    criteria = list(
        level.rubric_criteria.prefetch_related(
            "bands",
            "task_mappings",
        )
    )

    if not criteria:
        errors.append(
            "At least one rubric criterion is required."
        )

    for criterion in criteria:
        label = (
            criterion.criterion_code
            or criterion.title
            or "Criterion"
        )

        if not str(criterion.criterion_code or "").strip():
            errors.append(
                "Every rubric criterion must have a criterion code."
            )

        if not str(criterion.title or "").strip():
            errors.append(
                f"{label} must have a title."
            )


        if not str(criterion.description or "").strip():
            errors.append(
                f"{label} must have a description."
            )

        

        if (
            criterion.maximum_score is None
            or criterion.maximum_score <= Decimal("0")
        ):
            errors.append(
                f"{label} must have a maximum score greater than 0."
            )

        bands = list(
            criterion.bands.all().order_by("sequence")
        )

        if not bands:
            errors.append(
                f"{label} must have rubric bands."
            )
        else:
            for band in bands:
                if not str(band.descriptor or "").strip():
                    errors.append(
                        f"{label} band "
                        f"{band.display_name} needs a descriptor."
                    )

                if (
                    band.minimum_percentage is None
                    or band.maximum_percentage is None
                ):
                    errors.append(
                        f"{label} has an incomplete band range."
                    )
                elif (
                    band.minimum_percentage
                    > band.maximum_percentage
                ):
                    errors.append(
                        f"{label} has an invalid band range."
                    )

            sorted_bands = sorted(
                bands,
                key=lambda band: band.minimum_percentage,
            )

            if sorted_bands:
                if sorted_bands[0].minimum_percentage != Decimal("0"):
                    errors.append(
                        f"{label} bands must start at 0%."
                    )

                if sorted_bands[-1].maximum_percentage != Decimal("100"):
                    errors.append(
                        f"{label} bands must end at 100%."
                    )

                for previous, current in zip(
                    sorted_bands,
                    sorted_bands[1:],
                ):
                    if (
                        current.minimum_percentage
                        <= previous.maximum_percentage
                    ):
                        errors.append(
                            f"{label} has overlapping band ranges."
                        )

        if not criterion.task_mappings.exists():
            errors.append(
                f"{label} must be mapped to at least one task."
            )

    task_codes = [
        task.task_code.strip().lower()
        for task in tasks
        if task.task_code
    ]

    if len(task_codes) != len(set(task_codes)):
        errors.append(
            "Task codes must be unique."
        )

    criterion_codes = [
        criterion.criterion_code.strip().lower()
        for criterion in criteria
        if criterion.criterion_code
    ]

    if len(criterion_codes) != len(set(criterion_codes)):
        errors.append(
            "Criterion codes must be unique."
        )

    return errors


def refresh_assignment_level_configuration_status(level):
    if (
        level.configuration_status
        == AssignmentLevel.ConfigurationStatus.RETIRED
    ):
        return []

    errors = get_assignment_level_configuration_errors(
        level
    )

    new_status = (
        AssignmentLevel.ConfigurationStatus.READY
        if not errors
        else AssignmentLevel.ConfigurationStatus.DRAFT
    )

    if level.configuration_status != new_status:
        level.configuration_status = new_status
        level.save(
            update_fields=[
                "configuration_status",
                "updated_at",
            ]
        )

    return errors