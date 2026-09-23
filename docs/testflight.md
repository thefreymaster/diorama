# TestFlight

Diorama goes to TestFlight as a local Xcode archive, without EAS. `app.json` already sets what the upload needs: team `3U62R986E5` with automatic signing, `ios.buildNumber`, export compliance (`ITSAppUsesNonExemptEncryption` = NO, so App Store Connect won't ask about encryption), the Liquid Glass icon (`assets/expo.icon`), and the motion permission string. The app doesn't request location, so it has no location string.

## One-time setup

1. **App record.** In App Store Connect, go to Apps → **+** → New App. Choose platform iOS, name "Diorama", bundle ID `com.ejf.diorama`, SKU `diorama`. App Store names must be unique. If "Diorama" is taken, pick another store name; the home-screen name stays "Diorama".
   - If the bundle ID isn't in the list, register it at developer.apple.com → Certificates, IDs & Profiles → Identifiers → **+** → App IDs. It needs no capabilities.
   - If you use a different ID, change `ios.bundleIdentifier` in `app.json` to match.
2. **API key (only for CLI uploads).** In App Store Connect, go to Users and Access → Integrations → App Store Connect API → Team Keys → **+**, with **Admin** access. xcodebuild uses the key to create the distribution certificate and profile.
   - Download `AuthKey_<KEY_ID>.p8` into `~/.appstoreconnect/private_keys/`. Apple lets you download it only once.
   - Keep it out of the repo. `*.p8` is git-ignored.
   - Write down the Key ID and the Issuer ID.

## Every upload

1. Bump `ios.buildNumber` in `app.json` ("1" → "2" → …). App Store Connect rejects a build number it has already seen. Change `version` only for a new release.
2. Regenerate the native project:
   ```sh
   CI=1 EXPO_NO_GIT_STATUS=1 npx expo prebuild -p ios --clean
   ```
3. Archive and upload. Use either option below.

**Xcode.** Run `xed ios`. Set the destination to **Any iOS Device (arm64)** and choose Product → Archive. When the Organizer opens, choose Distribute App → **TestFlight & App Store** (some Xcode versions call it **App Store Connect**) → Distribute. If Xcode reports no account, add your Apple ID under Xcode → Settings → Accounts.

**CLI.** Run this from the repo root. `destination: upload` makes `-exportArchive` send the build straight to App Store Connect.

```sh
KEY_ID=XXXXXXXXXX
ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AUTH=(-allowProvisioningUpdates
      -authenticationKeyPath "$HOME/.appstoreconnect/private_keys/AuthKey_$KEY_ID.p8"
      -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER_ID")

mkdir -p ios/build
cat > ios/build/ExportOptions.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>3U62R986E5</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
EOF

xcodebuild -workspace ios/Diorama.xcworkspace -scheme Diorama -configuration Release \
  -destination 'generic/platform=iOS' -archivePath ios/build/Diorama.xcarchive \
  "${AUTH[@]}" archive
xcodebuild -exportArchive -archivePath ios/build/Diorama.xcarchive \
  -exportOptionsPlist ios/build/ExportOptions.plist -exportPath ios/build/export \
  "${AUTH[@]}"
```

4. Wait for processing, which usually takes 5–30 minutes. Apple emails you when the build shows up under TestFlight.

## Testers

- **Internal.** Up to 100 people who have a role in your App Store Connect team. Add them to an internal group, and each build becomes available as soon as processing finishes. There is no review.
- **External.** Up to 10,000 people, invited by email or a public link. Before inviting anyone, fill in TestFlight → Test Information (beta description, feedback email, contact details, privacy policy URL). The first build of each version goes through Beta App Review, which usually takes about a day. Later builds of the same version usually skip it.
- Testers install the TestFlight app. Each build expires after 90 days.

## If an upload fails

- **"Bundle version must be higher…"**: bump `ios.buildNumber` and upload again.
- **No accounts or provisioning profiles**: for the CLI, check that the key has Admin access. For Xcode, sign in under Settings → Accounts.
- **An "ITMS-91053: Missing API declaration" email**: add the API it names, with a reason, under `ios.privacyManifests` in `app.json`. Then prebuild and upload a new build.
