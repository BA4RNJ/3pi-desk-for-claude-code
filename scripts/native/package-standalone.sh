#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"
APP="$ROOT/release/native-arm64/3PI Desk Native.app"
if pgrep -f "$APP/Contents/MacOS/DeskNative" >/dev/null 2>&1; then
 echo 'Close 3PI Desk Native before packaging; the running application will not be overwritten.' >&2
 exit 1
fi
[ "$(uname -m)" = arm64 ] || exit 1
mkdir -p .cache/node-runtime
ARCHIVE=.cache/node-runtime/node.tar.gz
if [ ! -f "$ARCHIVE" ]; then curl -fL https://nodejs.org/dist/v24.11.0/node-v24.11.0-darwin-arm64.tar.gz -o "$ARCHIVE"; fi
if [ ! -f .cache/node-runtime/SHASUMS256.txt ]; then curl -fL https://nodejs.org/dist/v24.11.0/SHASUMS256.txt -o .cache/node-runtime/SHASUMS256.txt; fi
python3 - <<'PY'
import hashlib
from pathlib import Path
p=Path('.cache/node-runtime')
expected=next(line.split()[0] for line in (p/'SHASUMS256.txt').read_text().splitlines() if line.endswith('  node-v24.11.0-darwin-arm64.tar.gz'))
assert hashlib.sha256((p/'node.tar.gz').read_bytes()).hexdigest() == expected, 'Node checksum mismatch'
PY
tar -xzf "$ARCHIVE" -C .cache/node-runtime
python3 scripts/native/sync-localization.py
scripts/native/build-bridge.sh
CLANG_MODULE_CACHE_PATH="$ROOT/.cache/clang" SWIFTPM_MODULECACHE_OVERRIDE="$ROOT/.cache/swift-modules" \
 swift build -c release --disable-sandbox --build-system native --package-path apps/macos --scratch-path .cache/swift-native
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Runtime/bin" "$APP/Contents/Resources/Runtime/agent/node_modules/@anthropic-ai"
cp .cache/swift-native/arm64-apple-macosx/release/DeskNative "$APP/Contents/MacOS/DeskNative"
ditto .cache/swift-native/arm64-apple-macosx/release/DeskNative_DeskNative.bundle "$APP/DeskNative_DeskNative.bundle"
cp .cache/node-runtime/node-v24.11.0-darwin-arm64/bin/node "$APP/Contents/Resources/Runtime/bin/node"
cp .cache/agent-bridge.cjs "$APP/Contents/Resources/Runtime/agent/bridge.cjs"
for PACKAGE in claude-agent-sdk claude-agent-sdk-darwin-arm64; do
 ditto "node_modules/@anthropic-ai/$PACKAGE" "$APP/Contents/Resources/Runtime/agent/node_modules/@anthropic-ai/$PACKAGE"
done
cp LICENSE THIRD_PARTY_NOTICES.md "$APP/Contents/Resources/"
cp .cache/node-runtime/node-v24.11.0-darwin-arm64/LICENSE "$APP/Contents/Resources/Node-LICENSE.txt"
APP_PATH_FOR_PREVIEW="$APP" python3 - <<'PY'
import os, plistlib
with open(os.environ['APP_PATH_FOR_PREVIEW']+'/Contents/Info.plist','wb') as f:
 plistlib.dump({'CFBundleName':'3PI Desk Native','CFBundleDisplayName':'3PI Desk Native','CFBundleIdentifier':'local.3pidesk.native','CFBundleExecutable':'DeskNative','CFBundlePackageType':'APPL','CFBundleShortVersionString':'0.4.1','CFBundleVersion':'3','NSHighResolutionCapable':True,'LSMinimumSystemVersion':'13.0'},f)
PY
printf '%s\n' "$APP"
