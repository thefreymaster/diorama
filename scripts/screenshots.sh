#!/usr/bin/env bash
#
# Regenerates the App Store screenshots in store/screenshots/.
#
#   bash scripts/screenshots.sh               # Release build for the Simulator, then the screenshots
#   bash scripts/screenshots.sh --skip-build  # reuse the last Release Simulator build
#
# What it does, without asking anything:
#   1. Builds the Release app for the Simulator (the JavaScript is bundled
#      inside, no dev menu, no Metro), unless --skip-build.
#   2. Boots its own 6.9-inch iPhone Simulator on iOS 27 ("Diorama Screenshots
#      6.9", created the first time), so your other Simulators stay as they are.
#   3. Installs the app fresh (default settings, no Recent), allows location
#      (so no prompt covers the picker), sets light mode and a 9:41 status bar.
#   4. Starts the app fresh for each screen, opens it by deep link, waits for
#      the maps to draw, and saves a PNG (whole screen, no alpha channel). The
#      stereo view is shot with the Simulator turned sideways (2868 × 1320).
#   5. Checks every file is an exact App Store 6.9-inch size, then shuts the
#      Simulator down (also when something fails).
#
# Every wait has a limit (macOS has no `timeout`, so `with_timeout` below does
# it). Change a screen's wait in SHOTS if its map needs longer to draw.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/store/screenshots/iphone-6.9"
LOG_DIR="$ROOT/ios/build/logs"
BUNDLE_ID="canvas23studios.diorama"
WORKSPACE="$ROOT/ios/Diorama.xcworkspace"
SCHEME="Diorama"

# The Simulator: App Store Connect's required iPhone size is 6.9-inch
# (1320 × 2868), which the Pro Max iPhones have. Override with env vars.
DEVICE_NAME="${SCREENSHOT_DEVICE_NAME:-Diorama Screenshots 6.9}"
DEVICE_TYPE="${SCREENSHOT_DEVICE_TYPE:-com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro-Max}"
RUNTIME="${SCREENSHOT_RUNTIME:-com.apple.CoreSimulator.SimRuntime.iOS-27-0}"

# Where the Simulator stands for "Current location" (Times Square).
SIM_LOCATION="40.7580,-73.9855"

# The App Store's 6.9-inch sizes, portrait and landscape.
ACCEPTED_SIZES=" 1260x2736 1290x2796 1320x2868 2736x1260 2796x1290 2868x1320 "

# Each screenshot: file name | deep link ("" for the picker) | seconds to wait
# | orientation. The app starts fresh for each one, and the link then opens its
# screen on top of the picker. Upright (full screen) comes before stereo on
# purpose: the store shows first that no headset is needed.
SHOTS=(
  "01-picker||8|portrait"
  "02-preview|diorama://city/new-york|20|portrait"
  "03-viewer-upright|diorama://view/new-york|25|portrait"
  "05-search|diorama://?q=grand%20canyon|12|portrait"
  "06-choose-on-map|diorama://pick?lat=48.8584&lon=2.2945&span=2000|15|portrait"
  "07-settings|diorama://settings|15|portrait"
  # Sideways last: turning the Simulator back upright can leave the Dynamic
  # Island drawn in the next screenshot. The numbers set the upload order.
  "04-viewer-stereo|diorama://view/new-york|30|landscapeLeft"
)

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    -h | --help)
      sed -n '3,/^$/p' "$0" | sed -E 's/^# ?//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

step() { printf '\n▸ %s\n' "$*"; }
fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

# Runs a command and stops it after $1 seconds, so nothing can hang.
with_timeout() {
  local limit=$1 waited=0
  shift
  "$@" &
  local pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if ((waited >= limit)); then
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      printf 'error: gave up after %ss: %s\n' "$limit" "$*" >&2
      return 124
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "$pid"
}

# ── 1. The Release build ─────────────────────────────────────────────────────

[[ -d "$WORKSPACE" ]] || {
  step "ios/ is missing: regenerating it (npm run ios:prepare)"
  (cd "$ROOT" && npm run ios:prepare)
}

BUILD_ARGS=(-workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release
  -sdk iphonesimulator -destination "generic/platform=iOS Simulator")

if ((SKIP_BUILD == 0)); then
  step "Building the Release app for the Simulator (log: ios/build/logs/screenshots-build.log)"
  mkdir -p "$LOG_DIR"
  if ! with_timeout 2400 xcodebuild "${BUILD_ARGS[@]}" build >"$LOG_DIR/screenshots-build.log" 2>&1; then
    grep -E "error:|BUILD FAILED" "$LOG_DIR/screenshots-build.log" | head -20 >&2 || true
    fail "the build failed; see ios/build/logs/screenshots-build.log"
  fi
fi

PRODUCTS_DIR="$(with_timeout 180 xcodebuild "${BUILD_ARGS[@]}" -showBuildSettings 2>/dev/null |
  awk -F' = ' '/^ *BUILT_PRODUCTS_DIR = / { print $2; exit }')"
APP="$PRODUCTS_DIR/Diorama.app"
[[ -d "$APP" ]] || fail "no Release Simulator build at $APP (run without --skip-build)"
echo "App: $APP"

# ── 2. The Simulator ─────────────────────────────────────────────────────────

step "Starting the $DEVICE_NAME Simulator"
UDID="$(xcrun simctl list devices | sed -n "s/^ *$DEVICE_NAME (\([0-9A-F-]*\)).*/\1/p" | head -1)"
if [[ -z "$UDID" ]]; then
  UDID="$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$RUNTIME")"
  echo "Created $UDID ($DEVICE_TYPE, $RUNTIME)"
