from .view_handlers.qualifications import (
    QualificationDeleteImpactView,
    QualificationDetailView,
    QualificationListCreateView,
)

from .view_handlers.modules import (
    ModuleDeleteImpactView,
    ModuleDetailView,
    ModuleListCreateView,
)

from .view_handlers.cohorts import (
    CohortDeleteImpactView,
    CohortDetailView,
    CohortListCreateView,
)

from .view_handlers.assignments import (
    ModuleAssignmentDeleteImpactView,
    ModuleAssignmentListCreateView,
    ModuleAssignmentSafeDetailView,
)

from .view_handlers.assignment_levels import (
    AssignmentLevelConfigurationLockView,
    AssignmentLevelDetailView,
    AssignmentLevelListCreateView,
)