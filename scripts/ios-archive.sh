#!/usr/bin/env bash
# npm run ios:archive
#   A signed App Store build from the command line:
#   1. ios:prepare (regenerate ios/ and check it).
#   2. xcodebuild archive: Release, any iOS device, automatic signing
#      → ios/build/<App>.xcarchive
#   3. xcodebuild -exportArchive with ios-export/ExportOptions.plist
#      → ios/build/export/<App>.ipa, signed for the App Store.
#   4. Checks the result: version, build, export compliance, icon, privacy
#      manifest, no dev client, and (for the .ipa) the distribution
#      signature and App Store profile.
#
#   Uploading: set ASC_KEY_ID and ASC_ISSUER_ID and put the key at
#   ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8. Step 3 then
#   uploads to App Store Connect instead of writing the .ipa.
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
  printf '\n%sios:archive failed:%s %s\n' "$RED" "$RESET" "$1" >&2
  shift
  for line in "$@"; do printf '  %s\n' "$line" >&2; done
  exit 1
}

[ "$#" -eq 0 ] || fail "ios:archive takes no options." "Upload settings come from ASC_KEY_ID and ASC_ISSUER_ID."

app_json() { node -p "const e = require('./app.json').expo; String(($1) ?? '')"; }
TEAM=$(app_json 'e.ios?.appleTeamId')
BUNDLE_ID=$(app_json 'e.ios?.bundleIdentifier')
VERSION=$(app_json 'e.version')
BUILD=$(app_json 'e.ios?.buildNumber')

