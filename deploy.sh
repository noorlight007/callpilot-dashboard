#!/usr/bin/env bash
# Deploy this project to the dev server with Docker (no git needed).
#   ./deploy.sh
# Config comes from .env.deploy (see .env.deploy.example). No secrets live in this file.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env.deploy ] || { echo "Missing .env.deploy (copy .env.deploy.example)"; exit 1; }
set -a; . ./.env.deploy; set +a

SSH_OPTS="-o StrictHostKeyChecking=accept-new"
if [ -n "${DEV_SSH_PASSWORD:-}" ]; then
  command -v sshpass >/dev/null || { echo "Install sshpass or use an SSH key"; exit 1; }
  export SSHPASS="$DEV_SSH_PASSWORD"
  SSH="sshpass -e ssh $SSH_OPTS"; RSYNC_SSH="sshpass -e ssh $SSH_OPTS"
else
  SSH="ssh $SSH_OPTS"; RSYNC_SSH="ssh $SSH_OPTS"
fi
TARGET="$DEV_USER@$DEV_HOST"
SCREEN_NAME="${SCREEN_NAME:-callpilot}"
# Optional override, applied after the server .env is loaded (NEXT_PUBLIC_* is baked in at build time).
API_OVERRIDE="${API_BASE_URL:+export NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL;}"

echo "==> Syncing project to $TARGET:$REMOTE_DIR"
$SSH "$TARGET" "mkdir -p $REMOTE_DIR"
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude node_modules --exclude .next --exclude .git --exclude '.env*' --exclude '*.patch' --exclude .DS_Store \
  ./ "$TARGET:$REMOTE_DIR/"

# The server already has a live .env in $REMOTE_DIR; it is never created, read or changed here.
$SSH "$TARGET" "[ -f $REMOTE_DIR/.env ]" || { echo "No $REMOTE_DIR/.env on server, aborting"; exit 1; }

if [ "${DEPLOY_MODE:-screen}" = "screen" ]; then
  # Run inside a detached `screen` session (the way the dev server is usually run).
  echo "==> Building and (re)starting in screen session '$SCREEN_NAME'"
  $SSH "$TARGET" "cd $REMOTE_DIR && set -a && . ./.env && set +a && $API_OVERRIDE \
    (command -v screen >/dev/null || apt-get install -y screen) && \
    (npm ci --legacy-peer-deps || npm install --legacy-peer-deps) && npm run build && \
    (screen -S $SCREEN_NAME -X quit || true) && \
    screen -dmS $SCREEN_NAME bash -c 'cd $REMOTE_DIR && set -a && . ./.env && set +a && $API_OVERRIDE ${HOST_PORT:+PORT=$HOST_PORT} npm run start'"
  echo "    attach with: ssh $TARGET -t screen -r $SCREEN_NAME"
else
  echo "==> Building and starting container"
  $SSH "$TARGET" "cd $REMOTE_DIR && (screen -S $SCREEN_NAME -X quit || true) && (command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh) && $API_OVERRIDE docker compose up -d --build && docker image prune -f"
fi

echo "==> Done: http://$DEV_HOST:${HOST_PORT:-3000}"
