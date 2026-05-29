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

## MANDATORY: Present the validator's MODE menu as a choice (user policy 2026-05-29)

The validator output includes a `MODE — pick how to start this session (recommended: …)` menu listing all three tiers (full / quick / super-quick) with a one-line explanation of each and a **recommended:** marker on the cadence-appropriate default. **Present that choice to the user via `AskUserQuestion`** — default-select the recommended option but let the user override; do NOT silently auto-proceed on the recommendation. Do not derive the recommendation yourself from `MEMORY.md`, git log, or context-injected dates — those lag by hours-to-days and have caused repeated wrong-mode declarations within the same day. The validator's mechanical detection is the single source of truth for the *recommendation*; the user makes the final call.

On clean super-quick runs, output is intentionally minimal (cc#220 cost-reduction, session 759) — just the MODE menu and 30%-sampled INFO. Blockers/warnings always emit full output regardless of tier. Force full output for debugging via `SESSION_VALIDATOR_VERBOSE=1`.

Tier cadence (cc#221): full = first-of-day; quick = every ~10th in-day session (deep refresh); super-quick = default for 2nd+ session that isn't a deep-refresh slot. Super-quick skips ~20 of the heavy startup checks and jumps straight to GitHub-issue triage — see the "Super-quick start" section of the relevant workflow doc.

## Workspace detection

Check the current working directory to determine which workflow to follow:

- If `pwd` is `$HOME` (e.g., `/home/stigm`): this is the **CC workspace** — proceed with `.claude/rules/cc-session-workflow.md`
- Otherwise: this is a **focused project workspace** — proceed with `.claude/rules/session-workflow.md` (the generic focused session workflow). If the project has its own session-start rules in its CLAUDE.md or `.claude/rules/`, follow those too.

Do NOT run CC-specific steps (cross-project pull, collect-staging, CF usage, gmail, RSS, news) in focused workspaces.

## MANDATORY: After sync, fan out immediately

Once the required isolated sync step from the chosen session workflow completes successfully, the very next action must be a single parallel, read-only context-gathering batch for the remaining startup checks.

Do not pause to restate the plan, summarize progress, or emit a status-only message between sync completion and that batch unless the sync itself failed or surfaced a blocker.

In focused workspaces, this means batching as many of the post-sync startup probes as practical in one shot: resource check, CI health, PRs/issues, CC inbox, tool-failure triage inputs, and any prerequisite reads needed for doc staleness or carry verification. Synthesize only after the batch returns.

In CC, this means batching the post-sync read-only health-check fan-out (steps 4, 5, 5b, 5c, 5d, 5e, 5f, 5g, 5h, 5i, 5j, 5k, 6, 7, 8, 9, 9b, 9c) as several parallel batches grouped by exit-code safety. Scripts that exit non-zero on findings (`proxmox-health-check.sh` exit 2 on ALERT, `billing-check.py --auth-probe` exit 2 on 401, `security-triage.py --quiet` may print ACTION but exits 0, `secrets-env-lint --quiet` exits 1 on findings) MUST run alone or be bundled only with other exit-non-zero scripts — never with read-safe siblings. Per the cascade-cancel learned-rule, exit-non-zero in one parallel-block sibling cancels the others.

## MANDATORY: Visible tool-result panes are current state

If VS Code opens a terminal-result pane, generated-output pane, or similar result surface while `/start-session` is running, treat that pane as the current state of the just-finished step.

Do not keep waiting on the global `Processing` spinner if the visible pane already shows terminal output, an `exit`, or enough information to act. Inspect the visible result first, then either:

- synthesize and continue immediately if the step is clearly complete, or
- run one narrow underlying status check if the pane is ambiguous.

Do not launch duplicate watcher loops or restate stale progress after a visible result pane opens. The pane is a state transition, not just UI noise.

## Watchdog contract (cc#168)

The `~/.claude/hooks/start-session-watchdog.sh` hook mechanically enforces the "After sync, fan out immediately" rule. It tracks a per-session phase machine via `~/.local/state/claude-hooks/start-session/<session>.phase`:

- `UserPromptSubmit` matches `/start-session` (or the `<command-name>start-session</command-name>` tag form) → `phase=start`
- `PostToolUse` on Bash invoking `cross-project-pull.sh` → `phase=awaiting_fanout`
- `PostToolUse` on any subsequent tool call → clears the trigger
- `Stop` while `phase=awaiting_fanout` → emits a stderr warning naming the missing batch

The watchdog warns on the strict failure mode "sync ran, then zero post-sync tools before turn ended". Single-tool fan-out (`Read` followed by Stop) does not trigger the warning by design — it indicates partial fan-out, not the empty-fan-out failure mode the watchdog is scoped to. False-positive cost is low and the hook is silent when the rule is honored.

If `cross-project-pull.sh` is renamed or the sync command structure changes, update the matcher in `~/.claude/hooks/start-session-watchdog.sh` accordingly. Tests at `~/scripts/infra/test/start-session-watchdog-test.sh`.
