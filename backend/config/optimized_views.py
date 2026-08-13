"""
Optimized view base classes with caching and query optimization.
"""
from rest_framework import generics
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from config.performance import (
    SelectRelatedMixin,
    PrefetchRelatedMixin,
    CacheInvalidationMixin,
)


class OptimizedListAPIView(SelectRelatedMixin, generics.ListAPIView):
    """
    Base list view with automatic select_related() and filtering.
    
    Usage:
        class MyListView(OptimizedListAPIView):
            queryset = Model.objects.all()
            serializer_class = MySerializer
            select_related_fields = ['user', 'category']
            filter_backends = [DjangoFilterBackend, OrderingFilter]
            filterset_fields = ['status']
            ordering_fields = ['created_at']
    """
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    select_related_fields = []


class OptimizedCreateUpdateDestroyAPIView(
    CacheInvalidationMixin,
    SelectRelatedMixin,
    generics.RetrieveUpdateDestroyAPIView
):
    """
    Base detail view with automatic cache invalidation and query optimization.
    
    Usage:
        class MyDetailView(OptimizedCreateUpdateDestroyAPIView):
            queryset = Model.objects.all()
            serializer_class = MySerializer
            select_related_fields = ['user']
            cache_patterns_to_invalidate = ['list_view:*']
    """
    select_related_fields = []
    cache_patterns_to_invalidate = []


class OptimizedListCreateAPIView(
    CacheInvalidationMixin,
    SelectRelatedMixin,
    generics.ListCreateAPIView
):
    """
    Base create/list view with cache invalidation and query optimization.
    """
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    select_related_fields = []
    cache_patterns_to_invalidate = []