# ── Upload or export only? Decide before the long build. ────────────────
KEY_DIR="$HOME/.appstoreconnect/private_keys"
AUTH=()
UPLOAD=0
if [ -n "${ASC_KEY_ID:-}" ] || [ -n "${ASC_ISSUER_ID:-}" ]; then
  [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] ||
    fail "set both ASC_KEY_ID and ASC_ISSUER_ID to upload, or neither to only export."
  KEY_FILE="$KEY_DIR/AuthKey_${ASC_KEY_ID}.p8"
  [ -f "$KEY_FILE" ] ||
    fail "ASC_KEY_ID is set, but there's no key file at $KEY_FILE." \
      "Download the .p8 from App Store Connect → Users and Access → Integrations (docs/app-store.md)," \
      "or unset ASC_KEY_ID and ASC_ISSUER_ID to build the .ipa without uploading."
  AUTH=(-authenticationKeyPath "$KEY_FILE" -authenticationKeyID "$ASC_KEY_ID"
    -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  UPLOAD=1
fi

# The committed export options must match app.json.
OPTIONS=ios-export/ExportOptions.plist
[ -f "$OPTIONS" ] || fail "$OPTIONS is missing."
plutil -lint -s "$OPTIONS" || fail "$OPTIONS isn't a valid plist."
option() { /usr/libexec/PlistBuddy -c "Print :$1" "$OPTIONS" 2>/dev/null || true; }
[ "$(option method)" = app-store-connect ] || fail "$OPTIONS must use method app-store-connect."
[ "$(option teamID)" = "$TEAM" ] ||
  fail "$OPTIONS has teamID '$(option teamID)', but app.json has appleTeamId '$TEAM'."

# ── 1. Prepare ──────────────────────────────────────────────────────────
bash scripts/ios-prepare.sh

APP=$(basename ios/*.xcworkspace .xcworkspace)
BUILD_DIR=ios/build
ARCHIVE="$BUILD_DIR/$APP.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
LOG_DIR="$BUILD_DIR/logs"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
mkdir -p "$LOG_DIR"

# Runs xcodebuild with its long output in a log file. On failure, shows
# the errors (or the end of the log) and returns 1.
xcode() {
  local log=$1
  shift
  if xcodebuild "$@" >"$log" 2>&1; then return 0; fi
  printf '\n%sxcodebuild failed.%s From %s:\n' "$RED" "$RESET" "$log" >&2
  if grep -qE 'error:|Error Domain|\*\* [A-Z ]+ FAILED' "$log"; then
    grep -E 'error:|Error Domain|\*\* [A-Z ]+ FAILED' "$log" | awk '!seen[$0]++' | head -n 25 >&2
  else
    tail -n 25 "$log" >&2
  fi
  return 1
}

# Checks one built .app: what App Store Connect reads, and that it's a
# release build (JS bundle inside, no dev launcher or dev menu).
check_app() {
  local app=$1
  [ -d "$app" ] || fail "no app at $app."
  info() { /usr/libexec/PlistBuddy -c "Print :$1" "$app/Info.plist" 2>/dev/null || true; }
  local exe icon assets
  exe=$(info CFBundleExecutable)
  [ "$(info CFBundleIdentifier)" = "$BUNDLE_ID" ] || fail "$app has bundle id '$(info CFBundleIdentifier)'."
  [ "$(info CFBundleShortVersionString)" = "$VERSION" ] || fail "$app has version '$(info CFBundleShortVersionString)'."
  [ "$(info CFBundleVersion)" = "$BUILD" ] || fail "$app has build '$(info CFBundleVersion)'."
  [ "$(info ITSAppUsesNonExemptEncryption)" = false ] || fail "$app doesn't set ITSAppUsesNonExemptEncryption to NO."
  icon=$(info CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconName)
  [ -n "$icon" ] && [ -f "$app/Assets.car" ] || fail "$app has no compiled app icon (CFBundleIcons, Assets.car)."
  assets=$(xcrun --sdk iphoneos assetutil --info "$app/Assets.car" 2>/dev/null) || assets=''
  grep -q "\"Name\" : \"$icon\"" <<<"$assets" || fail "Assets.car in $app has no '$icon' icon."
  [ -f "$app/PrivacyInfo.xcprivacy" ] || fail "$app has no PrivacyInfo.xcprivacy."
  [ -f "$app/main.jsbundle" ] || fail "$app has no main.jsbundle (a Release build embeds the JavaScript)."
  [ ! -e "$app/EXDevLauncher.bundle" ] && [ ! -e "$app/EXDevMenu.bundle" ] &&
    ! grep -q EXDevLauncherController "$app/$exe" ||
    fail "$app still contains the Expo dev launcher or dev menu."
  ! grep -q _expo._tcp <<<"$(info NSBonjourServices)" ||
    fail "$app still lists the dev launcher's local-network service (_expo._tcp)."
}

SIGNING_HELP=(
  "If it's about signing: in Xcode → Settings → Accounts, sign in to team $TEAM,"
  "then see Troubleshooting in docs/app-store.md."
)

# ── 2. Archive ──────────────────────────────────────────────────────────
step "Archiving $APP (Release, any iOS device). This takes a few minutes."
printf '  Full log: %s\n' "$LOG_DIR/archive.log"
xcode "$LOG_DIR/archive.log" \
  -workspace "ios/$APP.xcworkspace" -scheme "$APP" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} archive ||
  fail "the archive didn't build." "${SIGNING_HELP[@]}"

# Check the archive before anything is signed for the store or uploaded.
step "Checking the archive"
check_app "$ARCHIVE/Products/Applications/$APP.app"

# ── 3. Export (or upload) ───────────────────────────────────────────────
RUN_OPTIONS="$BUILD_DIR/ExportOptions.plist"
cp "$OPTIONS" "$RUN_OPTIONS"
if [ "$UPLOAD" = 1 ]; then
  /usr/libexec/PlistBuddy -c "Set :destination upload" "$RUN_OPTIONS"
  step "Signing for the App Store and uploading to App Store Connect"
else
  step "Signing for the App Store"
fi
printf '  Full log: %s\n' "$LOG_DIR/export.log"
xcode "$LOG_DIR/export.log" \
  -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$RUN_OPTIONS" \
  -exportPath "$EXPORT_DIR" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} ||
  fail "the export didn't finish." "${SIGNING_HELP[@]}"

if [ "$UPLOAD" = 1 ]; then
  printf '\n%s✓ Uploaded %s %s (build %s) to App Store Connect%s\n' "$GREEN" "$APP" "$VERSION" "$BUILD" "$RESET"
  printf '  Archive  %s\n' "$ARCHIVE"
  printf '\nApple emails you when processing finishes (usually 5–30 minutes).\n'
  printf 'Then it shows up in App Store Connect → TestFlight.\n'
  exit 0
fi

# ── 4. Check the .ipa ───────────────────────────────────────────────────
step "Checking the .ipa"
IPA="$EXPORT_DIR/$APP.ipa"
[ -f "$IPA" ] || fail "the export finished, but there's no $IPA."
CONTENTS="$BUILD_DIR/ipa-contents"
rm -rf "$CONTENTS"
unzip -q "$IPA" -d "$CONTENTS"
IPA_APP="$CONTENTS/Payload/$APP.app"
check_app "$IPA_APP"

# Signed with an Apple Distribution certificate from the team.
codesign --verify --deep --strict "$IPA_APP" 2>/dev/null || fail "the app's signature doesn't verify."
SIGNATURE=$(codesign -dv --verbose=2 "$IPA_APP" 2>&1)
SIGNER=$(awk -F= '/^Authority=/ { print $2; exit }' <<<"$SIGNATURE")
SIGN_TEAM=$(awk -F= '/^TeamIdentifier=/ { print $2; exit }' <<<"$SIGNATURE")
[[ "$SIGNER" == "Apple Distribution:"* ]] || fail "the app is signed by '$SIGNER', not an Apple Distribution certificate."
[ "$SIGN_TEAM" = "$TEAM" ] || fail "the app is signed for team '$SIGN_TEAM', not $TEAM."

# An App Store profile: this app id, no device list, not debuggable.
PROFILE="$BUILD_DIR/embedded-profile.plist"
security cms -D -i "$IPA_APP/embedded.mobileprovision" >"$PROFILE" 2>/dev/null ||
  fail "couldn't read the app's embedded.mobileprovision."
profile() { /usr/libexec/PlistBuddy -c "Print :$1" "$PROFILE" 2>/dev/null || true; }
[ "$(profile Entitlements:application-identifier)" = "$TEAM.$BUNDLE_ID" ] ||
  fail "the profile is for '$(profile Entitlements:application-identifier)', not $TEAM.$BUNDLE_ID."
[ -z "$(profile ProvisionedDevices)" ] && [ -z "$(profile ProvisionsAllDevices)" ] ||
  fail "the profile lists devices, so it isn't an App Store profile."
[ "$(profile Entitlements:get-task-allow)" = false ] ||
  fail "the profile allows debugging, so it isn't an App Store profile."
PROFILE_NAME=$(profile Name)
rm -rf "$CONTENTS" "$PROFILE"

printf '\n%s✓ %s%s\n' "$GREEN" "$IPA" "$RESET"
printf '  %-10s %s\n' \
  "Version" "$VERSION (build $BUILD)" \
  "Signed by" "$SIGNER" \
  "Profile" "$PROFILE_NAME" \
  "Archive" "$ARCHIVE"
printf '\nNot uploaded. Uploading from here needs an App Store Connect app record and API key\n'
printf '(T17; docs/app-store.md → One-time setup). Or upload this .ipa with Apple'"'"'s Transporter app,\n'
printf 'or the archive from Xcode → Window → Organizer → Distribute App.\n'
