"""
Add database indexes for courses app.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0002_initial'),
    ]

    operations = [
        # Courses app indexes
        migrations.AddIndex(
            model_name='qualification',
            index=models.Index(
                fields=['is_active'],
                name='qual_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='module',
            index=models.Index(
                fields=['qualification', 'is_active'],
                name='module_qual_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='cohort',
            index=models.Index(
                fields=['module', 'is_active'],
                name='cohort_module_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='moduleassignment',
            index=models.Index(
                fields=['module', 'is_active'],
                name='assignment_module_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='assignmentlevel',
            index=models.Index(
                fields=['assignment', 'is_active'],
                name='level_assign_active_idx'
            ),
        ),
    ]
