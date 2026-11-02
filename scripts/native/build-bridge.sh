#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"
mkdir -p .cache
./node_modules/.bin/rolldown -c packages/agent-bridge/rolldown.config.mjs
