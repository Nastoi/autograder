

from django.shortcuts import get_object_or_404

from rest_framework.permissions import IsAuthenticated

from rest_framework.response import Response
from rest_framework.views import APIView


from .models import LearnerSubmission

from .serializers import (
    LearnerSubmissionSerializer,
)

from .attempt_policy import (
    get_attempt_policy,
)
from lms.models import AssessmentMapping

from .view_handlers.contexts import (
    SubmissionContextView,
    MappingSubmissionContextView,
)

from .view_handlers.media import PageImageView

from .view_handlers.submissions import LearnerSubmissionViewSet,SubmissionCreateView,SubmissionDetailView
from .view_handlers.history import MappingSubmissionHistoryView

from .view_handlers.reports import SaPrReportView

import logging

logger = logging.getLogger(__name__)





