# App Store listing: review notes, age rating, export compliance

What App Review needs besides the metadata ([metadata.md](metadata.md)) and privacy answers ([privacy.md](privacy.md)): the notes for the reviewer, the age rating answers, export compliance, and the risks to check before submitting.

## Notes for App Review

App Store Connect → the version page → App Review Information. Sign-in required: **No** (there are no accounts). Paste this into Notes:

```
Diorama shows real places from Apple Maps as tiny 3D models. No headset or account is needed to use it.

Try it without a headset:
1. On the first screen, tap New York under Featured.
2. The preview shows the city slowly turning. Tap Enter Diorama.
3. Hold the iPhone upright. The city fills the screen like a window: move the phone or drag with one finger to look around, and pinch to move closer. Tap once to show the close button (top left). Double-tap recenters the view. Touch and hold anywhere for a second to leave.
4. Turn the iPhone sideways. After a 3-second "Put on your viewer" countdown, Diorama shows one round picture per eye, side by side. This is for an optional phone VR viewer with two lenses, which the phone slides into. Without one you can still see both pictures and look around by moving the phone. Turn it upright again to return to the full-screen view.
5. Tap the gear on the first screen for Settings: Miniature effect (the map at the top previews it), Model size (for the two-eye view), Camera height, Tracking sensitivity, Lean to move closer, and Viewer fit (to match a viewer's lenses). Turning off "Two-eye view in landscape" keeps one full-screen picture when the phone is sideways too.

Other ways to pick a place: search for any city or address, the National parks section, "Choose on map" (move the map under the pin), and "Current location".

Permissions (each asked only when needed, and the app keeps working if you decline):
- Location, "While Using the App": only when you tap Current location. It centers the model on where you are and follows you while that view is open. Never in the background. If you decline, the row says so and a tap on it opens Settings; everything else works.
- Camera: the first time you tap Enter Diorama with "Lean to move closer" on (it's on by default), iOS asks for the camera as the view opens (upright, before any headset countdown). ARKit uses the rear camera on the iPhone to track leaning in toward the city. Nothing is recorded, stored or sent. Declining turns leaning off; looking around still works, and Settings then shows "Camera access is off".
- Motion: the view turns with the iPhone using the gyroscope and accelerometer, on the iPhone only.

Maps: all map imagery, 3D buildings, search and place names come from Apple Maps through MapKit. The Apple Maps logo and Legal link are shown at the bottom of every map. Diorama has no server of its own and collects no data.
```

Before pasting, check it against the build you submit (T21 may move the attribution; T47's camera prompt timing).

## Age rating

App Store Connect → App Information → Age Rating → Edit. Every answer is the "none" one, so the rating is **4+**.

| Section | Question | Answer |
|---|---|---|
| In-app controls | Parental controls | No |
| | Age assurance | No |
| Capabilities | Unrestricted web access | No (the only link is Apple's own Legal link inside the map) |
| | User-generated content | No |
| | Social media | No |
| | Messaging and chat | No |
| | Advertising | No |
| Mature themes | Profanity or crude humor | None |
| | Horror or fear themes | None |
| | Alcohol, tobacco or drug use or references | None |
| Medical or wellness | Health or wellness topics | No |
| | Medical or treatment information | None |
| Sexuality or nudity | Mature or suggestive themes | None |
| | Sexual content or nudity | None |
| | Graphic sexual content and nudity | None |
| Violence | Cartoon or fantasy violence | None |
| | Realistic violence | None |
| | Prolonged graphic or sadistic realistic violence | None |
| | Guns or other weapons | None |
| Chance-based activities | Gambling | No |
| | Simulated gambling | None |
| | Contests | None |
| | Loot boxes | No |

Map places are Apple Maps' own points of interest, not content from Diorama's users. Source: [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions).

## Export compliance

**None to declare.** `app.json` sets `ios.config.usesNonExemptEncryption: false`, so the build's `Info.plist` has `ITSAppUsesNonExemptEncryption` = NO and App Store Connect asks no encryption questions when you pick the build. Diorama has no encryption of its own: the only encrypted traffic is Apple's HTTPS inside MapKit and Core Location, which is exempt. No export compliance documents are needed, including for France.

If App Store Connect asks anyway: "Does your app use encryption?" → No (or: only exempt encryption, standard HTTPS through Apple's operating system).

## Risks to check before submitting

Not for the reviewer; for you.

1. **Map attribution under the miniature blur (T21, blocked on your decision).** The Apple Maps logo and Legal link sit at the bottom of each map, and the miniature effect's lower blur band covers that edge. At the default strength they're soft: in the upright Viewer screenshot (`screenshots/iphone-6.9/03-viewer-upright.png`, bottom left) the "Maps" logo is blurred to barely readable, and the Settings preview has the same band. MapKit's terms require the attribution to stay visible and unaltered, so this is the most likely objection. Fix T21 first (a sharp strip for the attribution, or moving it above the band). Meanwhile, Miniature effect at 0 in Settings shows it sharp.
2. **"Needs a headset."** Guideline 2.1 (completeness) and 4.2 (minimum functionality): a reviewer without a viewer must be able to use everything. The notes above lead with the upright full-screen view, the description says "No headset needed", and the upright screenshot comes before the stereo one. One line in the app leans the other way: the preview card's hint under Enter Diorama says "Turn your iPhone sideways and place it in your viewer." Consider something like "Hold it up to look around, or turn it sideways for a viewer." (not changed here; it's app code). Keep any new copy from implying a headset is required, and don't name "Google Cardboard" or other companies' viewers (Guideline 2.3.7 on third-party trademarks in metadata).
3. **Purpose strings (Guideline 5.1.1).** Each says what the access is for, in the app's words: camera "Diorama uses the camera to track how you lean, so you can move closer to the city. Nothing is recorded.", location "Diorama uses your location to show the city around you.", motion "Diorama uses motion to turn the city as you turn your head." The camera prompt comes when you enter the diorama, not at launch, and every feature but leaning works without it. Keep it that way.
4. **Camera prompt on first Enter Diorama.** "Lean to move closer" is on by default, so a reviewer sees the camera prompt the first time they open a city. That's asked in context and explained above; if a reviewer questions it, the answer is that the camera is needed to follow the head's position and nothing leaves the phone.
5. **Location "follows you".** Live mode is foreground only and there are no background modes in `app.json`. If background location is ever added, the purpose string, these notes and the privacy answers all change.
6. **Mac and Apple Vision Pro.** If they stay on (open question 6 in [metadata.md](metadata.md)), a reviewer could try it on a Mac, which has no motion sensors or rear camera. Upright mode still works there with drag to look, but turning them off avoids the question.
7. **Screenshots (Guideline 2.3.3).** They're real captures of the Release build on the Simulator, showing the app in use. Regenerate them with `scripts/screenshots.sh` whenever the screens change.