fi
xcrun simctl boot "$UDID" 2>/dev/null || true # Fails only when it's already booted.

# However the script ends, turn the Simulator upright and shut it down.
cleanup() {
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  with_timeout 30 xcrun devicectl device orientation set --device "$UDID" portrait >/dev/null 2>&1 || true
  xcrun simctl status_bar "$UDID" clear 2>/dev/null || true
  with_timeout 120 xcrun simctl shutdown "$UDID" 2>/dev/null || true
}
trap cleanup EXIT
with_timeout 600 xcrun simctl bootstatus "$UDID" >/dev/null || fail "the Simulator didn't finish booting"

# `simctl openurl` would ask "Open in Diorama?", and Xcode 27 has no
# Simulator.app to click it: approve the diorama:// scheme up front.
xcrun simctl spawn "$UDID" defaults write com.apple.launchservices.schemeapproval \
  "com.apple.CoreSimulator.CoreSimulatorBridge-->diorama" -string "$BUNDLE_ID"
with_timeout 30 xcrun simctl ui "$UDID" appearance light
with_timeout 30 xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged \
  --batteryLevel 100 --cellularBars 4 --wifiBars 3
with_timeout 30 xcrun simctl location "$UDID" set "$SIM_LOCATION" || true

step "Installing Diorama fresh"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
with_timeout 120 xcrun simctl install "$UDID" "$APP"
# Location is asked on tap, so it would never show here; allowing it up front
# keeps the "Current location" row in its normal state. The Simulator has no
# camera (the app skips its prompt there) and device motion needs no prompt.
with_timeout 60 xcrun simctl privacy "$UDID" grant location "$BUNDLE_ID" || true

# ── 3. The screenshots ───────────────────────────────────────────────────────

# Turns the Simulator (devicectl takes a Simulator's UDID too).
orient() {
  with_timeout 30 xcrun devicectl device orientation set --device "$UDID" "$1" >/dev/null 2>&1 ||
    echo "warning: couldn't turn the Simulator to $1" >&2
}

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.png

for shot in "${SHOTS[@]}"; do
  IFS='|' read -r name url wait_seconds orientation <<<"$shot"
  file="$OUT_DIR/$name.png"
  step "$name: ${url:-(picker)}"
  orient portrait
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  # Launch first, then open the link in the running app: a cold start straight
  # into the Viewer can outlast `simctl openurl`'s own time limit.
  with_timeout 60 xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null || fail "couldn't launch Diorama"
  sleep 4
  if [[ -n "$url" ]]; then
    with_timeout 60 xcrun simctl openurl "$UDID" "$url" || fail "couldn't open $url"
  fi
  if [[ "$orientation" != portrait ]]; then
    sleep 4 # Let the screen come up upright first, as a hand would turn it.
    orient "$orientation"
  fi
  # A fixed wait: the maps stream their tiles over the network, and the
  # preview never stops turning, so there's no "done" to wait for.
  sleep "$wait_seconds"
  # `--mask=ignored`: the whole rectangular screen, without the rounded
  # corners cut out (the App Store rounds them itself).
  with_timeout 30 xcrun simctl io "$UDID" screenshot --type=png --mask=ignored "$file" >/dev/null 2>&1
done
orient portrait

# The App Store refuses PNGs with an alpha channel, and the Simulator's have
# one (fully opaque). This small Swift program redraws each PNG without it,
# pixel for pixel, with the same colors. It's a build tool, not app code.
step "Removing the alpha channel"
OPAQUE_SWIFT="$(mktemp -t diorama-opaque).swift"
cat >"$OPAQUE_SWIFT" <<'SWIFT'
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// For each PNG path given: read it, draw it into an RGB canvas with no alpha,
// and write it back over the same file.
for path in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: path) as CFURL
  guard let source = CGImageSourceCreateWithURL(url, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
    let space = image.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB),
    let canvas = CGContext(
      data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
      bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
  else { fatalError("Can't read \(path)") }
  canvas.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
  guard let opaque = canvas.makeImage(),
    let destination = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil)
  else { fatalError("Can't redraw \(path)") }
  CGImageDestinationAddImage(destination, opaque, nil)
  guard CGImageDestinationFinalize(destination) else { fatalError("Can't write \(path)") }
}
SWIFT
with_timeout 300 xcrun swift "$OPAQUE_SWIFT" "$OUT_DIR"/*.png
rm -f "$OPAQUE_SWIFT"

# ── 4. Check the sizes ───────────────────────────────────────────────────────

step "Checking sizes"
bad=0
for file in "$OUT_DIR"/*.png; do
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ { print $2 }')"
  height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ { print $2 }')"
  alpha="$(sips -g hasAlpha "$file" | awk '/hasAlpha/ { print $2 }')"
  if [[ "$ACCEPTED_SIZES" == *" ${width}x${height} "* && "$alpha" == no ]]; then
    echo "  ok   ${width} × ${height}  ${file#"$ROOT"/}"
  else
    echo "  BAD  ${width} × ${height}, alpha: $alpha  ${file#"$ROOT"/} (needs a 6.9-inch size, no alpha)"
    bad=1
  fi
done

((bad == 0)) || fail "some screenshots aren't an App Store size; pick another SCREENSHOT_DEVICE_TYPE"
step "Done: $(ls "$OUT_DIR"/*.png | wc -l | tr -d ' ') screenshots in ${OUT_DIR#"$ROOT"/}"
