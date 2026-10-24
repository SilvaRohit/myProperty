# Deployment after an infrastructure rebuild

The infrastructure companion change creates
`/property-app/dev/deployment/instance-id` in Parameter Store and keeps its value
current through HCP Terraform. This application change resolves that value
before deployment or rollback.

## One-time adoption

1. Apply the reviewed infrastructure adoption plan first, including the target
   parameter and scoped `ssm:GetParameter` permission on the existing GitHub role.
2. Merge this application change into `aws-deployment`.
3. Add repository Actions variable
   `EC2_TARGET_PARAMETER=/property-app/dev/deployment/instance-id`.
4. Keep `AUTO_DEPLOY_ENABLED=true`, the OIDC role and SSM document variables.

Without `EC2_TARGET_PARAMETER`, workflows keep the legacy `EC2_INSTANCE_ID`
behavior. With it, a missing/unreadable parameter, invalid ID or `offline` value
fails rather than falling back to a stale instance.

## Normal rebuild

Use the [infrastructure rebuild guide](https://github.com/SilvaRohit/myProperty-infra/blob/main/docs/REBUILD.md)
to test the rehearsal, retain backups, remove only disposable infrastructure,
and recreate with fresh or snapshot-restored PostgreSQL. New EC2 user data
installs the deployment runtime and starts an explicitly selected ECR image.
The deployment SSM document waits for bootstrap completion on a rebuilt host.

After bootstrap is healthy, run the existing build/deploy workflow on
`aws-deployment`. Neither a new EC2 ID edit nor a Compose image edit is required.
Rollback still swaps application images; it does not restore database rows,
uploaded documents or a previous configuration secret. A fresh EC2 starts with
no previous-image rollback history.

No business application code or production-mode conversion is included here.
This change keeps the current workflow-time HTTPS check; it does not add a
scheduled availability monitor.
