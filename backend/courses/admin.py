from django.contrib import admin

from .models import (
    # AssignmentLevel,
    Cohort,
    Enrolment,
    Module,
    ModuleAssignment,
    Qualification,
)

admin.site.register(Qualification)
admin.site.register(Module)
admin.site.register(Enrolment)
admin.site.register(ModuleAssignment)
# admin.site.register(AssignmentLevel)
admin.site.register(Cohort)

