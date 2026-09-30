# App Store listing: metadata

Everything the App Store Connect version page and App Information page ask for, ready to paste. Privacy answers are in [privacy.md](privacy.md); review notes, age rating and export compliance in [review-notes.md](review-notes.md); screenshots in [screenshots/](screenshots/) (regenerate with `scripts/screenshots.sh`).

## Open questions for the owner

Decide these before submitting. Each has a suggestion.

1. **Store name.** Answered: the App Store Connect record is "Mini Cities" (app ID 6816119568), and the home-screen name is "Mini Cities" too.
2. **Seller and copyright name.** The distribution certificate is in your own name (individual account), so the copyright line below says "Evan Freymiller". If you publish as Canvas23 Studios (a company account, or later), change it to "2026 Canvas23 Studios".
3. **Where to host three pages.** App Store Connect requires a support URL and a privacy policy URL; the marketing URL is optional. Suggestion: one small site (GitHub Pages is free) with `/diorama/`, `/diorama/support/` and `/diorama/privacy/` (the policy text is in [privacy.md](privacy.md)). Then replace the `https://YOUR-SITE` placeholders below and in privacy.md.
4. **Support email.** The support page and the privacy policy need a contact address. The placeholder is `support@YOUR-SITE`.
5. **Price and countries.** Suggestion: free, all countries. For the EU, App Store Connect asks for your Digital Services Act trader status: a trader must show an address, phone and email on the App Store; a non-trader can't sell in the EU. Answer it under Business in App Store Connect.
6. **Mac and Apple Vision Pro.** App Store Connect offers iPhone apps on Apple silicon Macs and Apple Vision Pro by default. Mini Cities is built around a phone you hold or wear (motion, a sideways headset), so suggestion: turn both off under Pricing and Availability → "iPhone and iPad Apps on Apple Silicon Macs" and "Apple Vision Pro".
7. **Map attribution under the miniature blur.** Answered (T21): the Miniature effect is off by default, so a fresh install shows Apple's Maps logo and "Legal" link sharp, as MapKit's terms require; the slider in Settings can still turn the blur up. See risk 1 in [review-notes.md](review-notes.md).
8. **App Review contact.** App Store Connect needs a first name, last name, phone and email for the reviewer to reach you. They aren't shown on the store.

## App Information page

