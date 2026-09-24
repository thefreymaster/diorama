#!/usr/bin/env bash
# npm run ios:prepare
#   Regenerates ios/ from app.json (`expo prebuild --clean`, CocoaPods
#   included), then checks what an App Store build needs: team, bundle id,
#   version and build number, export compliance, icon, privacy manifest.
#
# npm run ios:xcode  (same script with --open)
#   Then opens the workspace in Xcode for Product → Archive by hand.
#
# Run from anywhere; never asks questions. See docs/app-store.md.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -t 1 ]; then
  BOLD=$'\033[1m' RED=$'\033[31m' GREEN=$'\033[32m' RESET=$'\033[0m'
else
  BOLD='' RED='' GREEN='' RESET=''
fi
step() { printf '\n%s▸ %s%s\n' "$BOLD" "$*" "$RESET"; }
fail() {
  printf '\n%sios:prepare failed:%s %s\n' "$RED" "$RESET" "$1" >&2
  shift
  for line in "$@"; do printf '  %s\n' "$line" >&2; done
  exit 1
}

OPEN_XCODE=0
for arg in "$@"; do
  case "$arg" in
    --open) OPEN_XCODE=1 ;;
    *) fail "unknown option '$arg'." "Usage: scripts/ios-prepare.sh [--open]" ;;
  esac
done

# ── Tools ────────────────────────────────────────────────────────────────
[ "$(uname -s)" = Darwin ] || fail "iOS builds need a Mac."
command -v node >/dev/null || fail "Node isn't installed."
[ -d node_modules ] || fail "node_modules is missing." "Run: npm install"
command -v pod >/dev/null || fail "CocoaPods isn't installed." "Install it: brew install cocoapods"
xcodebuild -version >/dev/null 2>&1 ||
  fail "xcodebuild doesn't work. Xcode must be installed and selected." \
    "Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"

# ── What app.json asks for ───────────────────────────────────────────────
# Prints one app.json value (a JS expression on `e`, the "expo" object).
app_json() { node -p "const e = require('./app.json').expo; String(($1) ?? '')"; }

VERSION=$(app_json 'e.version')
BUILD=$(app_json 'e.ios?.buildNumber')
BUNDLE_ID=$(app_json 'e.ios?.bundleIdentifier')
TEAM=$(app_json 'e.ios?.appleTeamId')
ENCRYPTION=$(app_json 'e.ios?.config?.usesNonExemptEncryption')
[ -n "$VERSION" ] || fail "app.json has no expo.version."
[ -n "$BUILD" ] || fail "app.json has no expo.ios.buildNumber." "Run: npm run bump"
[ -n "$BUNDLE_ID" ] || fail "app.json has no expo.ios.bundleIdentifier."
[ -n "$TEAM" ] || fail "app.json has no expo.ios.appleTeamId (the Apple Developer team)."
[ "$ENCRYPTION" = false ] ||
  fail "app.json must set expo.ios.config.usesNonExemptEncryption to false." \
    "Diorama uses no encryption beyond Apple's own, so App Store Connect needs no export paperwork."

# ── Regenerate ios/ ──────────────────────────────────────────────────────
step "Regenerating ios/ from app.json (expo prebuild --clean, then pods)"
CI=1 EXPO_NO_GIT_STATUS=1 npx expo prebuild -p ios --clean ||
  fail "expo prebuild failed. The error is above."

# ── Checks ───────────────────────────────────────────────────────────────
step "Checking the generated project"

