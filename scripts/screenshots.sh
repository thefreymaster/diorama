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
#      (so no prompt covers the picker), sets dark mode and a 9:41 status bar.
#   4. Starts the app fresh for each screen, opens it by deep link, waits for
#      the maps to draw, and saves a PNG (whole screen, no alpha channel). The
#      stereo view is shot with the Simulator turned sideways (2868 × 1320).
#      The place shots show the Magic Kingdom (Walt Disney World), which isn't
#      in the app's lists: before them the script opens it from Choose on map,
#      as a person would, so Apple Maps names it and it joins Recent.
#   5. Makes the 6.5-inch set from the 6.9-inch one (scaled, then cropped to
#      the middle: 1284 × 2778), checks every file is an exact App Store size,
#      then shuts the Simulator down (also when something fails).
#
# Every wait has a limit (macOS has no `timeout`, so `with_timeout` below does
# it). Change a screen's wait in SHOTS if its map needs longer to draw.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/store/screenshots/iphone-6.9"
OUT_DIR_65="$ROOT/store/screenshots/iphone-6.5"
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

# The App Store's sizes, portrait and landscape: 6.9-inch (what the Simulator
# takes) and 6.5-inch (made from it, for App Store Connect's 6.5" slot).
ACCEPTED_SIZES=" 1260x2736 1290x2796 1320x2868 2736x1260 2796x1290 2868x1320 "
ACCEPTED_SIZES_65=" 1242x2688 1284x2778 2688x1242 2778x1284 "

# The place in the store shots: the Magic Kingdom at Walt Disney World, just
# south of Cinderella Castle, so the upright view looks up Main Street U.S.A.
# at the castle (a picked spot faces north, 60° pitch, 600 m out). The
# Choose-on-map link names the spot (Apple Maps calls it "Magic Kingdom
# Park"), and with `open=1` it also taps "Open Mini City".
PLACE_LAT=28.4190
PLACE_LON=-81.5812
PICK_LINK="diorama://pick?lat=$PLACE_LAT&lon=$PLACE_LON&span=1000"

