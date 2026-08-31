from rest_framework import generics
from rest_framework.permissions import IsAuthenticated


from courses.configuration_locks import require_lock_owner

from lms.permissions import IsMappingAdmin




from ..models import (
 
    Task,
    TaskCriteriaMapping,
  
)

from ..serializers import (
 
    TaskCriteriaMappingSerializer,
   
    TaskSerializer,
)

class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def perform_create(self, serializer):
        level_id = self.request.data.get("assignment_level")
        require_lock_owner(level_id, self.request.user)
        serializer.save()

    def get_queryset(self):
        queryset = Task.objects.select_related(
            "assignment_level",
        ).order_by(
            "assignment_level__assignment__assignment_code",
            "sequence",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )

        if assignment_level_id:
            queryset = queryset.filter(
                assignment_level_id=assignment_level_id,
            )

        return queryset


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def perform_update(self, serializer):
        task = self.get_object()
        require_lock_owner(
            task.assignment_level_id,
            self.request.user,
        )
        serializer.save()

    def perform_destroy(self, instance):
        require_lock_owner(
            instance.assignment_level_id,
            self.request.user,
        )
        instance.delete()

    def get_queryset(self):
        return Task.objects.select_related(
            "assignment_level",
        ).order_by(
            "assignment_level__assignment__assignment_code",
            "sequence",
        )




class TaskCriteriaMappingListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskCriteriaMappingSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def perform_create(self, serializer):
        level_id = self.request.data.get("assignment_level")
        require_lock_owner(level_id, self.request.user)
        serializer.save()

    def get_queryset(self):
        queryset = TaskCriteriaMapping.objects.select_related(
            "assignment_level",
            "task",
            "rubric_criterion",
        ).order_by(
            "assignment_level__assignment__assignment_code",
            "task__sequence",
            "rubric_criterion__sequence",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )
        task_id = self.request.query_params.get("task_id")
        rubric_criterion_id = self.request.query_params.get(
            "rubric_criterion_id",
        )

        if assignment_level_id:
            queryset = queryset.filter(
                assignment_level_id=assignment_level_id,
            )

        if task_id:
            queryset = queryset.filter(task_id=task_id)

        if rubric_criterion_id:
            queryset = queryset.filter(
                rubric_criterion_id=rubric_criterion_id,
            )

        return queryset


class TaskCriteriaMappingDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = TaskCriteriaMappingSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def perform_update(self, serializer):
        mapping = self.get_object()
        require_lock_owner(
            mapping.assignment_level_id,
            self.request.user,
        )
        serializer.save()

    def perform_destroy(self, instance):
        require_lock_owner(
            instance.assignment_level_id,
            self.request.user,
        )
        instance.delete()

    def get_queryset(self):
        return TaskCriteriaMapping.objects.select_related(
            "assignment_level",
            "task",
            "rubric_criterion",
        ).order_by(
            "assignment_level__assignment__assignment_code",
            "task__sequence",
            "rubric_criterion__sequence",
        )
