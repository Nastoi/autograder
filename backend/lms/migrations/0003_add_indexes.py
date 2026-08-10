"""
Add database indexes for lms app.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lms', '0002_remove_assessmentmapping_assignment_level_and_more'),
    ]

    operations = [
        # LMS app indexes
        migrations.AddIndex(
            model_name='assessmentmapping',
            index=models.Index(
                fields=['cohort', 'is_active'],
                name='mapping_cohort_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='assessmentmapping',
            index=models.Index(
                fields=['assignment', 'is_active'],
                name='mapping_assign_active_idx'
            ),
        ),
    ]
