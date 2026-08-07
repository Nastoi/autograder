from django.db import migrations


def create_submission_page_table(apps, schema_editor):
    SubmissionPage = apps.get_model(
        "submissions",
        "SubmissionPage",
    )

    existing_tables = schema_editor.connection.introspection.table_names()

    if SubmissionPage._meta.db_table not in existing_tables:
        schema_editor.create_model(SubmissionPage)


def remove_submission_page_table(apps, schema_editor):
    SubmissionPage = apps.get_model(
        "submissions",
        "SubmissionPage",
    )

    existing_tables = schema_editor.connection.introspection.table_names()

    if SubmissionPage._meta.db_table in existing_tables:
        schema_editor.delete_model(SubmissionPage)


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0002_learnersubmission_submission_track"),
    ]

    operations = [
        migrations.RunPython(
            create_submission_page_table,
            remove_submission_page_table,
        ),
    ]