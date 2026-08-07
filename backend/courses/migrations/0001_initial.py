
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='AssignmentLevel',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('level_code', models.CharField(choices=[('foundation', 'Foundation'), ('proficient', 'Proficient'), ('expert', 'Expert')], max_length=20)),
                ('display_name', models.CharField(max_length=100)),
                ('title', models.CharField(max_length=255)),
                ('instructions', models.TextField(blank=True)),
                ('tasks', models.JSONField(default=list)),
                ('deliverables', models.JSONField(default=list)),
                ('expected_outcome', models.TextField(blank=True)),
                ('source_filename', models.CharField(blank=True, max_length=255, null=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('configuration_status', models.CharField(choices=[('draft', 'Draft'), ('ready', 'Ready'), ('retired', 'Retired')], default='draft', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'assignment_level',
                'ordering': ('assignment__assignment_number', 'level_code'),
            },
        ),
        migrations.CreateModel(
            name='Cohort',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('code', models.CharField(max_length=100, unique=True)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ('code',),
            },
        ),
        migrations.CreateModel(
            name='Enrolment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('learner', 'Learner'), ('instructor', 'Instructor')], max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('enrolled_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ('module', 'user'),
            },
        ),
        migrations.CreateModel(
            name='Module',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=50)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'module',
                'ordering': ('code',),
            },
        ),
        migrations.CreateModel(
            name='ModuleAssignment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('assignment_number', models.PositiveIntegerField()),
                ('code', models.CharField(max_length=50)),
                ('title', models.CharField(max_length=255)),
                ('skill_statement_code', models.CharField(max_length=50)),
                ('skill_statement', models.TextField()),
                ('objective', models.TextField(blank=True)),
                ('maximum_score', models.DecimalField(decimal_places=2, max_digits=7)),
                ('minimum_pass_score', models.DecimalField(decimal_places=2, max_digits=7)),
                ('is_summative', models.BooleanField(default=True)),
                ('contributes_to_final_mark', models.BooleanField(default=True)),
                ('final_mark_weight', models.DecimalField(decimal_places=2, max_digits=5)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'module_assignment',
                'ordering': ('module', 'assignment_number'),
            },
        ),
        migrations.CreateModel(
            name='Qualification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'qualification',
                'ordering': ('code',),
            },
        ),
    ]
