#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ $EUID -ne 0 ]]; then
  echo "Run this script with sudo."
  exit 1
fi

env_file="/home/ubuntu/myProperty/code/.env"
backup_file="/opt/property-app-deploy/env.before-secrets"

# Coordinate with deployments and backups.
exec 9>/opt/property-app-deploy/deploy.lock
flock -w 300 9

candidate=$(mktemp /home/ubuntu/myProperty/code/.env.from-secrets.XXXXXX)
trap 'rm -f "$candidate"' EXIT

aws secretsmanager get-secret-value \
  --region ap-southeast-7 \
  --secret-id property-app/dev/config \
  --version-stage AWSCURRENT \
  --query SecretString \
  --output text \
  --no-cli-pager \
  > "$candidate"

# Check that the expected configuration entries exist.
for key in \
  DATABASE_HOST DATABASE_PORT DATABASE_NAME \
  DATABASE_USER DATABASE_PASSWORD JWT_SECRET JWT_EXPIRATION_TIME
do
  if ! grep -Eq \
    "^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=" \
    "$candidate"
  then
    echo "Missing configuration entry: $key" >&2
    exit 1
  fi
done

# Preserve the original configuration once, outside the Git repository.
if [[ ! -e "$backup_file" ]]; then
  install -m 0600 "$env_file" "$backup_file"
fi

# Replace the file only after retrieval and checks succeed.
chmod 0600 "$candidate"
mv -f "$candidate" "$env_file"

echo "Application configuration refreshed from Secrets Manager."