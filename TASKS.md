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
Status: todo
Depends: —
Files: package.json, app.json, tsconfig.json, babel.config.js, eslint/prettier config, app/, src/
Details: Create a new Expo app (latest SDK) with a dev client (`expo-dev-client`), iOS only, New Architecture on, TS `strict`, path aliases (`@/` → `src/`). Bundle id `com.ejf.diorama` (placeholder). Add ESLint + Prettier. Add scripts: `typecheck`, `lint`, `test`, `ios`. Create the folder layout from OVERVIEW.md. The default orientation is portrait; the Viewer unlocks landscape later.
Acceptance: `npm run typecheck && npm run lint` pass. `npx expo prebuild -p ios` succeeds.

### T02 Theme tokens and Apple-style UI primitives
Status: todo
Depends: T01
Files: src/theme/, src/ui/
Details: Tokens use iOS system colors via `PlatformColor` (label, secondaryLabel, systemBackground, secondarySystemGroupedBackground, systemBlue, separator…), the iOS type ramp (largeTitle…caption2, Dynamic Type friendly), and spacing (4-pt grid). Primitives: `Screen`, `LargeTitleHeader`, `InsetGroupedSection`, `ListRow` (with SF Symbol + chevron), `SearchField`, `PrimaryButton` (capsule, filled), `GlassButton` (expo-blur material), `Symbol` (wrapper for expo-symbols). Each primitive gets its own file and stays under ~80 lines.
Acceptance: A temporary `/dev/ui` route renders every primitive in light and dark mode. Typecheck passes.

### T03 Providers: router, query client, stores
Status: todo
Depends: T01
Files: app/App.tsx, app/providers/, app/router.tsx, src/features/settings/store.ts, src/features/cities/recentsStore.ts
Details: `MemoryRouter` + `Routes`: `/` CityPicker, `/city/:cityId` CityPreview, `/view/:cityId` Viewer, `/settings` Settings. Placeholder screens for now. Add a `QueryClientProvider` (staleTime 5 min). Zustand stores persisted with `react-native-mmkv`: settings (eyeSeparation 1.0, trackingSensitivity 1.0, miniatureIntensity 0.6, mode 'stereo', debugLook false) and recents (max 8). Add Reanimated-based screen transition wrapper (push = slide from right, Viewer = fade/zoom).
Acceptance: You can navigate between all 4 placeholder routes; settings persist across app reloads.

## Phase 1 — Native module (Swift)

