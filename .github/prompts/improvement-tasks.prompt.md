---
description: "Walk through pending improvement tasks one at a time, presenting a task and a recommendation on how to address it."
name: "improvement-tasks"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/improvement-tasks.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Let's go through any pending improvement tasks. We will address them one by one. Present a task and make a recommendation on how to address it. Don't move on to the next task until the current one is approved.

**Source files** — read these first to enumerate pending items:

- CC workspace: `memory/workspace/improvements.md` + `gh issue list --label improvement` (across SPTK-EPB repos)
- Focused workspace: project's `memory/tasks.md` + `gh issue list --repo SPTK-EPB/<current-repo> --label improvement`

Verify each item against current code/state before presenting — improvements lists can be stale (item already shipped, related fix landed elsewhere). Drop verified-already-done items with a one-line note.
