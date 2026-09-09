#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT="$ROOT/dist/Thrnd_Extension_v8.1.zip"

command -v zip >/dev/null 2>&1 || {
  printf '%s\n' 'The zip command is required to package the extension.' >&2
  exit 1
}

mkdir -p "$ROOT/dist"
rm -f "$OUTPUT"
(cd "$ROOT/extension" && zip -qr "$OUTPUT" . -x '*.DS_Store' 'legacy/*')
printf 'Created %s\n' "$OUTPUT"
