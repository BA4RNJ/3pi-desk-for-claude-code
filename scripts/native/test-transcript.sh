#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"
mkdir -p .cache/swift-modules
swiftc -module-cache-path "$ROOT/.cache/swift-modules" apps/macos/Sources/DeskNative/Transcript.swift scripts/native/transcript-check.swift -o .cache/transcript-check
.cache/transcript-check
