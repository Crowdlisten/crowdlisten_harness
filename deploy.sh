#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Validate .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

echo "Building and starting crowdlisten-harness..."
docker compose up -d --build

echo "Waiting for health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3848/health > /dev/null 2>&1; then
    echo "Harness is healthy."
    curl -s http://localhost:3848/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3848/health
    exit 0
  fi
  sleep 2
done

echo "ERROR: Health check failed after 60s. Check logs:"
echo "  docker compose logs --tail=30 harness"
exit 1
