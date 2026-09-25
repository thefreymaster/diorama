# App Store listing: privacy

The App Privacy answers for App Store Connect, why each one holds, and a privacy policy to host. Open questions (where to host it, the contact address) are at the top of [metadata.md](metadata.md).

## App Privacy answers

App Store Connect → the app → App Privacy → Get Started.

**"Do you or your third-party partners collect data from this app?" → No, we do not collect data from this app.**

The label then reads **Data Not Collected**. Nothing else to fill in.

Apple's definitions ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)):

- "Collect" means sending data off the device where you or your partners can read it for longer than it takes to answer the request in real time.
- "Data that is processed only on device is not 'collected' and does not need to be disclosed."
- "You are not responsible for disclosing data collected by Apple." MapKit is named as an example: you disclose only data *you* take from it.

How that applies to each thing Diorama touches:

| Data | What Diorama does with it | Collected? |
|---|---|---|
| Place searches | Typed into the search field and sent to Apple Maps (MapKit's `MKLocalSearchCompleter` and `MKLocalSearch`) to find places. Diorama has no server of its own. | No: only Apple receives them. |
| Location (precise) | Only after you tap "Current location" and allow "While Using the App". Used on the iPhone to center the map and, while that diorama is open, to follow you. Apple turns it into a place name (Core Location's reverse geocoding) and MapKit shows the blue dot. Never in the background. | No: stays on the iPhone, or goes only to Apple. |
| Recent places, settings | Saved on the iPhone (app storage), never sent anywhere. Deleting the app deletes them. | No: on device only. |
| Camera | Only with "Lean to move closer" on and camera access allowed. ARKit uses the rear camera on the iPhone to follow how your head moves. Frames are never stored, shown or sent. | No: on device only. |
| Motion | The gyroscope and accelerometer turn the view as you move the phone or your head. On the iPhone only. | No: on device only. |
| Maps imagery | Downloaded from Apple by MapKit to draw the city. | No: Apple's service. |
| Crash reports, analytics | None in the app. Apple's own opt-in crash reports and App Analytics are Apple's. | No. |
| Identifiers, advertising | None. No ads, no advertising identifier, no App Tracking Transparency prompt. | No. |
| Account, contacts, photos, health, purchases | Not used. No sign-in. | No. |

**Tracking: No.** Diorama doesn't link data with other companies' data or share it with data brokers. The privacy manifest (`ios.privacyManifests` in `app.json`) matches: `NSPrivacyTracking` false, no tracking domains, no collected data types.

If Diorama ever adds analytics, crash reporting, an account or its own server, these answers change before that version ships.

## Privacy policy (to host)

Paste this onto the privacy page (see open question 3 in [metadata.md](metadata.md)). Replace the placeholders.

```
Diorama privacy policy

Effective September 25, 2026

Diorama shows real places as tiny 3D models. It doesn't collect your personal information. There is no account, no advertising, no analytics and no tracking, and Diorama has no server of its own.

Maps and search
Maps, 3D imagery and place search come from Apple Maps. When you search, or when Diorama shows a map, your iPhone sends the request to Apple. Apple's handling of it is described in the Apple Maps privacy notice (Settings > Privacy & Security > Location Services > About Location Services & Privacy, or apple.com/legal/privacy).

Location
Diorama uses your location only when you choose Current location, and only while the app is open. It centers the map on you and follows you as you move. Your location is used on your iPhone; to show the name of the place, your iPhone asks Apple Maps. Diorama never uses your location in the background, never stores it off your iPhone and never shares it. You can turn location access off at any time in Settings > Privacy & Security > Location Services > Diorama.

Camera
If you turn on Lean to move closer, Diorama uses the rear camera to follow how your head moves, so you can lean in toward the city. This happens on your iPhone. Camera images are never recorded, stored or sent. You can turn camera access off at any time in Settings > Privacy & Security > Camera, or turn off Lean to move closer in Diorama's settings.

Motion
Diorama uses your iPhone's motion sensors to turn the view as you move. This data stays on your iPhone.

Data on your iPhone
Your recent places and settings are saved on your iPhone only. Deleting Diorama deletes them.

Children
Diorama is suitable for all ages and doesn't knowingly collect information from anyone, including children.

Changes
If this policy changes, the new version will be posted here with a new effective date.

Contact
Questions: support@YOUR-SITE
```
