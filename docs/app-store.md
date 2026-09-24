# App Store

Diorama ships as a local Xcode archive, without EAS. `ios/` is generated from `app.json` (Continuous Native Generation) and git-ignored, so every build starts by regenerating it. Change `app.json`, never `ios/`.

`app.json` holds everything the store reads: team `3U62R986E5` with automatic signing, bundle ID `canvas23studios.diorama`, `version` and `ios.buildNumber`, export compliance (`usesNonExemptEncryption: false`, so App Store Connect asks no encryption questions), the Liquid Glass icon (`assets/expo.icon`), the motion permission string, and the privacy manifest (`ios.privacyManifests`). The app never asks for location, so it has no location string.

## Commands

Run them from the repo root. None of them asks questions.

| Command | What it does |
|---|---|
| `npm run bump` | Next build number (`ios.buildNumber` + 1). |
| `npm run bump -- --version 1.1.0` | New version; the build number goes back to 1. |
| `npm run ios:prepare` | Regenerates `ios/` (`expo prebuild -p ios --clean`, CocoaPods included), then checks the team, bundle ID, version, build number, export compliance, icon and privacy manifest against `app.json`. |
| `npm run ios:xcode` | `ios:prepare`, then opens the workspace in Xcode. |
| `npm run ios:archive` | `ios:prepare`, a Release archive for any iOS device, then a signed App Store `.ipa`, then checks the result. With an API key set up, it uploads instead. |

`ios:archive` writes:

- `ios/build/Diorama.xcarchive`: the archive.
- `ios/build/export/Diorama.ipa`: the App Store build, signed with the team's Apple Distribution certificate and an App Store profile.
- `ios/build/logs/archive.log` and `export.log`: the full xcodebuild output. The terminal shows only the steps, and the errors when something fails.

It checks, before anything leaves the Mac: the version and build number, `ITSAppUsesNonExemptEncryption` = NO, a compiled icon in `Assets.car`, `PrivacyInfo.xcprivacy` in the app, the JavaScript bundle inside, and no Expo dev launcher or dev menu. On the `.ipa` it also checks the Apple Distribution signature and that the profile is an App Store profile for the bundle ID (no device list, no debugging).

`ios:prepare` deletes `ios/`, including `ios/build/`. Copy an `.ipa` somewhere else if you want to keep it.

## One-time setup

