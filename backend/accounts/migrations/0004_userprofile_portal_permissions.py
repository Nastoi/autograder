from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_portalactivity"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="can_access_user_management",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="can_create_users",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="can_reset_passwords",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="can_toggle_users",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="can_view_logs",
            field=models.BooleanField(default=False),
        ),
    ]
