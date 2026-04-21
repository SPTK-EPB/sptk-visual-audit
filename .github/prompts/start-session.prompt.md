---
description: "Start a session by running the session-start validator and then following the workspace-appropriate session workflow."
name: "start-session"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/start-session.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Start session

## MANDATORY: Run validator first

Before doing ANYTHING else, run:

```bash
bash ~/.claude/hooks/session-start-validator.sh
```

Present the full output to the user. If there are BLOCKERS, you MUST address every blocker before proceeding with the session workflow. Do not skip, defer, or acknowledge-and-move-on. Fix them.

## Workspace detection

Check the current working directory to determine which workflow to follow:

- If `pwd` is `$HOME` (e.g., `/home/stigm`): this is the **CC workspace** — proceed with `.claude/rules/cc-session-workflow.md`
- Otherwise: this is a **focused project workspace** — proceed with `.claude/rules/session-workflow.md` (the generic focused session workflow). If the project has its own session-start rules in its CLAUDE.md or `.claude/rules/`, follow those too.

Do NOT run CC-specific steps (cross-project pull, collect-staging, CF usage, gmail, RSS, news) in focused workspaces.
