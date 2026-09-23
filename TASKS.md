# Tasks

Format rules (the orchestrator and `/add-task` both depend on these):
- One `###` block per task. The ID is `T` + a number and is never reused.
- `Status:` is exactly one of `todo` | `in-progress` | `done` | `blocked`.
- `Depends:` lists task IDs, or `—`.
- `Files:` lists the paths the task is expected to touch. The orchestrator uses this to decide which tasks can run in parallel.
- `Acceptance:` must be checkable, either by a command or by a clear manual step on the Mac/device.
- When you finish a task, set `Status: done` and add a `Notes:` line (1–3 lines: decisions, follow-ups).

---

## Phase 0 — Foundation

### T01 Scaffold the Expo TypeScript app
Status: done
Depends: —
Files: package.json, package-lock.json, app.json, tsconfig.json, babel.config.js, eslint/prettier config, jest config, app/_layout.tsx, app/index.tsx, src/
Details: Create a new Expo app (latest SDK) with expo-router and a dev client (`expo-dev-client`), iOS only, New Architecture on, TS `strict`, typed routes on, path aliases (`@/` → `src/`). Bundle id `com.ejf.diorama` (placeholder). URL scheme `diorama`, so `diorama://settings`-style deep links open routes for Simulator checks. iOS deployment target at least 16.0 via `expo-build-properties` (the MKMapConfiguration APIs need iOS 16); keep the SDK default if it's already higher. Set `orientation: "default"` in app.json, **not** `portrait`: with `portrait` iOS can never rotate to landscape. Portrait is locked at runtime in T03. **Install every planned dependency now**, with `npx expo install` so versions match the SDK, so that later parallel tasks never touch package.json: expo-router and its peers (react-native-screens, react-native-safe-area-context, expo-linking, expo-constants, expo-status-bar), @tanstack/react-query, zustand, react-native-mmkv (and its peers), react-native-reanimated (and its peers), react-native-gesture-handler, @react-native-community/slider, expo-symbols, expo-haptics, expo-blur, expo-keep-awake, expo-screen-orientation, expo-build-properties. Dev: jest-expo, @testing-library/react-native, ESLint + Prettier. Set up Jest (`jest-expo` preset) with one smoke test. Add scripts: `typecheck`, `lint`, `test`, `ios`. Create the folder layout from OVERVIEW.md: `app/_layout.tsx` is a bare `Stack` and `app/index.tsx` is a placeholder. Use non-interactive flags for every generator.
Acceptance: `npm run typecheck && npm run lint && npm test` pass. `npx expo prebuild -p ios` succeeds, and `npx expo run:ios` launches the placeholder in the Simulator.
Notes: Expo SDK 57 (RN 0.86.3, React 19.2.3, TS 6.0); iOS target 16.4 is the SDK default. `typecheck` regenerates typed routes first (`expo customize tsconfig.json`). @testing-library/react-native pinned to 13.3.x (expo-router's `renderRouter` breaks on v14); `jest.setup.ts` mocks worklets/nitro, MMKV uses its in-memory fallback. `.gitignore` anchors `/ios` so `modules/diorama-native/ios/` stays tracked. After a fresh install, the first `simctl openurl` shows an "Open in 'Diorama'?" alert: press its "Open" button via System Events AXPress.

### T02 Theme tokens and Apple-style UI primitives
Status: done
Depends: T01
Files: src/theme/, src/ui/, app/dev/ui.tsx
Details: Tokens use iOS system colors via `PlatformColor` (label, secondaryLabel, systemBackground, secondarySystemGroupedBackground, systemBlue, separator…), the iOS type ramp (largeTitle…caption2, Dynamic Type friendly), and spacing (4-pt grid). Primitives: `Screen`, `InsetGroupedSection`, `ListRow` (with SF Symbol + chevron), `SkeletonRow`, `PrimaryButton` (capsule, filled), `GlassButton` (expo-blur material), `Symbol` (wrapper for expo-symbols). No large-title header or search field primitives: the native stack header provides those (`headerLargeTitle`, `headerSearchBarOptions`). Each primitive gets its own file and stays under ~80 lines.
Acceptance: A dev-only route `app/dev/ui.tsx` (open with `diorama://dev/ui`; it redirects to `/` outside `__DEV__`) renders every primitive. Simulator screenshots look right in light and dark mode. Typecheck passes.
Notes: SF Symbol wrapper is `SymbolIcon`: a component named `Symbol` shadows the global the React Compiler calls (`Symbol.for`). `GlassButton`/`GlassSurface` use Liquid Glass (expo-glass-effect) on iOS 26 with an expo-blur fallback; `Text` primitive has Dynamic Type variants. 52-pt rows / 26-pt corners match iOS 26 Settings (pixel-checked). Follow-up being fixed: large title invisible on `dev/ui`, separator insets/thickness. NEEDS DEVICE CHECK — glass reacts to touch; Reduce Motion stops skeleton pulse.

### T03 Providers: navigation stack, query client, stores
Status: done
Depends: T01
Files: app/_layout.tsx, app/index.tsx, app/city/[cityId].tsx, app/view/[cityId].tsx, app/settings.tsx, src/providers/, src/screens/, src/features/settings/store.ts, src/features/cities/recentsStore.ts
Details: The root `Stack` in `app/_layout.tsx` is wrapped in providers from `src/providers/`: `GestureHandlerRootView`, and a `QueryClientProvider` (staleTime 5 min). Routes: `app/index.tsx` → CityPicker, `app/city/[cityId].tsx` → CityPreview, `app/view/[cityId].tsx` → Viewer (presentation `fullScreenModal`, no header), `app/settings.tsx` → Settings. Each route file only renders its screen from `src/screens/<Name>/`; use placeholder screens for now. Native stack options: large title on the picker, `orientation: 'portrait'` by default, and landscape only on the Viewer. Zustand stores persisted with `react-native-mmkv`: settings (eyeSeparation 1.0, trackingSensitivity 1.0, miniatureIntensity 0.6, mode 'stereo', debugLook false) and recents (max 8).
Acceptance: `diorama://settings`, `diorama://city/paris` and `diorama://view/paris` each open their placeholder in the Simulator, and swipe-back works. A Jest test shows the settings store persists and rehydrates. `npm run typecheck && npm run lint && npm test` pass.
Notes: Deep links get the picker underneath (`unstable_settings.initialRouteName`). Viewer: `fullScreenModal`, landscape, `autoHideHomeIndicator`; hiding the status bar is left to T12 (red box while `UIViewControllerBasedStatusBarAppearance=false`). Settings store: `useSettings`, `useSetting`, setters clamp to `SETTING_RANGES` (trackingSensitivity 0.5–2, for T13 to confirm), `resetSettings`. Deep links, rotation, Done and swipe-back all checked in the Simulator. Follow-up being fixed: hairline under nav bar at rest; picker large title collapses after the Viewer closes when opened by deep link.

## Phase 1 — Native module (Swift)

### T04 Expo Module skeleton + mono DioramaMapView
Status: done
Depends: T01
Files: modules/diorama-native/**, app/dev/map.tsx
Details: Scaffold with `npx create-expo-module --local diorama-native`. It's interactive: if flags can't skip the prompts, write the module files by hand (expo-module.config.json, podspec, Swift, TS index). Add a native view `DioramaMapView` that wraps one `MKMapView` using `MKImageryMapConfiguration(elevationStyle: .realistic)`, with no POIs, no compass or scale, and interaction off. Props: center, altitude, pitch, heading, orbit. Apply them through `MKMapCamera`. Emit `onReady({ flyoverAvailable })` when the first full render finishes (`mapViewDidFinishRenderingMap` with fullyRendered). Infer `flyoverAvailable` from the 3D camera actually being accepted, or from a curated list if that's unreliable. Write a typed TS wrapper and a `ref` with `recenter()`. Comment the Swift for a React developer. The dev-only route `app/dev/map.tsx` (redirects to `/` outside `__DEV__`) reads optional `lat`, `lon`, `altitude`, `pitch`, `heading` search params and defaults to Manhattan.
Acceptance: A Simulator build compiles. `diorama://dev/map` shows Manhattan in 3D photoreal at altitude 1200 m, pitch 60° (check the screenshot). Changing props from JS moves the camera. `orbit` rotates slowly.
Notes: NEEDS DEVICE CHECK — orbit smoothness and heat on `diorama://dev/map?orbit=1`. MapKit gives no reliable Flyover signal, so `flyoverAvailable` comes from `modules/diorama-native/src/flyoverCoverage.ts` (61 cities checked by screenshot; Dubai and Mexico City are flat only). `altitude` = camera-to-center distance (`centerCoordinateDistance`). Add new props in `DioramaMapView.types.ts` + a `Prop` in `DioramaNativeModule.swift`; `FrameTicker` is reusable for T07.

### T05 Native city search (MKLocalSearchCompleter)
Status: done
Depends: T03, T04, T06
Files: modules/diorama-native/ios/DioramaSearch*.swift, modules/diorama-native/src/search.ts, src/features/cities/queries.ts, app/dev/search.tsx
Details: Async functions `autocomplete(query): Promise<Completion[]>` (restricted to cities and address results) and `resolve(completionId): Promise<City>` (name, country, lat, lon, suggested altitude from region span). TS hooks: `useCitySearch(query)` (debounced, `enabled: query.length > 1`, `placeholderData: keepPreviousData`) and `useCity(cityId)` (resolves curated or recent cities from the local cache without a network call). Add a dev-only route `app/dev/search.tsx` with a text field and a results list for checking.
Acceptance: A Simulator build compiles. In `diorama://dev/search`, typing "Par" returns Paris within about 300 ms. `useCity` works offline for curated cities (Jest test with the native module mocked).
Notes: "Par" → Paris 193–256 ms after last keystroke in the Simulator (debounce 100 ms). Resolved ids are `slug_lat_lon` (e.g. `paris_48.857_2.351`); suggested altitude ≈ place width / 12, clamped 800–3000 m. Filter = localities + neighborhoods + regions (Tokyo is filed as a prefecture); each query gets its own completer, newer cancels older. For T10: `useResolveCity().mutate(id)` → `addRecent` → navigate (the resolved city is already in the `useCity` cache); completions carry `titleHighlights`. NEEDS DEVICE CHECK — search latency on cellular; on iOS 16/17 street addresses also appear (no locality filter there).

### T06 Curated Flyover city list
Status: done
Depends: T01, T04
Files: src/features/cities/curated.ts, src/features/cities/__tests__/curated.test.ts
Details: About 20 cities known to have Apple 3D Flyover (New York, San Francisco, Chicago, London, Paris, Rome, Barcelona, Tokyo, Sydney, Las Vegas, Seattle, Boston, Berlin, Venice, Florence, Prague, Vancouver, Miami, Los Angeles, Dubai). Each entry has id, name, country, coordinates of a landmark-dense center, default altitude, pitch, heading, and an SF Symbol or accent for its row.
Acceptance: The list is typed. A Jest test checks that ids are unique and coordinates are in range. Spot-check 5 entries in 3D via `diorama://dev/map?lat=…&lon=…` (screenshots).
Notes: 20 cities; Amsterdam replaces Dubai (flat imagery only). Every center sits inside a T04-verified `FLYOVER_AREAS` entry (tested). `CuratedCity` = `RecentCity` + pitch, heading, symbol, tileColor; `getCuratedCity(id)`. Simulator spot-check of 5 camera framings still pending.

### T07 Head tracking (native)
Status: done
Depends: T04
Files: modules/diorama-native/ios/HeadTracker.swift, modules/diorama-native/ios/DioramaMapView.swift, modules/diorama-native/src/, app.json, app/dev/map.tsx
Details: `CMMotionManager.deviceMotion` at 60 Hz with `.xArbitraryCorrectedZVertical`. Convert the attitude to yaw/pitch/roll for a phone held in **landscape** in a head mount. Store a reference attitude when the viewer starts and on `recenter()`. Map yaw → camera heading offset. Map head pitch → camera pitch, clamped to the range MapKit allows, and looking down tilts you over the model. Map roll → rotate the container view with an overscanned frame. Smooth with a one-euro or low-pass filter. Drive everything from `CADisplayLink`, not the bridge. Add `debugLook` mode: a pan gesture feeds fake yaw/pitch for the Simulator (the dev map route turns it on). Add `NSMotionUsageDescription` to the app config.
Acceptance: On a device, turning your head turns the city with no visible jitter and no drift over 2 min. In the Simulator, dragging looks around.
Notes: NEEDS DEVICE CHECK — `npx expo run:ios --device`, open `diorama://dev/map?headTracking=1&landscape=1`: Xcode console should print `[HeadTracker] axis check OK`; in both landscape directions, head right turns right, look down tilts over the model, ear-to-shoulder stays level with no corners up to ~20°; no jitter; flat on a table 2 min, heading must not creep; Recenter; try `&sensitivity=0.5`/`2`. Pure pose math in `HeadPose.swift` (axis conventions at top), one-euro filter; yaw/pitch relative to the first-render/recenter pose, roll against gravity; props optional (default off/off/1). Overscan narrows the view (map is 1.68× screen height in landscape mono), so roll is capped at 20°. For T08: each eye needs its own rotating container, and apply both cameras only after both have loaded (terrain can shift the eyes vertically). Added the `@diorama/native` alias (tsconfig + Jest).

### T08 Stereo rendering (two eyes)
Status: done
Depends: T07
Files: modules/diorama-native/ios/DioramaMapView.swift, modules/diorama-native/ios/StereoRig.swift, modules/diorama-native/src/, app/dev/map.tsx
Details: With `mode: 'stereo'`, lay out two `MKMapView`s side by side, each at half width. For each eye, move the camera center perpendicular to the current heading by ±baseline/2, where baseline = altitude / 30 × eyeSeparation. Apply a small toe-in (convergence) so the model center has zero parallax. Set both cameras in the same display-link tick. Keep the viewer hidden behind a loading state until both eyes have fully rendered. `mode: 'mono'` goes back to a single view. Watch the thermal state: at `.serious`, drop to 30 fps; at `.critical`, switch to mono and emit `onDegraded`. The dev map route accepts `mode=stereo`.
Acceptance: A Simulator screenshot of `diorama://dev/map?mode=stereo` shows two eyes side by side with a small horizontal offset. Through a Cardboard viewer the city fuses into one 3D image and reads as a tabletop model. Changing eyeSeparation visibly changes the sense of scale.
Notes: NEEDS DEVICE CHECK — Cardboard: does `diorama://dev/map?mode=stereo&headTracking=1&eyeSeparation=0.5` (then 1, 2, 3) fuse and read as a tabletop model? Check fps and heat (each eye draws a 618-pt square plus a `CAReplicatorLayer` copy; T09 needs ≥50 fps), real head roll stays fused and level, thermal via Xcode Devices → Condition (serious → 30 fps, critical → mono + `onDegraded`), and that mono (preview, T07 tracking) did not regress. Design: both MapKit cameras look at the same center from eye positions (toe-in), then a per-eye homography warps back to an ideal parallel eye; this also cancels roll and zeroes parallax at the center. Needed because MapKit anchors each camera to the surface under its look-at point. Measured vertical disparity ≈0 pt in every case; horizontal disparity grows linearly with eyeSeparation. Layout margins are equalised (camera now centered on the full view, mono too); pitch cap is learned and shared by both eyes; switching to stereo builds fresh maps; `onReady` falls back after 10 s. T09 overlay slot: `EyeView.overlay` via `StereoRig.makeOverlay`.

### T09 Miniature (tilt-shift) look
Status: done
Depends: T08
Files: modules/diorama-native/ios/MiniatureOverlay.swift, modules/diorama-native/ios/DioramaMapView.swift, modules/diorama-native/src/
Details: Overlay each eye with a tilt-shift effect: stacked `UIVisualEffectView` blur bands at the top and bottom with gradient masks (`CAGradientLayer`), plus a sharp band in the middle. Add a slight saturation/contrast lift with a `CALayer` compositing filter or a tinted overlay. Private `CAFilter` APIs are forbidden (App Store). `miniatureIntensity` 0…1 scales the band size and blur. Keep the effect identical in both eyes.
Acceptance: At 0.6 intensity the view reads as a tilt-shift photo of a model (Simulator screenshot). No FPS drop below 50 on the target device with stereo on.
Notes: NEEDS DEVICE CHECK — fps with stereo at miniature 0.6 and 1 must stay ≥50; real head roll keeps the bands level; heat over a few minutes. Blur via the public `UIViewPropertyAnimator.fractionComplete` technique on `.systemUltraThinMaterialDark` (on iOS 26 it must be applied one runloop after the band is on screen; reapplied on foreground); below ~0.2 the bands fade in instead of blurring less. `compositingFilter` is unsupported on iOS, so the lift is a warm tint of up to 8%. Measured sharpness at 0.6: top 0.35×, middle 0.96×, bottom 0.16× of unblurred; the eyes match within 0.02. OPEN QUESTION for owner: the bottom band softens MapKit's Apple logo and Legal link, which Apple asks apps to keep visible.

## Phase 2 — Screens (React)

### T10 City picker screen
Status: done
Depends: T02, T03, T05, T06
Files: src/screens/CityPicker/**
Details: A native large title "Diorama" with the stack header's search bar (`headerSearchBarOptions`). When the search is empty, show a "Recent" section (if any) and a "Featured" inset-grouped list of curated cities. When searching, show results from `useCitySearch`. Tapping a search result resolves it, adds it to recents, then navigates, so `useCity` can find it offline. Row tap → haptic selection → `/city/[cityId]`. A settings gear sits top right in the header. Use skeleton rows while loading and a quiet empty state.
Acceptance: Search, tap a result, and you land on the preview. Recents update.
Notes: Search text lives in the URL (`?q=`), so `diorama://?q=par` opens with results; `useSeededSearchBarRef` fills the native field on first mount. Gear is a native `Stack.Toolbar` bar button (iOS 26 glass; Expo marks it experimental). Every opened city goes to Recent; a search result matching a featured city (same name, <50 km) opens the tuned featured entry. Leaving mid-resolve cancels the push. `ListRow` gained an optional `titleHighlights` prop. Simulator visual check pending (light/dark, `?q=par` bold matches, search field placement, VoiceOver "Settings").

### T11 City preview screen
Status: done
Depends: T04, T10
Files: src/screens/CityPreview/**
Details: A full-bleed mono `DioramaMapView` with `orbit` on, and the city name and country on a material card at the bottom. A capsule "Enter Diorama" button shows the SF Symbol `visionpro` (or `eyeglasses`) and a line of guidance: "Place your iPhone in your viewer." If the city doesn't have Flyover, show a subtle note: "3D buildings aren't available here. Terrain only."
Acceptance: Orbit is smooth, and the button navigates to `/view/[cityId]`.
Notes: Header is transparent; title = city name (so pushed screens read "‹ Paris") but not drawn over the map; blurred bar before iOS 26. Map stays opaque under a cover that fades out once rendered (MapKit may not draw an invisible map). Orbit pauses when the screen loses focus and under Reduce Motion (`useReduceMotion` follows the setting live; T14 could move it to `@/ui`). Terrain note only after `onReady` says no Flyover; unknown id shows an empty state. NEEDS DEVICE CHECK — orbit smoothness, card legibility over bright/dark imagery, 44-pt card radius vs the phone corners, haptic. Simulator visual check pending.

### T12 Viewer screen
Status: done
Depends: T08, T11
Files: src/screens/Viewer/**, src/features/viewer/**
Details: Landscape comes from the route's native stack `orientation` option (set in T03), backed by `expo-screen-orientation` if needed. Portrait comes back on exit. Keep the screen awake, hide the status bar and home indicator (`prefersHomeIndicatorAutoHidden` via the module if needed; keep any native change tiny and call it out). Show a 3-second countdown ("Put on your viewer"), then recenter. Double-tap anywhere recenters, with a haptic and a HUD. Long press (1 s) exits back to the preview. Pause rendering when the app goes to the background.
Acceptance: Full cycle on a device: enter, wear, look around, recenter, exit. No stuck orientation.
Notes: NEEDS DEVICE CHECK — full cycle: enter, wear, look around, double-tap recenter, hold 1 s to exit; the per-eye HUD copies fuse in the headset; an incoming call or the app switcher stops tracking and it recenters on return; VoiceOver "Exit"/activate actions. Tracking stays off during the 3-s countdown (which starts after `onReady`), then recenters and starts. The HUD is drawn once per eye in stereo. Exit uses `router.dismissTo` the preview (fixes the deep-link large-title collapse). Status bar hidden via expo-status-bar; `useKeepAwake`. No native pause: turning tracking off while inactive stops the per-frame work. Follow-up: `useReduceMotion` lives in CityPreview; move it to `@/ui` (T14).

### T13 Settings screen
Status: done
Depends: T02, T03, T04, T09
Files: src/screens/Settings/**
Details: An inset-grouped list: "Model size" slider (eyeSeparation 0.3–3), "Tracking sensitivity", "Miniature effect", a "Stereo" toggle, and "Look around by dragging" (debugLook, shown in dev builds only). Add a live mini preview at the top (mono DioramaMapView) that reflects the miniature setting. Add "Reset to defaults".
Acceptance: Changes persist across app reloads. The mini preview updates live (screenshots at miniature 0 and 1). The Viewer reads the same store, so changes apply there too (checked in T14).
Notes: Preview card with the Miniature slider directly under it (like Display & Brightness), then Stereo, Model size, Tracking sensitivity, Developer (dev only), and a red "Reset to defaults" (instant, light haptic). Every slider runs 0–1 through a scale: Model size is reversed (wider eyes = smaller-looking model) and spaced by ratio, and 1× sits mid-track for both. trackingSensitivity stays 0.5–2. Preview city = last opened featured city, else New York. `miniatureIntensity` is also wired into the Viewer. Follow-ups for T14: shared hooks (`useMapReveal`, `usePreviewOrbit`, `useReduceMotion`) live in CityPreview; rows import `@/ui/RowSeparator`/`rowStyles` directly; check the `camera.macro` slider icons. Simulator visual check pending.

## Phase 3 — Polish and ship

### T14 Apple polish pass
Status: done
Depends: T10, T11, T12, T13
Files: src/**, app/**
Details: Check Dynamic Type at XXL, VoiceOver labels and hints, Reduce Motion (turns off orbit and spring overshoot), dark mode, and haptics consistency. Also check copy and SF Symbol weights against the text weight. Confirm settings changes apply live in the Viewer. Confirm the `app/dev/*` routes redirect outside `__DEV__`.
Acceptance: A checklist in the task Notes with every item ticked.
Notes: Checklist: [x] VoiceOver (labels/hints/roles, rows as one element, Viewer Recenter/Exit actions + hint, failed-open announcement; tested) [x] Reduce Motion (one live `useReduceMotion` in `@/theme`; orbit off in Preview/Settings, verified by pixel diff; no spring bounce; HUD fade only) [x] Shared hooks in `src/features/map/`; `ControlRow`/`ToggleRow`/destructive `ListRow`/haptics in `@/ui` [x] Dynamic Type XXL + AX5 (rows wrap, value moves under title at AX sizes, buttons/HUD capped) [x] Dark mode [x] Haptics (selection rows, light Enter/Recenter/Reset, medium Exit) [x] Copy [x] SF Symbol weights [x] Settings apply live in Viewer [x] Dev routes redirect outside `__DEV__` [x] T02 separators match iOS 26 Settings exactly (72→369.7 pt, 1 pt) [x] T03 no hairline at rest [x] T06 framings (Sydney, Chicago retuned) [x] T10–T13 screens in light/dark. Fixed: HUD Liquid Glass not drawn under animated opacity, preview title drawn over map, terrain note clipped to 0 height, `?q=` links not syncing the search field. Open: T19, T20, T21. NEEDS DEVICE CHECK — spoken VoiceOver pass, haptic feel, live Reduce Motion toggle, HUD glass on a real iPhone.

### T15 Performance and thermals
Status: todo
Depends: T09, T12
Files: modules/diorama-native/**
Details: Profile with Instruments (Core Animation FPS, GPU, Energy) on a device. Tune the display-link rate, overscan size, and blur cost. Confirm the thermal fallback works.
Acceptance: 10 minutes in stereo without reaching `.critical` on an iPhone 15-class device. Record the numbers in Notes.

### T16 Tests
Status: done
Depends: T03, T05
Files: src/**/__tests__/, jest.setup.ts
Details: Jest is set up in T01. Add tests for the stores, query hooks (with the native module mocked), curated list integrity, and routes (each path renders its screen, using `renderRouter` from `expo-router/testing-library`). Add pure-TS tests for any math that lives in TS.
Acceptance: `npm test` is green.
Notes: Coverage of target code 93%→98% statements (features, providers, theme 100%; ui 100% lines). `jest.setup.ts` points expo-router testing-library's reanimated mock at the real Reanimated, so `useReducedMotion` works under `renderRouter`. Dev routes tested to redirect when `__DEV__` is false. Found a bug: malformed persisted recents crashed `getRecent()`, fixed as a T03 follow-up.

### T17 App icon, launch screen, TestFlight
Status: in-progress
Depends: T14
Files: app.json, assets/
Details: Icon (tiny isometric city block, Apple-style), a plain launch screen, Info.plist strings, and an EAS or Xcode archive configuration for TestFlight.
Acceptance: The build uploads to TestFlight.

### T20 Viewer loading cover lifts before both eyes are ready
Status: todo
Depends: T08, T12
Files: modules/diorama-native/ios/DioramaMapView.swift, modules/diorama-native/ios/StereoRig.swift
Details: Found in the T14 visual pass: on a first, uncached visit (e.g. the retuned Sydney framing), the Viewer's black cover lifted and the city was visible for ~6 s with no countdown; `onReady` (and so the countdown) came later. The cover must stay up until the same moment `onReady` fires (both eyes fully rendered, or the 10-s fallback), so the cover, countdown and tracking start stay in sync. Reproduce cold with a cleared tile cache if possible.
Acceptance: On 5 cold first visits to uncached cities, the cover lifts at the same moment the countdown starts (Simulator screenshots/frame capture). Stereo alignment unchanged.

### T21 Keep MapKit attribution legible under the miniature blur
Status: blocked
Depends: T09
Files: modules/diorama-native/ios/MiniatureOverlay.swift
Details: The bottom tilt-shift band blurs MapKit's Apple Maps logo and "Legal" link (Viewer, Settings preview, dev map). Apple requires map attribution to stay visible, so this is an App Review risk. Options: keep a small sharp strip at the bottom of each eye where the attribution sits, or move the attribution above the band. Owner decides.
Acceptance: The logo and "Legal" are legible in every eye at miniature 1 (screenshots), and the tilt-shift still reads as a model.
Notes: Waiting on owner decision.

## Backlog (not scheduled)

### T18 Lens distortion correction for Cardboard-style viewers
Status: todo
Depends: T08
Files: modules/diorama-native/ios/
Details: Optional barrel-distortion pass per eye. This probably needs rendering MKMapView into a Metal texture, which is expensive. Research first; drop it if the cost is too high.
Acceptance: Straight lines look straight through a Cardboard lens.

### T19 Picker large title collapses after exiting a deep-linked Viewer
Status: todo
Depends: T12
Files: src/screens/CityPicker/**, app/_layout.tsx
Details: After opening `diorama://view/<id>` directly and holding to exit, then going back to the picker, its large title is collapsed (scrolling restores it). Cause: the picker is laid out in landscape under the modal, where iPhone hides large titles, and its scroll offset stays at the small-bar position. expo-router renders the picker as focused before pushing the linked route, so JS can't reliably detect the case. Likely needs a tiny native scroll-to-top (react-native-screens) or a react-native-screens fix. Cosmetic and deep-link only; the normal flow is fine.
Acceptance: After the deep-link flow above, the picker shows its expanded large title (Simulator screenshot).
