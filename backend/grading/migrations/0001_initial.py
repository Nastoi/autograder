
import django.db.models.deletion
import pgvector.django.vector
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("courses", "0001_initial"),
        ("submissions", "0001_initial"),
    ]

    operations = [
    VectorExtension(),
        migrations.CreateModel(
            name="RubricBand",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "band_code",
                    models.CharField(
                        choices=[
                            ("failed", "Failed"),
                            ("foundation", "Foundation"),
                            ("proficient", "Proficient"),
                            ("expert", "Expert"),
                        ],
                        max_length=30,
                    ),
                ),
                ("display_name", models.CharField(max_length=100)),
                (
                    "minimum_percentage",
                    models.DecimalField(decimal_places=2, max_digits=5),
                ),
                (
                    "maximum_percentage",
                    models.DecimalField(decimal_places=2, max_digits=5),
                ),
                ("descriptor", models.TextField()),
                ("sequence", models.PositiveIntegerField()),
                (
                    "rubric_criterion",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bands",
                        to="grading.rubriccriterion",
                    ),
                ),
            ],
            options={
                "ordering": ("rubric_criterion", "sequence"),
            },
        ),
        migrations.CreateModel(
            name="CriterionResult",
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('profile_name', models.CharField(max_length=255)),
                ('system_prompt', models.TextField()),
                ('output_schema', models.JSONField()),
                ('temperature', models.DecimalField(decimal_places=2, default=0.1, max_digits=3)),
                ('model_provider', models.CharField(default='openai', max_length=50)),
                ('model_name', models.CharField(default='configure-in-environment', max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assignment_level', models.OneToOneField(blank=True, db_column='assignment_level_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='ai_grading_profile', to='courses.assignmentlevel')),
            ],
            options={
                "db_table": "criterion_result",
            },
        ),
        migrations.CreateModel(
            name="Task",
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source_type', models.CharField(choices=[('assignment_document', 'Assignment document'), ('rubric', 'Rubric'), ('model_answer', 'Model answer'), ('lecture_note', 'Lecture note'), ('policy', 'Policy'), ('example', 'Example')], max_length=30)),
                ('title', models.CharField(max_length=255)),
                ('source_filename', models.CharField(blank=True, max_length=255, null=True)),
                ('storage_uri', models.TextField(blank=True, null=True)),
                ('source_text', models.TextField(blank=True, null=True)),
                ('metadata', models.JSONField(default=dict)),
                ('ingestion_status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('ready', 'Ready'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField()),
                ('assignment_level', models.ForeignKey(blank=True, db_column='assignment_level_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rag_sources', to='courses.assignmentlevel')),
            ],
            options={
                "db_table": "task",
                "ordering": ("assignment_level", "sequence"),
            },
        ),
        migrations.CreateModel(
            name="TaskCriteriaMapping",
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('chunk_index', models.PositiveIntegerField()),
                ('content', models.TextField()),
                ('token_count', models.IntegerField(blank=True, null=True)),
                ('metadata', models.JSONField(default=dict)),
                ('embedding', pgvector.django.vector.VectorField(blank=True, dimensions=1536, null=True)),
                ('created_at', models.DateTimeField()),
                ('rag_source', models.ForeignKey(blank=True, db_column='rag_source_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='chunks', to='grading.ragsource')),
            ],
            options={
                "db_table": "task_criteria_mapping",
            },
        ),
        migrations.CreateModel(
            name="TaskCriterionWeight",
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('criterion_code', models.CharField(max_length=80)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('maximum_score', models.DecimalField(decimal_places=2, max_digits=7)),
                ('sequence', models.PositiveIntegerField()),
                ('ai_gradable', models.BooleanField(default=True)),
                ('deterministic', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField()),
                ('assignment_level', models.ForeignKey(blank=True, db_column='assignment_level_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rubric_criteria', to='courses.assignmentlevel')),
            ],
            options={
                "db_table": "task_criterion_weight",
            },
        ),
        migrations.CreateModel(
            name="TaskEvidenceMap",
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('band_code', models.CharField(choices=[('failed', 'Failed'), ('foundation', 'Foundation'), ('proficient', 'Proficient'), ('expert', 'Expert')], max_length=30)),
                ('display_name', models.CharField(max_length=100)),
                ('minimum_percentage', models.DecimalField(decimal_places=2, max_digits=5)),
                ('maximum_percentage', models.DecimalField(decimal_places=2, max_digits=5)),
                ('descriptor', models.TextField()),
                ('sequence', models.PositiveIntegerField()),
                ('rubric_criterion', models.ForeignKey(blank=True, db_column='rubric_criterion_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='bands', to='grading.rubriccriterion')),
            ],
            options={
                "db_table": "task_evidence_map",
            },
        ),
    ]
