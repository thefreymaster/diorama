# Diorama

A stereoscopic "tiny model city" iOS app. React Native (Expo dev client) with a small Swift Expo Module around Apple MapKit.

Read these first:
- @OVERVIEW.md: product, research findings, architecture, code rules, and the "made by Apple" bar.
- @TASKS.md: the task list. It's the source of truth for what to do next.

## Workflow

Run two terminals on the Mac:

1. **Planner terminal.** `/add-task <description>` adds a well-formed task to TASKS.md.
2. **Cycle terminal.** Start it with `claude --model sonnet`, then run `/begin-cycle`. The orchestrator (a cheap model) picks ready tasks and sends each one to the `implementer` subagent (Opus). It then verifies the work, commits, and loops.

## Rules for everyone

- TypeScript strict. No prop drilling: use zustand stores and TanStack Query hooks. Routing goes through expo-router (file-based, native stack).
- Put every per-frame job (motion, camera, stereo) in Swift. Put all UI and flow in React.
- The owner knows React, not Swift. Keep Swift small, commented, and exposed only through typed props/events/functions in `modules/diorama-native/src`.
- Always re-read TASKS.md right before you edit it. Another terminal may have changed it. Edit only the lines you need.
- Commit after each finished task: `T07: head tracking (native)`, then push.
- Nobody is at the keyboard during a cycle. Never run interactive commands: pass non-interactive flags, or write the files by hand.

## Commands

- `npm run typecheck`, `npm run lint`, `npm test`
- `npx expo prebuild -p ios` (after native or config changes)
- `npx expo run:ios` (Simulator: no gyro, use debugLook). The Simulator may use the dev client and Metro for checks.
- **Builds for the owner's iPhone go through TestFlight, never the Expo dev client** (owner rule, 2026-09-25): `npm run testflight` bumps the build number, archives and uploads (Xcode's Apple ID; needs the Mac's unlocked keychain, not SSH). Commit the bumped `app.json`. Details in `docs/app-store.md` → Uploading.
- Look at the app without touching it: `xcrun simctl openurl booted "diorama://dev/map"` opens a route, `xcrun simctl io booted screenshot <file>.png` captures the screen (then Read the PNG), `xcrun simctl ui booted appearance dark|light` flips the theme.
