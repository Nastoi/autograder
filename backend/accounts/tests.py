import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.unit
class TestAuthViews:
    """Test suite for authentication views."""

    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_login_success(self):
        """Test successful login."""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'csrfToken' in response.data
        assert response.data['user']['username'] == 'testuser'

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'wrongpass'
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid username or password' in str(response.data)

    def test_logout_success(self):
        """Test successful logout when authenticated."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/logout/')
        assert response.status_code == status.HTTP_200_OK
        assert 'Logout successful' in response.data['message']

    def test_current_user_authenticated(self):
        """Test getting current user when authenticated."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == 'testuser'

    def test_current_user_unauthenticated(self):
        """Test getting current user when unauthenticated."""
        response = self.client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
@pytest.mark.unit
class TestCoursesViews:
    """Test suite for courses views."""

    def setup_method(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass',
            is_staff=True,
            is_superuser=True
        )

    def test_qualification_list_requires_auth(self):
        """Test that qualification list requires authentication."""
        response = self.client.get('/api/courses/qualifications/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_qualification_list_authenticated(self, qualification):
        """Test qualification list when authenticated."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/courses/qualifications/')
        assert response.status_code == status.HTTP_200_OK

    def test_module_list_authenticated(self, module):
        """Test module list when authenticated."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/courses/modules/')
        assert response.status_code == status.HTTP_200_OK

    def test_cohort_list_authenticated(self, cohort):
        """Test cohort list when authenticated."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/courses/cohorts/')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
@pytest.mark.integration
class TestSubmissionWorkflow:
    """Test suite for submission workflow."""

    def setup_method(self):
        self.client = APIClient()

    def test_submission_context_creation(self, learner_user, submission_context):
        """Test submission context creation."""
        self.client.force_authenticate(user=learner_user)
        response = self.client.get(
            f'/api/submissions/context/{submission_context.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['context_id'] == str(submission_context.id)

    def test_submission_list_for_learner(self, learner_user, learner_submission):
        """Test that learner can list their submissions."""
        self.client.force_authenticate(user=learner_user)
        response = self.client.get('/api/submissions/')
        assert response.status_code == status.HTTP_200_OK

    def test_submission_detail_access(self, learner_user, learner_submission):
        """Test submission detail access."""
        self.client.force_authenticate(user=learner_user)
        response = self.client.get(
            f'/api/submissions/{learner_submission.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
