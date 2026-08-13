"""
Performance optimization utilities - caching, query optimization, etc.
"""
from functools import wraps
from django.core.cache import cache
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from rest_framework.decorators import api_view


def cache_result(timeout=3600, key_prefix=''):
    """
    Decorator to cache function results based on arguments.
    
    Usage:
        @cache_result(timeout=3600, key_prefix='user_data')
        def get_user_data(user_id):
            return User.objects.get(id=user_id)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"
            
            result = cache.get(cache_key)
            if result is None:
                result = func(*args, **kwargs)
                cache.set(cache_key, result, timeout)
            return result
        return wrapper
    return decorator


def invalidate_cache(pattern):
    """
    Invalidate cache entries matching a pattern.
    
    Usage:
        invalidate_cache('user_data:*')
    """
    # Note: Redis supports wildcard deletion, but Django cache API doesn't expose it easily
    # This is a simplified version that requires key tracking
    cache.delete(pattern)


class CachedViewMixin:
    """
    Mixin for views to add caching capabilities.
    
    Usage:
        class MyListView(CachedViewMixin, generics.ListAPIView):
            cache_timeout = 3600
            cache_key_prefix = 'my_list'
    """
    cache_timeout = 3600
    cache_key_prefix = 'view'
    
    def get_cache_key(self):
        """Generate cache key for the view."""
        user_id = getattr(self.request.user, 'id', 'anon')
        params = ''.join([f"{k}={v}" for k, v in self.request.query_params.items()])
        return f"{self.cache_key_prefix}:{user_id}:{params}"
    
    def list(self, request, *args, **kwargs):
        """Override list to add caching."""
        cache_key = self.get_cache_key()
        cached_response = cache.get(cache_key)
        
        if cached_response:
            return cached_response
        
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response, self.cache_timeout)
        return response


class SelectRelatedMixin:
    """
    Mixin to automatically apply select_related() for queryset optimization.
    
    Usage:
        class MyListView(SelectRelatedMixin, generics.ListAPIView):
            select_related_fields = ['user', 'category']
    """
    select_related_fields = []
    
    def get_queryset(self):
        queryset = super().get_queryset()
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        return queryset


class PrefetchRelatedMixin:
    """
    Mixin to automatically apply prefetch_related() for queryset optimization.
    
    Usage:
        class MyListView(PrefetchRelatedMixin, generics.ListAPIView):
            prefetch_related_fields = ['comments', 'tags']
    """
    prefetch_related_fields = []
    
    def get_queryset(self):
        queryset = super().get_queryset()
        if self.prefetch_related_fields:
            from django.db.models import Prefetch
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)
        return queryset


# Query optimization decorators

def select_related(*fields):
    """Decorator to add select_related() to queryset."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            queryset = self.get_queryset()
            self.queryset = queryset.select_related(*fields)
            return view_func(self, request, *args, **kwargs)
        return wrapper
    return decorator


def prefetch_related(*fields):
    """Decorator to add prefetch_related() to queryset."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            queryset = self.get_queryset()
            self.queryset = queryset.prefetch_related(*fields)
            return view_func(self, request, *args, **kwargs)
        return wrapper
    return decorator


# Cache invalidation utilities

class CacheInvalidationMixin:
    """
    Mixin to automatically invalidate related cache on create/update/delete.
    
    Usage:
        class MyUpdateView(CacheInvalidationMixin, generics.UpdateAPIView):
            cache_patterns_to_invalidate = ['user_data:*', 'list_view:*']
    """
    cache_patterns_to_invalidate = []
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._invalidate_caches()
    
    def perform_update(self, serializer):
        super().perform_update(serializer)
        self._invalidate_caches()
    
    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        self._invalidate_caches()
    
    def _invalidate_caches(self):
        """Invalidate configured cache patterns."""
        for pattern in self.cache_patterns_to_invalidate:
            invalidate_cache(pattern)


# Database query count tracking (for testing/debugging)

class QueryCountDebugMixin:
    """
    Mixin for development to track query counts.
    Useful for identifying N+1 problems.
    
    Usage:
        class MyListView(QueryCountDebugMixin, generics.ListAPIView):
            pass
    
    Then check console output for query count info.
    """
    def list(self, request, *args, **kwargs):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        
        with CaptureQueriesContext(connection) as ctx:
            response = super().list(request, *args, **kwargs)
        
        print(f"[QueryCount] {len(ctx)} queries executed")
        return response
