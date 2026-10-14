from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0007_alter_learnersubmission_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="learnersubmission",
            name="failure_code",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="learnersubmission",
            name="failure_message",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="learnersubmission",
            name="failure_mitigation",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="learnersubmission",
            name="failed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