| Field | Value |
|---|---|
| Name (≤30) | Mini Cities |
| Subtitle (≤30) | Real cities as tiny 3D models |
| Primary category | Travel |
| Secondary category | Entertainment |
| Content rights | Yes, it contains third-party content (Apple Maps imagery through MapKit), and you have the rights to use it (MapKit's terms in the Apple Developer Program License Agreement). |
| Age rating | 4+ (answers in [review-notes.md](review-notes.md)) |
| Bundle ID | `canvas23studios.diorama` |
| SKU | `diorama` |
| Primary language | English (U.S.) |

Why Travel: people use it to look at real cities, landmarks and national parks. Navigation would suggest directions, which Mini Cities doesn't give.

## Version page (1.0)

### Promotional text (≤170, can change without review)

```
See any city as a tabletop model. Hold your iPhone like a window and look around, or slip it into a phone VR viewer to see the city in true 3D.
```

### Description (≤4000)

```
Mini Cities shows real places as tiny tabletop models. Pick a city, a landmark or a national park, and look down on it in 3D, as if it sat on the table in front of you.

Hold it like a window
Hold your iPhone upright and it becomes a window into the city. Move the phone to look around, drag with one finger, and pinch to get closer. No headset needed.

See it in stereo 3D
Turn your iPhone sideways and slide it into a phone VR viewer with two lenses. Mini Cities shows a picture for each eye, spaced far apart, so the city reads as a miniature model. Turn your head to look around, and lean in to get closer. Double-tap to recenter; touch and hold to leave.

Go anywhere
• Search for any city, address or landmark.
• Start with featured cities that have 3D buildings, like New York, Paris, Tokyo and San Francisco.
• Visit national parks: the Grand Canyon, Yellowstone, Yosemite, Mount Everest and more, and jump to their scenic viewpoints.
• Open the place where you're standing. While Mini Cities is open, the model follows you as you walk and lines up with the real world.
• Or choose any spot by moving a map under a pin.

Change the map
Switch between Satellite, Satellite with labels and the Standard map, and turn on live traffic to see busy streets.

Make it yours
Set the model size, the camera height, how far the view turns with your head, and whether leaning moves you up and down. Add a tilt-shift blur for an even tinier look. Match the two pictures to your viewer's lenses, or turn off the two-eye view to keep one full-screen picture sideways too.

Private by design
No account, no ads, no tracking. Maps and search come from Apple Maps. Your recent places and settings stay on your iPhone. Lean to move closer uses the camera on your iPhone to follow your head; nothing is recorded or sent.

3D buildings are available in select cities. Elsewhere, Mini Cities shows satellite imagery on terrain.
```

### Keywords (≤100, commas, no spaces after commas)

```
diorama,miniature,tilt shift,map,stereo,VR,viewer,skyline,travel,landmarks,national parks,satellite
```

Words already in the name and subtitle (mini, cities, real, tiny, 3D, models) are indexed on their own, so they aren't repeated; "diorama" moved into the keywords when the name became Mini Cities (it replaced "aerial"). No other companies' trademarks (for example "Cardboard", which is Google's).

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

iPhone 6.9-inch set, plus the same shots at 6.5-inch size (1284 × 2778, in `screenshots/iphone-6.5/`, scaled from the 6.9-inch ones and cropped to the middle) for App Store Connect pages that show the 6.5" slot first. Use one set: App Store Connect scales it for every other iPhone. Taken on the iPhone 18 Pro Max Simulator (iOS 27), dark mode, 9:41 status bar, PNG without alpha. The place shots feature the Magic Kingdom at Walt Disney World (Apple Maps' 3D, named by Apple Maps "Magic Kingdom Park"); see risk 8 in [review-notes.md](review-notes.md) about showing a Disney park. Upload them in this order:

| File | Size (6.9" / 6.5") | Shows |
|---|---|---|
| `01-picker.png` | 1320 × 2868 / 1284 × 2778 | The picker: Current location, Choose on map, featured cities, search |
| `02-preview.png` | 1320 × 2868 / 1284 × 2778 | Magic Kingdom Park preview, orbiting: Cinderella Castle above the hub and Main Street U.S.A., with the map button and Enter Mini City |
| `03-viewer-upright.png` | 1320 × 2868 / 1284 × 2778 | The upright full-screen view, no headset: up Main Street U.S.A. to Cinderella Castle |
| `04-viewer-stereo.png` | 2868 × 1320 / 2778 × 1284 | Sideways: one picture of the Magic Kingdom per eye for a phone VR viewer |
| `05-search.png` | 1320 × 2868 / 1284 × 2778 | Searching "grand canyon" |
| `06-choose-on-map.png` | 1320 × 2868 / 1284 × 2778 | Choose on map, the pin on Cinderella Castle, the card reading Magic Kingdom Park |
| `07-settings.png` | 1320 × 2868 / 1284 × 2778 | Settings, with the live Boston preview |

Each file is in both `screenshots/iphone-6.9/` and `screenshots/iphone-6.5/`. One set can mix portrait and landscape. The upright view comes before the stereo one on purpose: the first screenshots show that Mini Cities works without a headset. Regenerate both sets with `bash scripts/screenshots.sh` (about 5 minutes; `--skip-build` reuses the last build). It opens the Magic Kingdom the way a person would, from Choose on map (`diorama://pick?lat=28.4190&lon=-81.5812&span=1000&open=1`, where `open=1` taps Open Mini City), so it joins Recent under Apple Maps' name, then opens its preview and Viewer by that Recent id. If App Review objects to showing a Disney park, the fallback is a neutral city: point `PLACE_LAT`/`PLACE_LON` at the top of the script at one (or put back the New York links from before T66) and rerun it.

### Also on the version page

| Field | Value |
|---|---|
| Sign-in required | No |
| Version | 1.0.0 (build from `app.json`) |
| Release | Manually release this version (so you can check the store page first) |
