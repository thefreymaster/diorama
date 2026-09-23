# Diorama — Overview

An iOS app that shows a real city as a tiny tabletop model. You pick a city, put the phone in a head-mounted viewer, and see the city from above in stereo 3D. You stand still at one spot above the model; when you turn your head you look around it, and the city stays put.

## Product

- **Pick a city** (portrait, touch). Search box plus a curated list of cities that have Apple 3D coverage, plus recent cities.
- **Preview** (portrait). A single-lens 3D map of the city slowly orbiting, with an **Enter Diorama** button.
- **Viewer** (landscape, head-worn). Side-by-side stereo, one image per eye. Head motion is first person: you look around from a fixed spot (see Motion below). There is no touch UI while it's worn; a double-tap on the headset recenters and a long press exits.
- **Settings**. Eye separation ("model size"), tracking sensitivity, how strong the miniature blur is, and stereo vs mono.

"Worn like Google Glass" means the phone sits in a head mount (Cardboard-style or a clip-on viewer) in landscape. The app must work without touch once it's worn.

## Research findings (short)

| Question | Answer |
|---|---|
| 3D satellite imagery from Apple Maps? | Yes. `MKMapView` with `MKImageryMapConfiguration(elevationStyle: .realistic)` (or `MKHybridMapConfiguration`) shows photoreal 3D "Flyover" meshes in supported cities. Outside those cities it falls back to flat satellite imagery on terrain. Use `MKStandardMapConfiguration(elevationStyle: .realistic)` as a fallback style. |
| Camera control | `MKMapCamera(lookingAtCenter:fromDistance:pitch:heading:)`. Setting `mapView.camera` without animation every frame is supported. **There is no roll.** Fake head roll by rotating the map view's container with a `CGAffineTransform`. Pitch is capped by MapKit, and the cap depends on altitude. |
| Stereo from MapKit? | **No.** No stereo or multi-view API. Use **two `MKMapView`s**, one per eye. MapKit anchors each camera to the surface (rooftops included) under its look-at point, so shifting each eye's center sideways misaligns the eyes vertically. Instead, both cameras look at the same point (the model center, or with head tracking the aim point) from eye positions ±baseline/2 apart (toe-in), and each picture is warped by a homography back to an ideal parallel eye (see `StereoGeometry.swift`). |
| Why it looks tiny | This is the *hyperstereo* effect. When the baseline between the two eyes is much wider than human eyes (~6.4 cm), your brain reads the scene as a small model. Baseline ≈ altitude / 50 (was / 30; lowered in T22 so a Cardboard-style viewer fuses comfortably), adjustable in Settings. Add a tilt-shift style blur (sharp band in the middle, blurred above and below) and a slight saturation boost to sell the effect. |
| Motion | `CMMotionManager.deviceMotion` (100 Hz) with reference frame `.xArbitraryCorrectedZVertical`. Read it **in Swift** on a `CADisplayLink` and set both cameras in the same frame. Do not send motion over the JS bridge. **First person** (T23, `FirstPersonCamera.swift`): the head stays at a fixed *vantage point*, the starting camera's own eye position (from its center, altitude as camera-to-center distance, pitch and heading). Head yaw and pitch turn the *gaze* from there; the camera looks at the *aim point*, where the gaze meets the ground. So the city stays world-fixed and the view pans across it, instead of the camera circling the model center. Camera turn = head turn × window FOV rendered ÷ FOV seen through the lens (about 0.61 for the default 35 mm round window 40 mm behind the lens; see `ViewerProfile.lookGain`), times the sensitivity setting, so a head turn of N° moves the city N° through the lens. Looking up stops smoothly at the steepest pitch MapKit draws from there (it asks MapKit up front). Recenter re-zeroes the head, not the vantage point; new camera props mean a new vantage point. The one-euro filter lets go as soon as the head moves (about 3 ms behind at 100°/s). Known limit: MapKit stands every camera on the ground height under its look-at point, so the vantage point bobs by about 1% of its height over dense city. |
| Can react-native-maps do this? | Not well. It doesn't give per-frame control of two synced realistic-elevation cameras. Use a small custom **Expo Module** in Swift. |
| City search | `MKLocalSearchCompleter` + `MKLocalSearch`, run natively. No API key or cost. Wrap them with TanStack Query in TS. |
| Simulator | Flyover renders in the Simulator, but there is no gyro. Motion needs a real iPhone. Build a "fake motion" debug mode (drag to look) for the Simulator. |

## Architecture

