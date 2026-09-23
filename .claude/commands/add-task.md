---
description: Add a new task to TASKS.md
argument-hint: <what you want done>
---

Add a task to TASKS.md for: $ARGUMENTS

Steps:
1. Read OVERVIEW.md and TASKS.md. Look at the codebase only as much as you need to get the file paths and dependencies right.
2. If the request overlaps an existing `todo` task, update that task instead of adding a duplicate, and say which one you updated.
3. Otherwise, append a new `###` block under the right phase (or under **Backlog** if it's clearly later work). Use the next unused `T` number and follow the format rules at the top of TASKS.md exactly: Status `todo`, Depends, Files, Details, Acceptance.
4. Size each task so one implementer can finish it in one sitting. If the request is bigger than that, split it into several tasks with dependencies.
5. Re-read TASKS.md right before you write it (the cycle terminal may have changed it) and make a minimal edit.
6. Don't implement anything. Reply with the task ID(s) and a one-line summary of each.
