from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.models import UserProfile
from courses.models import Qualification, Module, ModuleAssignment, AssignmentLevel, Cohort
from grading.models import GradingConfiguration, RubricCriterion, RubricBand
from submissions.models import SubmissionContext

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds the database with initial LMS entities and relationships."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting database seeding..."))

        # 1. User & UserProfile
        learner, _ = User.objects.get_or_create(
            username="dum_learner",
            defaults={
                "email": "dum@example.com",
                "first_name": "Dum",
                "last_name": "My",
            },
        )
        if not learner.check_password("dum@1234"):
            learner.set_password("dum@1234")
            learner.save()

        UserProfile.objects.get_or_create(
            user=learner,
            defaults={
                "role": "learner",
                "lms_user_id": "LMS-USER-0021",
            },
        )

        # 2. Qualification
        qualification, _ = Qualification.objects.get_or_create(
            qualification_code="DS",
            defaults={
                "qualification_name": "Data Science",
                "description": "A focused academic program that teaches core skills needed to collect, clean, analyze, and interpret large sets of data.",
                "is_active": True,
            },
        )

        # 3. Module
        module, _ = Module.objects.get_or_create(
            module_code="DMV",
            qualification=qualification,
            defaults={
                "module_name": "Data Management and Visualisation",
                "description": "Combined process of collecting, organizing, and transforming raw data into clear visual charts to drive decision-making.",
                "is_active": True,
            },
        )

        # 4. Module Assignment
        assignment, _ = ModuleAssignment.objects.get_or_create(
            assignment_code="DMV-A1",
            module=module,
            defaults={
                "assignment_number": 1,
                "assignment_title": "Data Preparation and Transformation Using Power Query",
                "skill_statement_code": "DMV-A1-S",
                "skill_statement": "Prepare and transform raw data into analysis-ready datasets using Power Query",
                "objective": "Use Power Query to connect to, profile, clean, transform, and prepare the provided retail sales data for analysis in Power BI",
                "maximum_score": "20.00",
                "minimum_pass_score": "10.00",
                "is_summative": True,
                "contributes_to_final_mark": True,
                "final_mark_weight": "20.00",
                "is_active": True,
            },
        )

        # 5. Grading Configuration
        grading_config, _ = GradingConfiguration.objects.get_or_create(
            grading_config_code="AH-FPE",
            defaults={
                "grading_config_name": "Advanced-Hybrid",
                "grading_type": "hybrid",
                "structural_check_enabled": True,
                "automated_testing_enabled": False,
                "rag_enabled": True,
                "ai_grading_enabled": True,
                "manual_review_required": True,
                "confidence_review_threshold": "0.750",
                "version": 1,
                "configuration": {"strict_mode": False, "max_retries": 3},
                "is_active": True,
            },
        )

        # 6. Assignment Level
        assignment_level, _ = AssignmentLevel.objects.get_or_create(
            assignment=assignment,
            level_code="foundation",
            defaults={
                "grading_configuration": grading_config,
                "display_name": "Foundation Level",
                "title": "Foundation Tier - Django Setup",
                "instructions": "Follow standard backend patterns and build models.",
                "tasks": [
                    "Connect to the provided Sales, Product, and Store data files.",
                    "Profile the datasets and identify data quality issues.",
                    "Remove duplicate transaction records.",
                    "Handle blank and null values appropriately.",
                    "Correct incorrect data types.",
                    "Standardize inconsistent date formats.",
                    "Standardize inconsistent naming conventions.",
                    "Rename columns using meaningful and consistent names.",
                    "Split or merge columns where appropriate.",
                    "Remove unnecessary columns.",
                    "Apply appropriate basic Power Query transformations.",
                    "Load the transformed datasets into Power BI.",
                ],
                "deliverables": [
                    "Power BI .pbix file.",
                    "Cleaned and transformed datasets.",
                    "Power Query transformation steps.",
                    "Short data preparation report identifying: Data quality issues identified. Transformations performed. Rationale for key cleaning decisions.",
                ],
                "expected_outcome": "A clean, consistent, and analysis-ready dataset that can be used for data modelling and reporting.",
                "source_filename": "assignment_01_spec.pdf",
                "version": 1,
                "configuration_status": "draft",
                "is_active": True,
            },
        )

        # 7. Cohort
        cohort, _ = Cohort.objects.get_or_create(
            cohort_code="0926-DMV-101226",
            module=module,
            defaults={
                "cohort_name": "0926 cohort on DMV - EOC Oct 12 2026",
                "start_date": "2026-08-01",
                "end_date": "2026-10-12",
                "is_active": True,
            },
        )

        # 8. Submission Context
        submission_context, _ = SubmissionContext.objects.get_or_create(
            learner=learner,
            cohort=cohort,
            assignment_level=assignment_level,
            defaults={"is_active": True},
        )

        # 9. Rubric Criterion
        rubric_criterion, _ = RubricCriterion.objects.get_or_create(
            assignment_level=assignment_level,
            criterion_code="DMV-A1-C5",
            defaults={
                "title": "Produce analysis-ready datasets",
                "description": "Produces clean, consistent, reliable datasets ready for modelling and reporting",
                "maximum_score": "3.00",
                "sequence": 5,
                "ai_gradable": True,
                "deterministic": False,
            },
        )

        # 10. Rubric Band
        rubric_band, _ = RubricBand.objects.get_or_create(
            rubric_criterion=rubric_criterion,
            band_code="foundation",
            defaults={
                "display_name": "Foundation Structure",
                "minimum_percentage": "0",
                "maximum_percentage": "100",
                "descriptor": "Code is clean, properly formatted, and functions without minor bugs.",
                "sequence": 1,
            },
        )

        self.stdout.write(
            self.style.SUCCESS("Database seeding completed successfully!")
        )