1. **App record.** In [App Store Connect](https://appstoreconnect.apple.com), go to Apps → **+** → New App. Choose platform iOS, name "Diorama", bundle ID `canvas23studios.diorama`, SKU `diorama`. App Store names must be unique. If "Diorama" is taken, pick another store name; the home-screen name stays "Diorama".
   - The bundle ID is already registered: the first `npm run ios:archive` let Xcode register it, so it's listed as "XC canvas23studios diorama". If it's ever missing, register it at developer.apple.com → Certificates, IDs & Profiles → Identifiers → **+** → App IDs → App, with Explicit bundle ID `canvas23studios.diorama`. It needs no capabilities.
   - If you use a different ID, change `ios.bundleIdentifier` in `app.json` to match.
2. **App privacy.** In the app record, App Privacy → Get Started: choose **Data Not Collected**. Diorama keeps settings and recent places on the phone. City searches go to Apple Maps through MapKit, and Apple says developers aren't responsible for disclosing data Apple collects. The app has no accounts, no analytics and no tracking. The App Store also needs a privacy policy URL.
3. **API key (optional, only for uploading from the terminal).** In App Store Connect, go to Users and Access → Integrations → App Store Connect API → Team Keys → **+**, with **Admin** access. xcodebuild uses the key to sign for the App Store and to upload.
   - Download `AuthKey_<KEY_ID>.p8` into `~/.appstoreconnect/private_keys/`. Apple lets you download it only once.
   - Keep it out of the repo. `*.p8` is git-ignored.
   - Note the Key ID and the Issuer ID (at the top of the keys page).

Without a key, `ios:archive` still builds and signs the `.ipa` with the Apple ID signed in to Xcode (Xcode → Settings → Accounts). You then upload it with Xcode or Transporter (see Uploading).

Signing needs nothing on the Mac's keychain. Xcode uses the team's cloud-managed Apple Distribution certificate and keeps an App Store profile for the bundle ID ("iOS Team Store Provisioning Profile: canvas23studios.diorama"), creating it when it's missing.

## Each release

1. **Bump.** App Store Connect rejects a build number it has already seen for a version.
   ```sh
   npm run bump                      # same version, next build
   npm run bump -- --version 1.1.0   # new version, build 1
   ```
2. **Build.** Choose one:
   - **Terminal:** `npm run ios:archive`. It ends with a summary: the `.ipa` path, the version, and who signed it.
   - **Xcode:** `npm run ios:xcode`. In Xcode, set the destination to **Any iOS Device (arm64)**, choose Product → Archive, and in the Organizer that opens choose **Distribute App**.
3. **Upload** (next section).
4. **Commit** the bumped `app.json`, so the next build doesn't reuse the number.

## Uploading

Any one of these:

- **Terminal, with the API key.** Set the two IDs and run the archive. It uploads instead of writing the `.ipa`:
  ```sh
  ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx npm run ios:archive
  ```
  If either ID is set but the key file isn't in `~/.appstoreconnect/private_keys/`, it stops before building.
- **Xcode Organizer.** After `npm run ios:archive`, run `open ios/build/Diorama.xcarchive` to show it in the Organizer. Or archive in Xcode (`npm run ios:xcode`). Then choose Distribute App → **App Store Connect** (some Xcode versions call it **TestFlight & App Store**) → Distribute.
- **Transporter.** Drag `ios/build/export/Diorama.ipa` into Apple's Transporter app (free on the Mac App Store), then choose Deliver.

Processing usually takes 5–30 minutes. Apple emails you when the build shows up under TestFlight.

## TestFlight

- **Internal testers.** Up to 100 people who have a role in your App Store Connect team. Add them to an internal group, and each build becomes available as soon as processing finishes. There is no review.
- **External testers.** Up to 10,000 people, invited by email or a public link. Before inviting anyone, fill in TestFlight → Test Information (beta description, feedback email, contact details, privacy policy URL). The first build of each version goes through Beta App Review, which usually takes about a day. Later builds of the same version usually skip it.
- Testers install the TestFlight app. Each build expires after 90 days.

## App Store review

1. In the app record, fill in the version page: screenshots, description, keywords, support URL, and the privacy policy URL. Also set the age rating and the category.
2. Under Build, choose the uploaded build. Export compliance is already answered by `ITSAppUsesNonExemptEncryption` = NO.
3. Write review notes. The reviewer has no headset: tell them to hold the phone upright for the full-screen view, drag to look around, and turn the phone sideways for the two-eye view.
4. Choose **Add for Review**, then **Submit**. Review usually takes a day or two. You get an email when the status changes.

## Privacy manifest

Apple rejects uploads whose code calls "required reason" APIs without declaring them (ITMS-91053). The declarations live in `ios.privacyManifests` in `app.json`. Prebuild writes them to `ios/Diorama/PrivacyInfo.xcprivacy`, CocoaPods adds what the pods declare, and the file ships inside the app.

What Diorama declares. The list comes from the pods' own `PrivacyInfo.xcprivacy` files, and a scan of the built app's binaries for the APIs Apple lists found nothing else:

| API category | Reasons | Used by |
|---|---|---|
| User defaults | CA92.1 | React Native, expo-constants, expo-system-ui |
| File timestamps | C617.1, 0A2A.1, 3B52.1 | React Native, its folly, glog and boost, expo-file-system |
| System boot time | 35F9.1 | React Native, boost |
| Disk space | E174.1, 85F4.1 | expo-file-system |

It also declares no tracking, no tracking domains and no collected data.

When you add a native dependency, look for its `PrivacyInfo.xcprivacy` (in `node_modules/<package>/ios/` or `ios/Pods/<Pod>/`). Add any category or reason it declares that isn't in `app.json` yet. `ios:prepare` fails if the generated manifest is missing anything `app.json` declares.

## Troubleshooting

- **`ios:prepare` stops at a check** ("CFBundleVersion is …, but app.json says …"): fix `app.json` and run it again. Don't edit `ios/`; the next prepare deletes it.
- **CocoaPods didn't install:** read the `pod install` error above the check. Then try `(cd ios && pod install --repo-update)`.
- **The archive or export fails:** the terminal shows the errors, and the full log is in `ios/build/logs/`. Signing errors:
  - "No Accounts" or "No signing certificate": sign in to Xcode → Settings → Accounts with an Apple ID on team `3U62R986E5`. Creating a distribution certificate takes the Account Holder or Admin role (or an Admin API key).
  - "No profiles for 'canvas23studios.diorama' were found" or an unknown App ID: register the bundle ID (One-time setup, step 1).
- **"No suitable application records were found"** when uploading: create the App Store Connect record (One-time setup, step 1), and check that its bundle ID matches `app.json`.
- **"The bundle version must be higher than the previously uploaded version"**: run `npm run bump` and build again.
- **An "ITMS-91053: Missing API declaration" email:** add the API it names, with a reason, under `ios.privacyManifests` in `app.json` (see Privacy manifest). Then bump, build and upload again.
- **The dev launcher or dev menu shows up:** that's a Debug build (`npx expo run:ios`). Archives are always Release. `ios:archive` fails if either one ends up inside the app.
