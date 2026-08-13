import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.unit
class TestGradingModels:
    """Test suite for grading models."""

    def test_grading_configuration_str_representation(self, grading_config):
        """Test grading configuration string representation."""
        expected = f"{grading_config.code} — {grading_config.name}"
        assert str(grading_config) == expected

    def test_grading_configuration_defaults(self, grading_config):
        """Test grading configuration has correct defaults."""
        assert grading_config.structural_check_enabled is True
        assert grading_config.ai_grading_enabled is True
        assert grading_config.is_active is True

    def test_rubric_criterion_sequence_ordering(self, assignment_level):
        """Test rubric criteria are ordered by sequence."""
        from grading.models import RubricCriterion
        crit1 = RubricCriterion.objects.create(
            assignment_level=assignment_level,
            criterion_code='C001',
            title='First Criterion',
            maximum_score=50,
            sequence=1,
        )
        crit2 = RubricCriterion.objects.create(
            assignment_level=assignment_level,
            criterion_code='C002',
            title='Second Criterion',
            maximum_score=50,
            sequence=2,
        )
        criteria = list(RubricCriterion.objects.all())
        assert criteria[0].sequence < criteria[1].sequence


@pytest.mark.django_db
@pytest.mark.integration
class TestGradingConfiguration:
    """Test suite for grading configuration functionality."""

    def setup_method(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass',
            is_staff=True,
            is_superuser=True
        )

    def test_grading_config_list(self, grading_config):
        """Test grading configuration list."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/grading/configurations/')
        assert response.status_code == status.HTTP_200_OK

    def test_grading_config_detail(self, grading_config):
        """Test grading configuration detail."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f'/api/grading/configurations/{grading_config.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == grading_config.code

    def test_ai_grading_profile_list(self, assignment_level):
        """Test AI grading profile list."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/grading/ai-grading-profiles/')
        assert response.status_code == status.HTTP_200_OK

    def test_rubric_criterion_list(self, assignment_level):
        """Test rubric criterion list."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            f'/api/grading/rubric-criteria/?assignment_level_id={assignment_level.id}'
        )
        assert response.status_code == status.HTTP_200_OK
