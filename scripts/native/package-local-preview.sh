#!/bin/sh
# Developer-only preview: uses the checkout's bridge/dependencies and local Node.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"
[ "$(uname -m)" = arm64 ] || { echo 'Apple Silicon is required.' >&2; exit 1; }
NODE=$(command -v node)
[ -x "$NODE" ] || { echo 'Node is required.' >&2; exit 1; }
python3 scripts/native/sync-localization.py
scripts/native/build-bridge.sh
mkdir -p .cache/clang .cache/swift-modules
CLANG_MODULE_CACHE_PATH="$ROOT/.cache/clang" SWIFTPM_MODULECACHE_OVERRIDE="$ROOT/.cache/swift-modules" \
  swift build --disable-sandbox --build-system native --package-path apps/macos --scratch-path .cache/swift-native
APP="$ROOT/release/native-preview/3PI Desk Native Preview.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .cache/swift-native/arm64-apple-macosx/debug/DeskNative "$APP/Contents/MacOS/DeskNative"
ditto .cache/swift-native/arm64-apple-macosx/debug/DeskNative_DeskNative.bundle "$APP/DeskNative_DeskNative.bundle"
NODE_PATH_FOR_PREVIEW="$NODE" APP_PATH_FOR_PREVIEW="$APP" ROOT_PATH_FOR_PREVIEW="$ROOT" python3 - <<'PY'
import os, plistlib, shlex
app = os.environ['APP_PATH_FOR_PREVIEW']
node = os.path.realpath(os.environ['NODE_PATH_FOR_PREVIEW'])
bridge = os.path.join(os.environ['ROOT_PATH_FOR_PREVIEW'], '.cache/agent-bridge.cjs')
script = '#!/bin/sh\nexport DESK_NATIVE_NODE=' + shlex.quote(node) + '\nexport DESK_NATIVE_BRIDGE=' + shlex.quote(bridge) + '\nexec "$(dirname "$0")/DeskNative"\n'
with open(app + '/Contents/MacOS/launch', 'w') as f: f.write(script)
os.chmod(app + '/Contents/MacOS/launch', 0o755)
with open(app + '/Contents/Info.plist', 'wb') as f:
    plistlib.dump({'CFBundleName':'3PI Desk Native Preview', 'CFBundleDisplayName':'3PI Desk Native Preview', 'CFBundleIdentifier':'local.3pidesk.native-preview', 'CFBundleExecutable':'launch', 'CFBundlePackageType':'APPL', 'CFBundleShortVersionString':'0.1.0', 'NSHighResolutionCapable':True, 'LSMinimumSystemVersion':'13.0'}, f)
PY
printf 'Local preview: %s\n' "$APP"
