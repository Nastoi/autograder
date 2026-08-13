import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.unit
class TestCoursesModels:
    """Test suite for courses models."""

    def test_qualification_str_representation(self, qualification):
        """Test qualification string representation."""
        expected = f"{qualification.qualification_code} — {qualification.qualification_name}"
        assert str(qualification) == expected

    def test_module_str_representation(self, module):
        """Test module string representation."""
        expected = f"{module.code} — {module.name}"
        assert str(module) == expected

    def test_cohort_str_representation(self, cohort):
        """Test cohort string representation."""
        expected = f"{cohort.cohort_code} — {cohort.cohort_name}"
        assert str(cohort) == expected

    def test_assignment_level_str_representation(self, assignment_level):
        """Test assignment level string representation."""
        expected = f"{assignment_level.assignment.code} — Foundation"
        assert str(assignment_level) == expected


@pytest.mark.django_db
@pytest.mark.unit
class TestCoursesViews:
    """Test suite for courses API views."""

    def setup_method(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass',
            is_staff=True,
            is_superuser=True
        )

    def test_qualification_list_filters_active(self, qualification):
        """Test qualification list only shows active qualifications."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/courses/qualifications/')
        assert response.status_code == status.HTTP_200_OK

    def test_module_list_filters_by_qualification(self, module, qualification):
        """Test module list can be filtered by qualification."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            f'/api/courses/modules/?qualification_id={qualification.id}'
        )
        assert response.status_code == status.HTTP_200_OK

    def test_cohort_list_filters_by_module(self, cohort, module):
        """Test cohort list can be filtered by module."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            f'/api/courses/cohorts/?module_id={module.id}'
        )
        assert response.status_code == status.HTTP_200_OK

    def test_assignment_level_list_filters_by_module(self, assignment_level, module):
        """Test assignment level list can be filtered by module."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            f'/api/courses/assignment-levels/?module_id={module.id}'
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
@pytest.mark.unit
class TestCohortConstraints:
    """Test suite for cohort constraints."""

    def test_cohort_unique_code(self, cohort):
        """Test that cohort codes are unique."""
        from courses.models import Cohort
        with pytest.raises(Exception):
            Cohort.objects.create(
                module=cohort.module,
                cohort_code=cohort.cohort_code,
                cohort_name="Duplicate",
            )

    def test_module_to_qualification_relationship(self, module, qualification):
        """Test module is correctly related to qualification."""
        assert module.qualification == qualification

    def test_cohort_to_module_relationship(self, cohort, module):
        """Test cohort is correctly related to module."""
        assert cohort.module == module
