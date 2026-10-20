#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly ROOT=/opt/property-app-deploy
readonly APP=/home/ubuntu/myProperty/code
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
die() { printf '%s\n' "$*" >&2; exit 1; }
[[ $EUID == 0 ]] || die 'Run with sudo bash deploy/bootstrap-ec2.sh.'
for command in docker aws curl flock python3; do
  command -v "$command" >/dev/null || die "Missing prerequisite: $command"
done
docker compose version >/dev/null
[[ -s "$APP/.env" && -s "$APP/certs/global-bundle.pem" ]] || die 'Existing .env or RDS CA bundle is missing.'
for file in compose.yml deploy.sh check-db.mjs; do
  [[ -f "$SOURCE/$file" ]] || die "Missing deployment file: $file"
done

# Discover the running service rather than guessing a volume or adopting an empty one.
mapfile -t containers < <(docker ps --filter label=com.docker.compose.service=web --format '{{.ID}}')
[[ ${#containers[@]} == 1 ]] || die 'Expected exactly one running Compose web service. Start the existing app first.'
container=${containers[0]}
project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")
image=$(docker inspect --format '{{.Config.Image}}' "$container")
volume=$(docker inspect --format '{{range .Mounts}}{{if and (eq .Destination "/app/uploads") (eq .Type "volume")}}{{.Name}}{{end}}{{end}}' "$container")
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die 'Invalid Compose project name.'
[[ "$image" =~ ^[a-zA-Z0-9][a-zA-Z0-9._:/@-]*$ ]] || die 'Invalid current image reference.'
[[ "$volume" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || die 'Existing named uploads volume was not found.'
docker volume inspect "$volume" >/dev/null
curl --fail --silent --max-time 10 http://127.0.0.1:5173/ >/dev/null || die 'Existing app must respond successfully before adoption.'
install -d -m 700 "$ROOT"
exec 9>"$ROOT/deploy.lock"
flock -w 5 9 || die 'Deployment is running. Retry bootstrap later.'

if [[ ! -f "$ROOT/release.env" ]]; then
  printf 'APP_IMAGE=%s\nUPLOADS_VOLUME=%s\n' "$image" "$volume" >"$ROOT/release.env"
  printf '%s\n' "$project" >"$ROOT/project-name"
  if [[ "$image" =~ :sha-[0-9a-f]{40}-run-([0-9]+)-[0-9]+$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}" >"$ROOT/highest-run-id"
  fi
  if [[ -f "$APP/docker-compose.yml" ]]; then
    cp "$APP/docker-compose.yml" "$ROOT/compose.before-adoption.yml"
  fi
else
  [[ "$(cat "$ROOT/project-name")" == "$project" ]] || die 'Existing deployment project does not match the running app.'
  [[ "$(sed -n 's/^UPLOADS_VOLUME=//p' "$ROOT/release.env")" == "$volume" ]] || die 'Existing deployment volume does not match the running app.'
fi
install -m 600 "$SOURCE/compose.yml" "$ROOT/compose.yml"
install -m 600 "$SOURCE/check-db.mjs" "$ROOT/check-db.mjs"
install -m 700 "$SOURCE/deploy.sh" "$ROOT/deploy.sh"
docker compose --project-name "$project" --env-file "$ROOT/release.env" --file "$ROOT/compose.yml" config --quiet
printf 'Ready. Project: %s; existing uploads volume: %s\n' "$project" "$volume"
printf '%s\n' 'No application container was restarted. Deployments now use /opt/property-app-deploy.'
