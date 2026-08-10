"""
Add database indexes for grading app.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('grading', '0001_initial'),
    ]

    operations = [
        # Grading app indexes
        migrations.AddIndex(
            model_name='rubriccriterion',
            index=models.Index(
                fields=['assignment_level', 'sequence'],
                name='criterion_level_seq_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='rubricband',
            index=models.Index(
                fields=['rubric_criterion', 'band_code'],
                name='band_criterion_code_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='ragsource',
            index=models.Index(
                fields=['assignment_level', 'ingestion_status'],
                name='ragsource_level_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='ragchunk',
            index=models.Index(
                fields=['rag_source', 'chunk_index'],
                name='chunk_source_idx_idx'
            ),
        ),
    ]
