#!/bin/bash
# Renders every concept's .icon bundle with Icon Composer's own renderer
# (ictool, shipped inside Xcode 27's Icon Composer.app), then builds the
# contact sheet. Usage: design/icons/tools/render.sh [concept-folder ...]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ICONS="$(dirname "$HERE")"
REPO="$(cd "$ICONS/../.." && pwd)"
ICTOOL="/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"
TINT_HUE=0.1      # amber, close to iOS's default tint
TINT_STRENGTH=0.75
WORK="${TMPDIR:-/tmp}/mini-cities-icons"
mkdir -p "$WORK"

render() { # bundle rendition out [size]
  local size="${4:-1024}"
  "$ICTOOL" "$1" --export-image --output-file "$3" --platform iOS --rendition "$2" \
    --width "$size" --height "$size" --scale 1 --tint-color "$TINT_HUE" --tint-strength "$TINT_STRENGTH" >/dev/null
}

folders=("$@")
if [ ${#folders[@]} -eq 0 ]; then
  folders=()
  for d in "$ICONS"/[0-9][0-9]-*/; do folders+=("$(basename "$d")"); done
fi

for name in "${folders[@]}"; do
  dir="$ICONS/$name"
  bundle="$(ls -d "$dir"/*.icon | head -1)"
  render "$bundle" Default "$dir/light.png"
  render "$bundle" Dark "$dir/dark.png"
  render "$bundle" TintedDark "$dir/tinted.png"
  # extra looks, only for the contact sheet
  mkdir -p "$WORK/$name"
  render "$bundle" TintedLight "$WORK/$name/tinted-light.png"
  render "$bundle" ClearLight "$WORK/$name/clear-light.png"
  render "$bundle" ClearDark "$WORK/$name/clear-dark.png"
  xcrun swift "$HERE/png8.swift" "$dir/light.png" "$dir/dark.png" "$dir/tinted.png"
  echo "rendered $name"
done

# the app's current icon, for comparison
mkdir -p "$WORK/current"
for r in Default Dark TintedDark TintedLight ClearLight ClearDark; do
  render "$REPO/assets/expo.icon" "$r" "$WORK/current/$r.png"
done

xcrun swift "$HERE/contact_sheet.swift" "$ICONS" "$WORK" "$ICONS/contact-sheet.png"
echo "wrote contact-sheet.png"