# Each screenshot: file name | deep link ("" for the picker) | seconds to wait
# | orientation. The app starts fresh for each one, and the link then opens its
# screen on top of the picker. `{place}` in a link is the Magic Kingdom's id
# in Recent (see open_place below). Upright (full screen) comes before stereo
# on purpose: the store shows first that no headset is needed.
SHOTS=(
  "01-picker||8|portrait"
  # Short on purpose: the preview turns 3° a second once its map has drawn
  # (already cached by then), and early on it still looks up Main Street.
  "02-preview|diorama://city/{place}|6|portrait"
  "03-viewer-upright|diorama://view/{place}|25|portrait"
  "05-search|diorama://?q=grand%20canyon|12|portrait"
  "06-choose-on-map|$PICK_LINK|15|portrait"
  "07-settings|diorama://settings|15|portrait"
  # Sideways last: turning the Simulator back upright can leave the Dynamic
  # Island drawn in the next screenshot. The numbers set the upload order.
  "04-viewer-stereo|diorama://view/{place}|30|landscapeLeft"
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
with_timeout 30 xcrun simctl ui "$UDID" appearance dark
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

# Starts the app fresh, upright, and opens $1 in it ("" opens nothing).
launch_with_link() {
  orient portrait
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  # Launch first, then open the link in the running app: a cold start straight
  # into the Viewer can outlast `simctl openurl`'s own time limit.
  with_timeout 60 xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null || fail "couldn't launch Diorama"
  sleep 4
  if [[ -n "$1" ]]; then
    with_timeout 60 xcrun simctl openurl "$UDID" "$1" || fail "couldn't open $1"
  fi
}

# Opens the Magic Kingdom from Choose on map, as a tap on "Open Mini City"
# would: Apple Maps names it, it joins Recent, and its preview opens (which
# also caches its map for the preview shot). Then reads its id back from the
# app's saved Recent (react-native-mmkv keeps it as JSON text in
# Documents/mmkv/diorama), so the Viewer links can open it by id.
PLACE_ID=""
open_place() {
  step "Opening the Magic Kingdom from Choose on map (it joins Recent)"
  launch_with_link "$PICK_LINK&open=1"
  sleep 15
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  local data saved lat lon
  data="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)" || fail "can't find Diorama's data folder"
  # A place's id ends in its coordinates to 3 places, e.g. _28.419_-81.581.
  lat="$(printf '%.3f' "$PLACE_LAT")"
  lon="$(printf '%.3f' "$PLACE_LON")"
  saved="$(grep -aoE "\{\"id\":\"[a-z0-9-]+_${lat//./\.}_${lon//./\.}\",\"name\":\"[^\"]*\"" \
    "$data/Documents/mmkv/diorama" 2>/dev/null | tail -1 || true)"
  PLACE_ID="$(cut -d'"' -f4 <<<"$saved")"
  local place_name
  place_name="$(cut -d'"' -f8 <<<"$saved")"
  [[ -n "$PLACE_ID" ]] || fail "the Magic Kingdom didn't join Recent (is Choose on map's open=1 still there?)"
  # Named by its coordinates: Apple Maps didn't answer in time.
  [[ "$place_name" != *°* ]] || fail "Apple Maps didn't name the spot ($place_name); check the network and run again"
  echo "In Recent as \"$place_name\" ($PLACE_ID)"
}

mkdir -p "$OUT_DIR" "$OUT_DIR_65"
rm -f "$OUT_DIR"/*.png "$OUT_DIR_65"/*.png

for shot in "${SHOTS[@]}"; do
  IFS='|' read -r name url wait_seconds orientation <<<"$shot"
  if [[ "$url" == *"{place}"* ]]; then
    [[ -n "$PLACE_ID" ]] || open_place
    url="${url//\{place\}/$PLACE_ID}"
  fi
  file="$OUT_DIR/$name.png"
  step "$name: ${url:-(picker)}"
  launch_with_link "$url"
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

# The 6.5-inch set: each shot scaled so its short side is 1284 pixels, then
# its long side cropped to the middle 2778 (from 1320 × 2868 that trims 6
# pixels off each end).
step "Making the 6.5-inch set"
for file in "$OUT_DIR"/*.png; do
  small="$OUT_DIR_65/$(basename "$file")"
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ { print $2 }')"
  height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ { print $2 }')"
  if ((width < height)); then
    sips --resampleWidth 1284 "$file" --out "$small" >/dev/null
    sips -c 2778 1284 "$small" >/dev/null
  else
    sips --resampleHeight 1284 "$file" --out "$small" >/dev/null
    sips -c 1284 2778 "$small" >/dev/null
  fi
done

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
with_timeout 300 xcrun swift "$OPAQUE_SWIFT" "$OUT_DIR"/*.png "$OUT_DIR_65"/*.png
rm -f "$OPAQUE_SWIFT"

# ── 4. Check the sizes ───────────────────────────────────────────────────────

step "Checking sizes"
bad=0
# check_sizes <folder> <accepted sizes> <label>
check_sizes() {
  local file width height alpha
  for file in "$1"/*.png; do
    width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ { print $2 }')"
    height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ { print $2 }')"
    alpha="$(sips -g hasAlpha "$file" | awk '/hasAlpha/ { print $2 }')"
    if [[ "$2" == *" ${width}x${height} "* && "$alpha" == no ]]; then
      echo "  ok   ${width} × ${height}  ${file#"$ROOT"/}"
    else
      echo "  BAD  ${width} × ${height}, alpha: $alpha  ${file#"$ROOT"/} (needs a $3 size, no alpha)"
      bad=1
    fi
  done
}
check_sizes "$OUT_DIR" "$ACCEPTED_SIZES" 6.9-inch
check_sizes "$OUT_DIR_65" "$ACCEPTED_SIZES_65" 6.5-inch

((bad == 0)) || fail "some screenshots aren't an App Store size; pick another SCREENSHOT_DEVICE_TYPE"
step "Done: $(ls "$OUT_DIR"/*.png | wc -l | tr -d ' ') screenshots in ${OUT_DIR#"$ROOT"/} and ${OUT_DIR_65#"$ROOT"/}"
