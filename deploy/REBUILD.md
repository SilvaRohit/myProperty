# Deployment after an infrastructure rebuild

**Updated:** 25 October 2026  
**Application branch:** `aws-deployment`  
**Infrastructure workspace:** `tecerotech/property-app-dev`

The infrastructure rebuild is automated and has been exercised. A reviewed HCP apply can recreate the primary network/EC2/RDS and start the selected retained ECR image. This app repository owns subsequent build/deploy and rollback workflows; the [infrastructure lifecycle guide](https://github.com/SilvaRohit/myProperty-infra/blob/main/docs/REBUILD.md) owns creation, recovery and decommission.

## One-time target setup already completed

In repository **Settings → Secrets and variables → Actions → Variables**, keep:

| Variable | Value |
|---|---|
| `EC2_TARGET_PARAMETER` | `/property-app/dev/deployment/instance-id` |
| `AUTO_DEPLOY_ENABLED` | `true` |
| `AWS_ROLE_ARN` | Existing GitHub OIDC role |
| `SSM_DEPLOY_DOCUMENT` | `property-app-dev-deploy-property-app` |
| `SSM_ROLLBACK_DOCUMENT` | `property-app-dev-rollback-property-app` |

The infrastructure manages the parameter and scoped read permission. Without a configured target parameter, the resolver supports legacy `EC2_INSTANCE_ID` behavior. With it configured, missing/denied lookups, invalid IDs or `offline` fail without falling back to the old ID.

Keep HCP AWS dynamic credentials separate from the app's GitHub OIDC role. No static AWS keys or GitHub SSH deployment key are required.

## Initial application startup

After a completed teardown, set the infrastructure recovery inputs:

- `lab_enabled=true`, `rebuild_mode=restore` for saved database data.
- Exact available `database_snapshot_identifier` and retained immutable `initial_image_uri`.
- An available `uploads_restore_s3_prefix` for first-boot document recovery, or blank for a later separate restore.
- `database_deletion_protection=true`, `rehearsal_enabled=false` and `adopt_legacy_database_security_group=false`.
- A different unused `final_snapshot_identifier` for the next teardown.

Review/apply in the existing HCP workspace. EC2 user data installs Docker/Compose, AWS CLI, SSM, Caddy, agent, deployment/backup/restore helpers and the CA bundle. It reads the retained configuration secret, substitutes the new RDS endpoint, starts the pinned app image and optionally restores uploads.

The app repository's `deploy/bootstrap-ec2.sh` is the older adoption helper for an already running service. Do not use that manual-adoption workflow to replace the infrastructure's fresh-host installer.

A new app build is not required merely to bring the saved version online. Rebuilt primary RDS uses a private-subnet DB group and verified TLS; restored schema synchronization is disabled. Production migrations and a dedicated SQL app login remain future work.

## Wait for readiness after HCP Applied

HCP can finish while the EC2 installer is still running. This delay was observed during the successful website rebuild. Use the current instance, not a previous EC2 ID.

On the Mac:

```bash
current_instance_id=$(aws ssm get-parameter \
  --region ap-southeast-7 \
  --name /property-app/dev/deployment/instance-id \
  --query 'Parameter.Value' \
  --output text)
printf '%s\n' "$current_instance_id"
```

Once SSM reports that instance Online, use Run Command on it to check:

```bash
cloud-init status --wait --long
test -f /opt/property-app-rebuild/completed
systemctl is-active docker caddy amazon-cloudwatch-agent
docker exec -i code-web-1 node --input-type=module < /opt/property-app-deploy/check-db.mjs
curl -fsSI --max-time 10 http://127.0.0.1:5173/
```

These commands run **on EC2 through SSM**, not directly in the Mac shell. The infrastructure guide includes the full Mac send-command/poll sequence. Success requires completed bootstrap, active services, verified DB TLS and local HTTP 200.

Then check from the Mac:

```bash
curl -fsSI --max-time 30 https://property.tecerotech.com/
```

Also inspect restored records and an expected uploaded file. Representative rehearsal counts were 1 property/10 units, and the synthetic recovered file contained `TeceroTech document recovery test`. These are sanity checks, not a complete integrity or product audit.

If unavailable, inspect cloud-init status/output, local port 5173, Caddy's journal and EIP/DNS association before rebuilding again. Keep secrets and dotenv output private. A completion marker is not a public certificate/HTTPS test, so retain both checks.

## Normal releases and rollback

After readiness passes, publish newer code with the existing build/test/deploy workflow on `aws-deployment`. It resolves the current target; neither an instance-ID edit nor a Compose image edit is needed. With automatic deployment enabled, target resolution happens before the image build, so a full build/deploy workflow can fail early while the lab is offline.

The push filter includes `deploy/**`, so merging a change to this guide into `aws-deployment` can trigger the normal build/deploy workflow even when only documentation changed. A documentation branch alone does not satisfy the deployment branch filter.

The SSM deploy/rollback documents wait when the bootstrap-start marker exists. Verify readiness before dispatching; this is not an unconditional startup gate from the earliest moment SSM registers.

Rollback changes application images. It does not restore database rows, document archives or an earlier configuration secret. A new host has no previous-image rollback history until later successful deployments establish it.

Image deployment does not synchronize every installed Compose/runtime file. Host-template updates still need a deliberate rollout.

## Decommission and the next rebuild

Use the [two-apply teardown](https://github.com/SilvaRohit/myProperty-infra/blob/main/docs/REBUILD.md#6-deliberately-turn-off-the-primary-lab):

1. Back up current uploads and record their successful S3 prefix.
2. With the lab still enabled, apply `database_deletion_protection=false` and a new unused `final_snapshot_identifier`.
3. Then set `lab_enabled=false` and review/apply removal of the disposable resources.
4. Verify the final snapshot is available/encrypted and the target parameter is `offline`.

An existing `database_snapshot_identifier` is the restore source. The next final-snapshot name must be different and unused. Generating a name on the Mac does not update HCP; save and apply it before disabling the module. The infrastructure guide documents recovery from `DBSnapshotAlreadyExists` after a partial teardown.

Keep `AUTO_DEPLOY_ENABLED=true`. No app-repository variable needs an old EC2 ID pasted back in after a rebuild.

After teardown, choose the new available snapshot and desired uploads prefix for the next restoration. Keep `rebuild_mode=restore` while a restored lab is running; changing bootstrap inputs can request replacement.

The EIP allocation, backups/images, configuration secret, required key/IAM resources and HCP state remain as recovery prerequisites and can still incur charges. Current S3 uploads backups expire after 30 days; preserve an independent archive/checksum for a longer shutdown.

## Scope

The lab remains Single-AZ with the Vite development runtime and known application limitations. No production-mode conversion, ALB/HA or scheduled availability monitor is included. Existing workflow-time HTTPS checks are retained.
