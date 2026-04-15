#!/usr/bin/env bash
# Build the CrowdListen SKILL.md SDK tarball for distribution.
# Output: crowdlisten-sdk.tar.gz + skill.json with version and checksum.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_SRC="$REPO_ROOT/skills/crowdlisten"
OUT_DIR="${1:-$REPO_ROOT/dist}"

mkdir -p "$OUT_DIR"

# Read version from skill.json
VERSION=$(node -e "console.log(require('$SDK_SRC/skill.json').version)")

echo "Building CrowdListen SDK v${VERSION}..."

# Create tarball (strip leading path so it extracts flat)
tar -czf "$OUT_DIR/crowdlisten-sdk.tar.gz" \
  -C "$SDK_SRC" \
  --exclude='templates/credentials.json' \
  .

# Compute checksum
CHECKSUM=$(shasum -a 256 "$OUT_DIR/crowdlisten-sdk.tar.gz" | cut -d' ' -f1)

# Write manifest
cat > "$OUT_DIR/skill.json" <<EOF
{
  "name": "@crowdlisten/sdk",
  "version": "${VERSION}",
  "checksum_sha256": "${CHECKSUM}",
  "install": "curl -sL https://crowdlisten.com/sdk/crowdlisten-sdk.tar.gz | tar -xz -C skills/crowdlisten/",
  "files": $(cd "$SDK_SRC" && find . -type f -not -name 'credentials.json' | sort | node -e "const lines=require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n'); console.log(JSON.stringify(lines))")
}
EOF

echo "SDK built: $OUT_DIR/crowdlisten-sdk.tar.gz (${VERSION}, sha256:${CHECKSUM:0:12}...)"
echo "Manifest:  $OUT_DIR/skill.json"
