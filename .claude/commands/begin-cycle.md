---
description: Orchestrate — dispatch ready tasks to Opus implementers until done
model: sonnet
argument-hint: [optional task IDs or "once"]
---

You are the **orchestrator**. You do not write app code yourself. You dispatch, verify, record, and commit.

Arguments: $ARGUMENTS. If it lists task IDs, only run those. If it says `once`, stop after one round.

## Loop

1. **Read** TASKS.md again, fresh every round, because the planner terminal adds tasks while this runs.
2. **Pick ready tasks.** A task is ready when its status is `todo` and every task in `Depends` is `done`. Skip anything in Backlog unless it's named in the arguments. Also skip tasks that can't be done without a human (Instruments on a device, App Store credentials): leave them `todo` and list them in the final report.
3. **Batch.** From the ready tasks, pick up to 3 whose `Files:` don't overlap each other. Also never put two tasks that both touch `modules/diorama-native/ios/` in the same batch. **At most one task per batch may use the Simulator**: any task touching `modules/diorama-native/`, `app.json`, `app/`, or `src/screens/`. Set each one to `Status: in-progress` in TASKS.md.
4. **Dispatch** each task in the batch to the `implementer` subagent. If there's more than one, launch them all in a single message so they run in parallel. The prompt should say: "Implement <ID> from TASKS.md. Paste the full task block. Follow CLAUDE.md and OVERVIEW.md. Report files changed, how you verified it, and anything that needs a human on a Mac/device." Add "You own the Simulator" to the one Simulator task, and "Don't start Metro or the Simulator" to the others.
5. **Verify** once every implementer in the batch has replied: run `npm run typecheck`, `npm run lint`, and `npm test`. Check the acceptance criteria that can be checked from the command line.
   - Passes → for each task in turn: set `Status: done` and add the implementer's short `Notes:`, then `git add -- <the files that implementer reported> TASKS.md`, `git commit -m "<ID>: <title>"`, and `git push`. Never `git add -A`: parallel tasks would end up in one commit. After the batch, `git status --porcelain` should be empty; if it isn't, work out which task the leftovers belong to.
   - Fails → send it back to the implementer with the errors, at most 2 retries. After that, set `Status: blocked` and write the reason in `Notes:`.
   - Needs device verification (motion, stereo, thermals) → mark it `done` if the code checks pass, but add `Notes: NEEDS DEVICE CHECK — <what to check>`.
   - If `git push` fails, keep going, retry after the next commit, and say so in the final report.
6. **Repeat** until no task is ready.

## Finish

Print a short report:
- tasks completed, blocked, and needing a device check
- what's ready next, if anything

Rules: keep your context lean. Don't read implementation files in depth; that's the implementer's job. Re-read TASKS.md before every edit and change only the status/notes lines of the task you're updating.
