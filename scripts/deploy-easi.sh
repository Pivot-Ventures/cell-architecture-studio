#!/usr/bin/env bash
# Build for the EASI mount and sync to the BASI droplet, where Caddy serves
# /opt/basi/human-atlas-static/cells at https://easi.pivotventures.tech/atlas/cells/.
#
# Usage: scripts/deploy-easi.sh [user@host] [ssh-key]
#   defaults: root@204.48.26.134, ~/.ssh/basi_do
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-root@204.48.26.134}"
KEY="${2:-$HOME/.ssh/basi_do}"
DEST="/opt/basi/human-atlas-static/cells"

BASE_PATH=/atlas/cells/ npm run build
grep -q '/atlas/cells/assets/' dist/index.html || { echo "dist is not an EASI build" >&2; exit 1; }

ssh -i "$KEY" "$TARGET" "mkdir -p $DEST"
rsync -az --delete -e "ssh -i $KEY" dist/ "$TARGET:$DEST/"
rsync -az -e "ssh -i $KEY" LICENSE docs/ASSETS.md "$TARGET:$DEST/"

ssh -i "$KEY" "$TARGET" "set -e
  test -f $DEST/index.html
  test -f $DEST/models/plant-cell-first001.glb
  curl -fsS --max-time 10 -H 'Host: easi.pivotventures.tech' -o /tmp/cells.check http://127.0.0.1/atlas/cells/
  grep -q '/atlas/cells/assets/' /tmp/cells.check
  curl -fsS --max-time 10 -H 'Host: easi.pivotventures.tech' -o /dev/null -w 'plant model %{http_code} %{size_download} bytes\n' http://127.0.0.1/atlas/cells/models/plant-cell-first001.glb
  echo 'Caddy is serving the Cell Architecture Studio at /atlas/cells/'"