### T04 Expo Module skeleton + mono DioramaMapView
Status: todo
Depends: T01
Files: modules/diorama-native/**
Details: `npx create-expo-module --local diorama-native`. Add a native view `DioramaMapView` that wraps one `MKMapView` using `MKImageryMapConfiguration(elevationStyle: .realistic)`, with no POIs, no compass or scale, and interaction off. Props: center, altitude, pitch, heading, orbit. Apply them through `MKMapCamera`. Emit `onReady({ flyoverAvailable })` when the first full render finishes (`mapViewDidFinishRenderingMap` with fullyRendered). Infer `flyoverAvailable` from the 3D camera actually being accepted, or from a curated list if that's unreliable. Write a typed TS wrapper and a `ref` with `recenter()`. Comment the Swift for a React developer.
Acceptance: A test route shows Manhattan in 3D photoreal at altitude 1200 m, pitch 60°. Changing props from JS moves the camera. `orbit` rotates slowly.

### T05 Native city search (MKLocalSearchCompleter)
Status: todo
Depends: T04
Files: modules/diorama-native/ios/DioramaSearch*.swift, modules/diorama-native/src/search.ts, src/features/cities/queries.ts
Details: Async functions `autocomplete(query): Promise<Completion[]>` (restricted to cities and address results) and `resolve(completionId): Promise<City>` (name, country, lat, lon, suggested altitude from region span). TS hooks: `useCitySearch(query)` (debounced, `enabled: query.length > 1`, `placeholderData: keepPreviousData`) and `useCity(cityId)` (resolves curated or recent cities from the local cache without a network call).
Acceptance: Typing "Par" returns Paris within about 300 ms. `useCity` works offline for curated cities.

### T06 Curated Flyover city list
Status: todo
Depends: T01
Files: src/features/cities/curated.ts
Details: About 20 cities known to have Apple 3D Flyover (New York, San Francisco, Chicago, London, Paris, Rome, Barcelona, Tokyo, Sydney, Las Vegas, Seattle, Boston, Berlin, Venice, Florence, Prague, Vancouver, Miami, Los Angeles, Dubai). Each entry has id, name, country, coordinates of a landmark-dense center, default altitude, pitch, heading, and an SF Symbol or accent for its row.
Acceptance: The list is typed and every entry renders in 3D in the T04 test route (spot-check 5).

### T07 Head tracking (native)
Status: todo
Depends: T04
Files: modules/diorama-native/ios/HeadTracker.swift, DioramaMapView.swift
Details: `CMMotionManager.deviceMotion` at 60 Hz with `.xArbitraryCorrectedZVertical`. Convert the attitude to yaw/pitch/roll for a phone held in **landscape** in a head mount. Store a reference attitude when the viewer starts and on `recenter()`. Map yaw → camera heading offset. Map head pitch → camera pitch, clamped to the range MapKit allows, and looking down tilts you over the model. Map roll → rotate the container view with an overscanned frame. Smooth with a one-euro or low-pass filter. Drive everything from `CADisplayLink`, not the bridge. Add `debugLook` mode: a pan gesture feeds fake yaw/pitch for the Simulator. Add `NSMotionUsageDescription` to the app config.
Acceptance: On a device, turning your head turns the city with no visible jitter and no drift over 2 min. In the Simulator, dragging looks around.

### T08 Stereo rendering (two eyes)
Status: todo
Depends: T07
Files: modules/diorama-native/ios/DioramaMapView.swift, StereoRig.swift
Details: With `mode: 'stereo'`, lay out two `MKMapView`s side by side, each at half width. For each eye, move the camera center perpendicular to the current heading by ±baseline/2, where baseline = altitude / 30 × eyeSeparation. Apply a small toe-in (convergence) so the model center has zero parallax. Set both cameras in the same display-link tick. Keep the viewer hidden behind a loading state until both eyes have fully rendered. `mode: 'mono'` goes back to a single view. Watch the thermal state: at `.serious`, drop to 30 fps; at `.critical`, switch to mono and emit `onDegraded`.
Acceptance: Through a Cardboard viewer the city fuses into one 3D image and reads as a tabletop model. Changing eyeSeparation in Settings visibly changes the sense of scale.

### T09 Miniature (tilt-shift) look
Status: todo
Depends: T08
Files: modules/diorama-native/ios/MiniatureOverlay.swift
Details: Overlay each eye with a tilt-shift effect: stacked `UIVisualEffectView` blur bands at the top and bottom with gradient masks (`CAGradientLayer`), plus a sharp band in the middle. Add a slight saturation/contrast lift with a `CALayer` compositing filter or a tinted overlay. Private `CAFilter` APIs are forbidden (App Store). `miniatureIntensity` 0…1 scales the band size and blur. Keep the effect identical in both eyes.
Acceptance: At 0.6 intensity the view reads as a tilt-shift photo of a model. No FPS drop below 50 on the target device with stereo on.

## Phase 2 — Screens (React)

### T10 City picker screen
Status: todo
Depends: T02, T03, T05, T06
Files: src/routes/CityPicker/**
Details: Large title "Diorama" with a search field. When the search is empty, show a "Recent" section (if any) and a "Featured" inset-grouped list of curated cities. When searching, show results from `useCitySearch`. Row tap → haptic selection → `/city/:cityId`. A settings gear sits top right. Use skeleton rows while loading and a quiet empty state.
Acceptance: Search, tap a result, and you land on the preview. Recents update.

### T11 City preview screen
Status: todo
Depends: T04, T10
Files: src/routes/CityPreview/**
Details: A full-bleed mono `DioramaMapView` with `orbit` on, and the city name and country on a material card at the bottom. A capsule "Enter Diorama" button shows the SF Symbol `visionpro` (or `eyeglasses`) and a line of guidance: "Place your iPhone in your viewer." If the city doesn't have Flyover, show a subtle note: "3D buildings aren't available here. Terrain only."
Acceptance: Orbit is smooth, and the button navigates to `/view/:cityId`.

### T12 Viewer screen
Status: todo
Depends: T08, T11
Files: src/routes/Viewer/**, src/features/viewer/**
Details: Lock orientation to landscape on mount and restore it on unmount. Keep the screen awake, hide the status bar and home indicator (`prefersHomeIndicatorAutoHidden` via the module if needed). Show a 3-second countdown ("Put on your viewer"), then recenter. Double-tap anywhere recenters, with a haptic and a HUD. Long press (1 s) exits back to the preview. Pause rendering when the app goes to the background.
Acceptance: Full cycle on a device: enter, wear, look around, recenter, exit. No stuck orientation.

### T13 Settings screen
Status: todo
Depends: T03, T02
Files: src/routes/Settings/**
Details: An inset-grouped list: "Model size" slider (eyeSeparation 0.3–3), "Tracking sensitivity", "Miniature effect", a "Stereo" toggle, and "Look around by dragging" (debugLook, shown in dev builds only). Add a live mini preview at the top (mono DioramaMapView) that reflects the miniature setting. Add "Reset to defaults".
Acceptance: Changes persist and apply live in the Viewer.

## Phase 3 — Polish and ship

### T14 Apple polish pass
Status: todo
Depends: T10, T11, T12, T13
Files: src/**
Details: Check Dynamic Type at XXL, VoiceOver labels and hints, Reduce Motion (turns off orbit and spring overshoot), dark mode, and haptics consistency. Also check copy and SF Symbol weights against the text weight.
Acceptance: A checklist in the task Notes with every item ticked.

### T15 Performance and thermals
Status: todo
Depends: T09, T12
Files: modules/diorama-native/**
Details: Profile with Instruments (Core Animation FPS, GPU, Energy) on a device. Tune the display-link rate, overscan size, and blur cost. Confirm the thermal fallback works.
Acceptance: 10 minutes in stereo without reaching `.critical` on an iPhone 15-class device. Record the numbers in Notes.

### T16 Tests
Status: todo
Depends: T03, T05
Files: src/**/__tests__/, jest config
Details: Set up Jest + RNTL. Test the stores, query hooks (with the native module mocked), curated list integrity, and the router (each path renders its screen). Add pure-TS tests for any math that lives in TS.
Acceptance: `npm test` is green.

### T17 App icon, launch screen, TestFlight
Status: todo
Depends: T14
Files: app.json, assets/
Details: Icon (tiny isometric city block, Apple-style), a plain launch screen, Info.plist strings, and an EAS or Xcode archive configuration for TestFlight.
Acceptance: The build uploads to TestFlight.

## Backlog (not scheduled)

### T18 Lens distortion correction for Cardboard-style viewers
Status: todo
Depends: T08
Files: modules/diorama-native/ios/
Details: Optional barrel-distortion pass per eye. This probably needs rendering MKMapView into a Metal texture, which is expensive. Research first; drop it if the cost is too high.
Acceptance: Straight lines look straight through a Cardboard lens.
