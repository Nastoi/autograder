"""
Add database indexes for submissions app.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('submissions', '0001_initial'),
    ]

    operations = [
        # Submissions app indexes
        migrations.AddIndex(
            model_name='submissioncontext',
            index=models.Index(
                fields=['learner', 'is_active'],
                name='subctx_learner_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='submissioncontext',
            index=models.Index(
                fields=['cohort', 'is_active'],
                name='subctx_cohort_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='learnersubmission',
            index=models.Index(
                fields=['learner', 'status'],
                name='submission_learner_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='learnersubmission',
            index=models.Index(
                fields=['context', 'submitted_at'],
                name='submission_context_time_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='learnersubmission',
            index=models.Index(
                fields=['status', 'submitted_at'],
                name='submission_status_time_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='submissionpage',
            index=models.Index(
                fields=['submission', 'page_number'],
                name='page_submission_idx'
            ),
        ),
    ]
