# App Store listing: metadata

Everything the App Store Connect version page and App Information page ask for, ready to paste. Privacy answers are in [privacy.md](privacy.md); review notes, age rating and export compliance in [review-notes.md](review-notes.md); screenshots in [screenshots/](screenshots/) (regenerate with `scripts/screenshots.sh`).

## Open questions for the owner

Decide these before submitting. Each has a suggestion.

1. **Store name.** Is "Diorama" free? App Store names are unique across the store, and App Store Connect tells you when you create the app record. If it's taken, use the first fallback below that's free. The home-screen name stays "Diorama" either way.
2. **Seller and copyright name.** The distribution certificate is in your own name (individual account), so the copyright line below says "Evan Freymiller". If you publish as Canvas23 Studios (a company account, or later), change it to "2026 Canvas23 Studios".
3. **Where to host three pages.** App Store Connect requires a support URL and a privacy policy URL; the marketing URL is optional. Suggestion: one small site (GitHub Pages is free) with `/diorama/`, `/diorama/support/` and `/diorama/privacy/` (the policy text is in [privacy.md](privacy.md)). Then replace the `https://YOUR-SITE` placeholders below and in privacy.md.
4. **Support email.** The support page and the privacy policy need a contact address. The placeholder is `support@YOUR-SITE`.
5. **Price and countries.** Suggestion: free, all countries. For the EU, App Store Connect asks for your Digital Services Act trader status: a trader must show an address, phone and email on the App Store; a non-trader can't sell in the EU. Answer it under Business in App Store Connect.
6. **Mac and Apple Vision Pro.** App Store Connect offers iPhone apps on Apple silicon Macs and Apple Vision Pro by default. Diorama is built around a phone you hold or wear (motion, a sideways headset), so suggestion: turn both off under Pricing and Availability → "iPhone and iPad Apps on Apple Silicon Macs" and "Apple Vision Pro".
7. **Map attribution under the miniature blur (T21, blocked on you).** At the default miniature strength the bottom blur band can soften Apple's Maps logo and "Legal" link. MapKit's terms require them to stay visible, so a reviewer could object. Decide T21 before submitting (a sharp strip for the attribution, or moving it above the band). See the risks in [review-notes.md](review-notes.md).
8. **App Review contact.** App Store Connect needs a first name, last name, phone and email for the reviewer to reach you. They aren't shown on the store.

## App Information page

| Field | Value |
|---|---|
| Name (≤30) | Diorama |
| Fallback names, in order | Diorama: Tiny 3D Cities · Diorama – Model Cities · Diorama 3D |
| Subtitle (≤30) | Real cities as tiny 3D models |
| Primary category | Travel |
| Secondary category | Entertainment |
| Content rights | Yes, it contains third-party content (Apple Maps imagery through MapKit), and you have the rights to use it (MapKit's terms in the Apple Developer Program License Agreement). |
| Age rating | 4+ (answers in [review-notes.md](review-notes.md)) |
| Bundle ID | `canvas23studios.diorama` |
| SKU | `diorama` |
| Primary language | English (U.S.) |

Why Travel: people use it to look at real cities, landmarks and national parks. Navigation would suggest directions, which Diorama doesn't give.

## Version page (1.0)

### Promotional text (≤170, can change without review)

```
See any city as a tabletop model. Hold your iPhone like a window and look around, or slip it into a phone VR viewer to see the city in true 3D.
```

### Description (≤4000)

```
Diorama shows real places as tiny tabletop models. Pick a city, a landmark or a national park, and look down on it in 3D, as if it sat on the table in front of you.

Hold it like a window
Hold your iPhone upright and it becomes a window into the city. Move the phone to look around, drag with one finger, and pinch to get closer. No headset needed.

See it in stereo 3D
Turn your iPhone sideways and slide it into a phone VR viewer with two lenses. Diorama shows a picture for each eye, spaced far apart, so the city reads as a miniature model. Turn your head to look around, and lean in to get closer. Double-tap to recenter; touch and hold to leave.

Go anywhere
• Search for any city, address or landmark.
• Start with featured cities that have 3D buildings, like New York, Paris, Tokyo and San Francisco.
• Visit national parks: the Grand Canyon, Yellowstone, Yosemite and more.
• Open the place where you're standing. While Diorama is open, the model follows you as you walk.
• Or choose any spot by moving a map under a pin.

Make it yours
Set the model size, the camera height, how far the view turns with your head, and how strong the miniature blur is. Match the two pictures to your viewer's lenses, or turn off the two-eye view to keep one full-screen picture sideways too.

Private by design
No account, no ads, no tracking. Maps and search come from Apple Maps. Your recent places and settings stay on your iPhone. Lean to move closer uses the camera on your iPhone to follow your head; nothing is recorded or sent.

3D buildings are available in select cities. Elsewhere, Diorama shows satellite imagery on terrain.
```

### Keywords (≤100, commas, no spaces after commas)

```
miniature,tilt shift,map,stereo,VR,viewer,skyline,travel,landmarks,national parks,satellite,aerial
```

Words already in the name and subtitle (diorama, real, cities, tiny, 3D, models) are indexed on their own, so they aren't repeated. No other companies' trademarks (for example "Cardboard", which is Google's).

### URLs

| Field | Value |
|---|---|
| Support URL (required) | `https://YOUR-SITE/diorama/support/` |
| Marketing URL (optional) | `https://YOUR-SITE/diorama/` |
| Privacy policy URL (required, on App Information) | `https://YOUR-SITE/diorama/privacy/` |

### Copyright

```
2026 Evan Freymiller
```

App Store Connect adds the © itself.

### Screenshots

iPhone 6.9-inch display only: App Store Connect scales these down for every smaller iPhone, and asks for 6.5-inch only when there are no 6.9-inch ones. Taken on the iPhone 18 Pro Max Simulator (iOS 27), light mode, 9:41 status bar, PNG without alpha. Upload them in this order:

| File | Size | Shows |
|---|---|---|
| `screenshots/iphone-6.9/01-picker.png` | 1320 × 2868 | The picker: Current location, Choose on map, featured cities, search |
| `screenshots/iphone-6.9/02-preview.png` | 1320 × 2868 | New York preview, orbiting, with Enter Diorama |
| `screenshots/iphone-6.9/03-viewer-upright.png` | 1320 × 2868 | The upright full-screen view, no headset |
| `screenshots/iphone-6.9/04-viewer-stereo.png` | 2868 × 1320 | Sideways: one picture per eye for a phone VR viewer |
| `screenshots/iphone-6.9/05-search.png` | 1320 × 2868 | Searching "grand canyon" |
| `screenshots/iphone-6.9/06-choose-on-map.png` | 1320 × 2868 | Choose on map, at the Eiffel Tower |
| `screenshots/iphone-6.9/07-settings.png` | 1320 × 2868 | Settings, with the live Boston preview |

One set can mix portrait and landscape. The upright view comes before the stereo one on purpose: the first screenshots show that Diorama works without a headset. Regenerate them with `bash scripts/screenshots.sh` (about 5 minutes; `--skip-build` reuses the last build).

### Also on the version page

| Field | Value |
|---|---|
| Sign-in required | No |
| Version | 1.0.0 (build from `app.json`) |
| Release | Manually release this version (so you can check the store page first) |
