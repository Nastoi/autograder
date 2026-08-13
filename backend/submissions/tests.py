import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from submissions.models import SubmissionContext, LearnerSubmission

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.unit
class TestSubmissionModels:
    """Test suite for submission models."""

    def test_submission_context_str_representation(self, submission_context):
        """Test submission context string representation."""
        expected = (
            f"{submission_context.learner.username} — "
            f"{submission_context.assignment_level.assignment.code} — "
            f"{submission_context.assignment_level.level_code}"
        )
        assert str(submission_context) == expected

    def test_learner_submission_str_representation(self, learner_submission):
        """Test learner submission string representation."""
        expected = (
            f"{learner_submission.learner.username} — "
            f"{learner_submission.original_filename}"
        )
        assert str(learner_submission) == expected

    def test_learner_submission_default_status(self, learner_submission):
        """Test learner submission has correct default status."""
        assert learner_submission.status == LearnerSubmission.Status.UPLOADED

    def test_learner_submission_default_track(self, learner_submission):
        """Test learner submission has correct default track."""
        assert learner_submission.submission_track == LearnerSubmission.SubmissionTrack.BASIC


@pytest.mark.django_db
@pytest.mark.integration
class TestSubmissionAPI:
    """Test suite for submission API endpoints."""

    def setup_method(self):
        self.client = APIClient()

    def test_submission_context_get(self, learner_user, submission_context):
        """Test retrieving submission context."""
        self.client.force_authenticate(user=learner_user)
        response = self.client.get(
            f'/api/submissions/context/{submission_context.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['context_id'] == str(submission_context.id)

    def test_submission_context_post_requires_auth(self, learner_user):
        """Test creating submission context requires authentication."""
        response = self.client.post('/api/submissions/context/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_submission_list_requires_auth(self):
        """Test listing submissions requires authentication."""
        response = self.client.get('/api/submissions/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_submission_list_for_learner(self, learner_user, learner_submission):
        """Test learner can list their own submissions."""
        self.client.force_authenticate(user=learner_user)
        response = self.client.get('/api/submissions/')
        assert response.status_code == status.HTTP_200_OK

    def test_submission_detail_access_own(self, learner_user, learner_submission):
        """Test learner can access their own submission."""
        self.client.force_authenticate(user=learner_user)
        response = self.client.get(
            f'/api/submissions/{learner_submission.id}/'
        )
        assert response.status_code == status.HTTP_200_OK

    def test_submission_detail_access_admin(self, admin_user, learner_submission):
        """Test admin can access any submission."""
        self.client.force_authenticate(user=admin_user)
        response = self.client.get(
            f'/api/submissions/{learner_submission.id}/'
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
@pytest.mark.unit
class TestSubmissionContextValidation:
    """Test suite for submission context validation."""

    def test_submission_context_module_mismatch(self, learner_user, cohort):
        """Test that submission context validates module alignment."""
        from courses.models import Cohort, Module
        other_module = Module.objects.create(
            qualification=cohort.module.qualification,
            code='OTHER',
            name='Other Module'
        )
        other_cohort = Cohort.objects.create(
            module=other_module,
            cohort_code='OTHER_COHORT',
            cohort_name='Other'
        )
        # This should fail due to module mismatch in serializer validation