shopt -s nullglob
workspaces=(ios/*.xcworkspace)
shopt -u nullglob
[ "${#workspaces[@]}" -eq 1 ] || fail "expected one ios/*.xcworkspace, found ${#workspaces[@]}."
WORKSPACE=${workspaces[0]}
APP=$(basename "$WORKSPACE" .xcworkspace)

# Prebuild only warns when `pod install` fails, so check the pods here.
[ -f ios/Podfile.lock ] && [ -f ios/Pods/Manifest.lock ] ||
  fail "CocoaPods didn't install (no ios/Pods/Manifest.lock)." \
    "Look for the pod install error above, or run: (cd ios && pod install)"
cmp -s ios/Podfile.lock ios/Pods/Manifest.lock ||
  fail "ios/Pods is out of sync with ios/Podfile.lock." "Run: (cd ios && pod install)"

# The app target's Release build settings, as NAME=value lines.
settings_json=$(xcodebuild -showBuildSettings -json -workspace "$WORKSPACE" -scheme "$APP" \
  -configuration Release -sdk iphoneos 2>/dev/null) ||
  fail "xcodebuild couldn't read the $APP scheme's build settings."
SETTINGS=$(node -e '
  const [app, json] = [process.argv[1], require("fs").readFileSync(0, "utf8")];
  const target = JSON.parse(json).find((t) => t.target === app);
  if (!target) process.exit(1);
  for (const [k, v] of Object.entries(target.buildSettings)) console.log(`${k}=${v}`);
' "$APP" <<<"$settings_json") || fail "the $APP scheme has no $APP target."
setting() { awk -v key="$1=" 'index($0, key) == 1 { print substr($0, length(key) + 1); exit }' <<<"$SETTINGS"; }

# Info.plist values may be literal or "$(BUILD_SETTING)".
INFO_PLIST="ios/$(setting INFOPLIST_FILE)"
[ -f "$INFO_PLIST" ] || fail "no Info.plist at $INFO_PLIST."
plist_value() {
  local value
  value=$(/usr/libexec/PlistBuddy -c "Print :$1" "$INFO_PLIST" 2>/dev/null) || return 0
  if [[ "$value" =~ ^\$[\(\{]([A-Za-z0-9_]+)[\)\}]$ ]]; then
    setting "${BASH_REMATCH[1]}"
  else
    printf '%s\n' "$value"
  fi
}

# Compares one generated value with the one app.json asks for.
expect() {
  local label=$1 actual=$2 wanted=$3
  [ "$actual" = "$wanted" ] ||
    fail "$label is '$actual', but app.json says '$wanted'." \
      "Edit app.json, not ios/ (it's regenerated), then run this again."
}
expect "DEVELOPMENT_TEAM" "$(setting DEVELOPMENT_TEAM)" "$TEAM"
expect "PRODUCT_BUNDLE_IDENTIFIER" "$(setting PRODUCT_BUNDLE_IDENTIFIER)" "$BUNDLE_ID"
expect "CFBundleIdentifier" "$(plist_value CFBundleIdentifier)" "$BUNDLE_ID"
expect "CFBundleShortVersionString" "$(plist_value CFBundleShortVersionString)" "$VERSION"
expect "CFBundleVersion" "$(plist_value CFBundleVersion)" "$BUILD"
[ "$(plist_value ITSAppUsesNonExemptEncryption)" = false ] ||
  fail "Info.plist doesn't set ITSAppUsesNonExemptEncryption to NO."
SIGN_STYLE=$(setting CODE_SIGN_STYLE) # unset means Automatic
[ "${SIGN_STYLE:-Automatic}" = Automatic ] ||
  fail "CODE_SIGN_STYLE is '$SIGN_STYLE'; the pipeline expects automatic signing."

# The icon: an Icon Composer .icon next to Info.plist, or an asset catalog set.
ICON=$(setting ASSETCATALOG_COMPILER_APPICON_NAME)
[ -n "$ICON" ] || fail "no app icon is set (ASSETCATALOG_COMPILER_APPICON_NAME)."
APP_DIR=$(dirname "$INFO_PLIST")
if [ -f "$APP_DIR/$ICON.icon/icon.json" ]; then
  ICON_SOURCE="$ICON.icon (Icon Composer)"
elif [ -d "$APP_DIR/Images.xcassets/$ICON.appiconset" ]; then
  ICON_SOURCE="$ICON.appiconset"
else
  fail "the app icon '$ICON' isn't in $APP_DIR." "Check expo.ios.icon in app.json."
fi

# The privacy manifest must be in the app and declare everything app.json does.
PRIVACY="$APP_DIR/PrivacyInfo.xcprivacy"
[ -f "$PRIVACY" ] || fail "no $PRIVACY." "Check expo.ios.privacyManifests in app.json."
grep -q "PrivacyInfo.xcprivacy in Resources" "ios/$APP.xcodeproj/project.pbxproj" ||
  fail "PrivacyInfo.xcprivacy isn't in the $APP target's resources."
PRIVACY_APIS=$(plutil -convert json -o - "$PRIVACY" | node -e '
  const manifest = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const wanted = require("./app.json").expo.ios?.privacyManifests ?? {};
  const have = manifest.NSPrivacyAccessedAPITypes ?? [];
  const problems = [];
  if (manifest.NSPrivacyTracking !== false) problems.push("NSPrivacyTracking must be false");
  for (const api of wanted.NSPrivacyAccessedAPITypes ?? []) {
    const found = have.find((h) => h.NSPrivacyAccessedAPIType === api.NSPrivacyAccessedAPIType);
    for (const reason of api.NSPrivacyAccessedAPITypeReasons) {
      if (!found?.NSPrivacyAccessedAPITypeReasons?.includes(reason))
        problems.push(`missing ${api.NSPrivacyAccessedAPIType} ${reason}`);
    }
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(have.map((h) => h.NSPrivacyAccessedAPIType.replace("NSPrivacyAccessedAPICategory", "")).join(", "));
') || fail "PrivacyInfo.xcprivacy doesn't match expo.ios.privacyManifests in app.json (see above)."

# ── Summary ──────────────────────────────────────────────────────────────
printf '\n%s✓ %s is ready%s\n' "$GREEN" "$WORKSPACE" "$RESET"
printf '  %-11s %s\n' \
  "App" "$APP ($BUNDLE_ID)" \
  "Version" "$VERSION (build $BUILD)" \
  "Team" "$TEAM, automatic signing" \
  "Encryption" "ITSAppUsesNonExemptEncryption = NO" \
  "Icon" "$ICON_SOURCE" \
  "Privacy" "$PRIVACY_APIS"

if [ "$OPEN_XCODE" = 1 ]; then
  xed "$WORKSPACE"
  printf '\nIn Xcode: Any iOS Device → Product → Archive → Distribute App\n'
fi