```
React Native (TypeScript, Expo dev client, New Architecture, iOS 16+)
├── expo-router (native stack)   — file-based routing, typed routes, real swipe-back + large titles
├── @tanstack/react-query        — every async/native call (search, flyover availability)
├── zustand (+ persist/MMKV)     — settings + recents (no prop drilling)
├── expo-symbols, expo-haptics, expo-blur, expo-keep-awake, expo-screen-orientation
└── modules/diorama-native (Expo Module, Swift)   ← the only Swift in the app
    ├── DioramaMapView      — native view: 1 or 2 MKMapViews, camera, tilt-shift overlay
    ├── HeadTracker         — CMMotionManager + CADisplayLink → head look (all native)
    ├── FirstPersonCamera   — head look → gaze from a fixed vantage point → camera (pure math)
    └── DioramaSearch       — async functions: autocomplete(query), resolve(completionId)
```

**Rule of thumb:** anything that runs every frame lives in Swift. Anything the user sees and edits (screens, layout, copy, settings, flow) lives in React. The Swift surface stays small and has a typed TS wrapper, so the user (who knows React, not Swift) can change behavior through props.

### Native view props (the TS contract)

```ts
type DioramaMapViewProps = {
  center: { latitude: number; longitude: number };
  altitude: number;          // meters
  pitch: number;             // degrees
  heading: number;           // degrees
  mode: 'mono' | 'stereo';
  eyeSeparation: number;     // multiplier on altitude-derived baseline
  headTracking: boolean;
  debugLook?: boolean;       // Simulator: drag to look instead of gyro
  trackingSensitivity: number;
  miniatureIntensity: number; // 0..1 tilt-shift + saturation
  orbit: boolean;            // slow auto-rotate (preview screen)
  onReady?: (e: { flyoverAvailable: boolean }) => void;
};
// ref methods: recenter(), setDebugLook(dx, dy)
```

### Folder layout (target)

```
app/                 # expo-router route files only, each a thin wrapper that renders a screen
                     #   _layout.tsx (root Stack + providers), index.tsx, city/[cityId].tsx,
                     #   view/[cityId].tsx, settings.tsx, dev/* (dev-only test routes)
src/providers/       # QueryClient, gesture root, etc. (used by app/_layout.tsx)
src/screens/         # one folder per screen: CityPicker, CityPreview, Viewer, Settings
src/features/        # cities (queries, curated list), settings (store), viewer (hooks)
src/ui/              # small Apple-style primitives (ListRow, Section, GlassButton, …)
src/theme/           # tokens: system colors, spacing, type ramp
modules/diorama-native/  # Expo Module (Swift + TS wrapper)
```

## Code rules

- TypeScript `strict`. No `any`.
- Keep components small: one screen is a thin route component plus a few child components. Hooks own the logic.
- **No prop drilling.** Shared state goes in zustand stores. Server/native async goes through TanStack Query hooks (`useCitySearch`, `useCity`).
- Routing only through expo-router (`useRouter`, `useLocalSearchParams`, `<Link>`, typed routes). Route files in `app/` stay thin and render a screen from `src/screens/`. No ad-hoc screen state.
- Keep Swift minimal, commented for a React developer, and exposed only through typed props, events, and functions.

## "Made by Apple" bar

- SF Pro via the system font. SF Symbols via `expo-symbols`. System colors that follow light/dark mode. Support Dynamic Type.
- Native stack navigation (expo-router `Stack`): real large titles, header search bar, edge swipe-back. Inset-grouped lists, materials (blur) in place of flat fills, haptics on meaningful actions.
- Motion: spring animations (Reanimated), no linear fades. Respect Reduce Motion.
- Copy: short, sentence case, no exclamation marks.
- Viewer: no chrome over the eyes. A brief HUD fades in on recenter, then fades out. The only control is a small glass close button in the black margin outside the eye windows (invisible through the lenses); holding anywhere for a second also exits.

## Known risks

1. **Two MKMapViews at 60 fps** is GPU/thermal heavy. Mitigations: cap the frame rate at 30–60, watch `ProcessInfo.thermalState` and drop to mono, pause the orbit.
2. **Tile streaming mismatch.** Each eye streams its own tiles, so one eye can briefly show different detail than the other. Keep the baseline small relative to the view, and wait for both views to finish rendering before showing the viewer.
3. **Orientation.** app.json must say `orientation: "default"`. If it says `portrait`, iOS can never rotate to landscape. Portrait is locked at runtime through native stack screen options, and only the Viewer route (a full-screen modal) allows landscape.
4. **No roll in MKMapCamera.** Roll is faked by rotating the view, so you need to overscan (make the map views larger than the screen) to hide the corners.
5. **Headset optics.** Cardboard lenses need barrel distortion correction. That's in the backlog as an optional setting; glasses-style viewers don't need it.

## Requirements (on the Mac)

Xcode (latest), Node LTS, iOS 16+ deployment target, a paid Apple Developer account for on-device builds and TestFlight, and a physical iPhone to test motion. Build with `npx expo run:ios --device`.
