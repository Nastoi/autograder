import pytest
from django.contrib.auth import get_user_model
from factory import SubFactory
from factory.django import DjangoModelFactory
from faker import Faker

from accounts.models import UserProfile
from courses.models import Qualification, Module, Cohort, ModuleAssignment, AssignmentLevel
from grading.models import GradingConfiguration
from submissions.models import SubmissionContext, LearnerSubmission

User = get_user_model()
fake = Faker()


class UserFactory(DjangoModelFactory):
    """Factory for creating test users."""
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")
    first_name = fake.first_name()
    last_name = fake.last_name()
    is_active = True


class UserProfileFactory(DjangoModelFactory):
    """Factory for creating test user profiles."""
    class Meta:
        model = UserProfile

    user = SubFactory(UserFactory)
    role = UserProfile.Role.LEARNER
    lms_user_id = factory.Sequence(lambda n: f"lms_{n}")


class QualificationFactory(DjangoModelFactory):
    """Factory for creating test qualifications."""
    class Meta:
        model = Qualification

    qualification_code = factory.Sequence(lambda n: f"QUAL_{n:03d}")
    qualification_name = fake.sentence(nb_words=3)
    description = fake.paragraph()
    is_active = True


class ModuleFactory(DjangoModelFactory):
    """Factory for creating test modules."""
    class Meta:
        model = Module

    qualification = SubFactory(QualificationFactory)
    code = factory.Sequence(lambda n: f"MOD_{n:03d}")
    name = fake.sentence(nb_words=4)
    description = fake.paragraph()
    is_active = True


class CohortFactory(DjangoModelFactory):
    """Factory for creating test cohorts."""
    class Meta:
        model = Cohort

    module = SubFactory(ModuleFactory)
    cohort_code = factory.Sequence(lambda n: f"COHORT_{n:03d}")
    cohort_name = fake.sentence(nb_words=2)
    is_active = True


class GradingConfigurationFactory(DjangoModelFactory):
    """Factory for creating test grading configurations."""
    class Meta:
        model = GradingConfiguration

    code = factory.Sequence(lambda n: f"GRADE_{n:03d}")
    name = fake.sentence(nb_words=3)
    grading_type = GradingConfiguration.GradingType.HYBRID
    is_active = True


class ModuleAssignmentFactory(DjangoModelFactory):
    """Factory for creating test module assignments."""
    class Meta:
        model = ModuleAssignment

    module = SubFactory(ModuleFactory)
    assignment_number = 1
    code = factory.Sequence(lambda n: f"ASSIGN_{n:03d}")
    title = fake.sentence(nb_words=4)
    skill_statement_code = "SS001"
    skill_statement = fake.paragraph()
    maximum_score = 100
    minimum_pass_score = 50
    is_active = True


class AssignmentLevelFactory(DjangoModelFactory):
    """Factory for creating test assignment levels."""
    class Meta:
        model = AssignmentLevel

    assignment = SubFactory(ModuleAssignmentFactory)
    grading_configuration = SubFactory(GradingConfigurationFactory)
    level_code = AssignmentLevel.Level.FOUNDATION
    display_name = "Foundation"
    title = fake.sentence(nb_words=3)
    instructions = fake.paragraph()
    is_active = True


class SubmissionContextFactory(DjangoModelFactory):
    """Factory for creating test submission contexts."""
    class Meta:
        model = SubmissionContext

    learner = SubFactory(UserFactory)
    cohort = SubFactory(CohortFactory)
    assignment_level = SubFactory(AssignmentLevelFactory)
    is_active = True


class LearnerSubmissionFactory(DjangoModelFactory):
    """Factory for creating test learner submissions."""
    class Meta:
        model = LearnerSubmission

    context = SubFactory(SubmissionContextFactory)
    learner = factory.SelfAttribute('context.learner')
    assignment_level = factory.SelfAttribute('context.assignment_level')
    submission_track = LearnerSubmission.SubmissionTrack.BASIC
    original_filename = "submission.pdf"
    status = LearnerSubmission.Status.UPLOADED
    maximum_score = 100


# Pytest fixtures

@pytest.fixture
def user():
    """Create a basic user."""
    return UserFactory()


@pytest.fixture
def learner_user():
    """Create a user with learner profile."""
    user = UserFactory()
    UserProfileFactory(user=user, role=UserProfile.Role.LEARNER)
    return user


@pytest.fixture
def admin_user():
    """Create an admin user."""
    user = UserFactory(is_staff=True, is_superuser=True)
    UserProfileFactory(user=user, role=UserProfile.Role.SYSTEM_ADMIN)
    return user


@pytest.fixture
def qualification():
    """Create a qualification."""
    return QualificationFactory()


@pytest.fixture
def module(qualification):
    """Create a module."""
    return ModuleFactory(qualification=qualification)


@pytest.fixture
def cohort(module):
    """Create a cohort."""
    return CohortFactory(module=module)


@pytest.fixture
def grading_config():
    """Create a grading configuration."""
    return GradingConfigurationFactory()


@pytest.fixture
def assignment(module):
    """Create an assignment."""
    return ModuleAssignmentFactory(module=module)


@pytest.fixture
def assignment_level(assignment, grading_config):
    """Create an assignment level."""
    return AssignmentLevelFactory(
        assignment=assignment,
        grading_configuration=grading_config
    )


@pytest.fixture
def submission_context(learner_user, cohort, assignment_level):
    """Create a submission context."""
    return SubmissionContextFactory(
        learner=learner_user,
        cohort=cohort,
        assignment_level=assignment_level
    )


@pytest.fixture
def learner_submission(submission_context):
    """Create a learner submission."""
    return LearnerSubmissionFactory(context=submission_context)
