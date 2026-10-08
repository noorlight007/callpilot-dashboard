#!/usr/bin/env bash
# Create a production-ready release branch from staging WITHOUT dev-server deploy files.
#   ./release.sh   -> pushes release/<date> ; open a PR from it into `production`
set -euo pipefail
cd "$(dirname "$0")"
git fetch -q origin
BR="release/$(date +%Y%m%d-%H%M)"
git checkout -q -b "$BR" origin/staging
git rm -q -f --ignore-unmatch deploy.sh Dockerfile docker-compose.yml .env.deploy.example .dockerignore \
  .github/workflows/deploy-dev.yml release.sh
git checkout origin/production -- .gitignore
git commit -q -m "Release staging to production (without dev-server deploy files)"
git push -q -u origin "$BR"
git checkout -q -
echo "Open PR: base=production, compare=$BR"
echo "https://github.com/noorlight007/callpilot-dashboard/compare/production...$BR?expand=1"
