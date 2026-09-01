---
description: "End a session by evaluating the session, running the end-session validator, and then completing the end-session workflow."
name: "end-session"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/end-session.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
We will continue in a new session. Execute session evaluation and end steps:

> **Invocation note:** If you arrived here by typing `/end-session` or by selecting an "End session" option, the Skill tool has already loaded this file. Do NOT execute end-session steps from memory shortcuts — invoke the Skill tool with `skill: "end-session"` so this file's contract drives the flow. The self-improvement evaluation below is the part most often skipped when run from memory.
>
> **Workspace divergence:** run `pwd` first. CC workspace (`$HOME`) follows `~/.claude/workflows/cc-session-workflow.md`; focused workspaces follow `~/.claude/workflows/session-workflow.md`. These are **not auto-injected** (they live outside `~/.claude/rules/` precisely so CC's checklist does not leak into focused sessions) — `Read` exactly the one matching `pwd`, never both — and read only the **section** you need (`grep -n '^## ' <file>` for anchors, then `Read` with `offset`/`limit`). The CC file is ~107KB; reading it whole re-pays most of the cost the split exists to remove. The sections below describe the shared self-improvement + validator contract; workspace-specific commit/push/sync/satellite-propagation steps live in those workflow files.

## Self-improvement evaluation

Before running the end-session workflow, evaluate this session for improvements:

1. **Friction points** — Did anything fail, require retries, or take longer than it should? Could a hook, script, or rule have prevented it?
2. **Skill gaps** — Did you have to look something up, guess at an API, or work without a relevant skill loaded? Should a skill be created or updated?
3. **Rule contradictions** — Did any rule or instruction conflict with what we actually did? Flag for cleanup.
4. **Patterns worth capturing** — Did we establish an approach that should be reusable? Note for skill promotion or shared learnings.
5. **Tooling gaps** — Did you work around a missing MCP tool, missing script, or manual step that could be automated?
6. **Command outliers** — Run `python3 ~/scripts/infra/session-cmd-metrics.py --report` and check whether THIS session's `/start-session` or `/end-session` exceeded p95 for duration_sec or tool_calls. If yes, identify which step bloated and propose a command/rule fix. Skip if within p50. The log is per-machine (`~/.local/state/claude-hooks/session-cmd-metrics.jsonl`); if the report says "no metrics log yet", skip silently — focused workspaces on satellites bootstrap their own log over the first few sessions.
7. **Stale-option post-mortem (cc#326).** Did a stale / superseded / already-solved / gated work option surface this session — either presented in the briefing OR caught by the operator / by `verify-work-options.sh`? If yes, for each: (a) which EXISTING rule/check *should* have caught it? (b) why didn't it fire — `not-recalled` (prose rule existed, wasn't applied), `wrong-surface` (governed surface didn't cover this class), or `genuinely-unmechanizable` (semantic/cross-repo, e.g. the #561 built-elsewhere class)? (c) **If the answer is `not-recalled` or a mechanizable `wrong-surface`, mechanize it — filing a new prose rule (or a sub-note on an existing one) for a mechanizable failure is the root anti-pattern cc#326 exists to break.** Append one line per stale option to the CC-home stale-option log by running `bash ~/scripts/infra/cchome-log-append.sh stale-option-log.jsonl '<json>'` — the helper appends AND scoped-commits+pushes just that log line from ANY workspace, so a focused/satellite end-session never leaves uncommitted CC-home dirt that makes `cc-self-pull` skip `command-center` (cc#340; do NOT `>> ~/memory/workspace/...` directly). The `<json>` shape is: `{"session":<N>,"date":"<YYYY-MM-DD>","option":"<ref-or-text>","existing_rule":"<name>","why_missed":"not-recalled|wrong-surface|genuinely-unmechanizable","fix_kind":"mechanized|mechanizable-but-prose|genuinely-unmechanizable|none"}`. If NO stale option surfaced, append nothing (silence = clean). This question measures *effectiveness* (recurrence → right-kind-of-fix), not rule creation; the `mechanizable-but-prose` entries are swept by `stale-option-debt-check.sh` until a script closes them.

8. **Gate-verdict labelling (cc#495).** Run `bash ~/scripts/infra/gate-verdict-label.sh pending` — it lists this session's pretool-safety-gate fires as distinct `(check, project)` groups not yet labelled (silent = clean, skip). For each line, judge from your own session context whether the fire was correct and record it: `bash ~/scripts/infra/gate-verdict-label.sh record --check <id> --verdict tp|fp|cbn --project <project> --fires <n> --note "<short reason>"`. Verdicts: `tp` = correct fire; `fp` = the check flagged an invocation it should not have; `cbn` = correct-but-noisy — the fire is correct behaviour for the check's contract but the invocation was benign (the meta-FP class: checks 9/21/22 matching their own patterns inside quoted payloads / doc heredocs — cc#474 established this is CORRECT for a security check, so it must NOT be labelled `fp`). ⚠️ NEVER put command text or credentials in `--note` — the verdict log inherits the gate's no-command-text property. Include a one-line `gate verdicts: N labelled (X tp / Y fp / Z cbn)` in the recap so the operator can veto. These labels are the input to `gate-verdict-label.sh rates`, the per-check FP rate cc#474 phase 2b gates ADVISORY_ENABLED widening on.

IMPORTANT — **the default disposition of an observation is DISCARD** (cc#578, 2026-09-01). This inverts the previous "capture every observation, even minor — small improvements compound" instruction, which was measured to accumulate rather than compound: 60 of CC's 121 open issues had never been updated since filing, and 72% of what CC actually *closed* in August was instrument work. The burden of justification now sits on FILING, not on excluding.

Apply, in order:

1. **Two-minute rule** — trivially fixable in <2 min (rule update, doc fix, issue comment, one-line script tweak)? Do it now. NOT carried forward — DONE.
2. **Otherwise DISCARD by default.** An observation about our own instruments is discarded unless it clears the filing bar below. Discarding is the normal outcome and needs no justification, no carry entry, and no "explicit reason it was excluded".
3. **Filing bar** — file a GitHub issue ONLY if the observation is (a) a correctness or security defect in something currently relied upon, (b) blocking a named piece of product work, or (c) operator-directed. "Would be nice", "hardening", "non-blocking", "polish", and "for completeness" are DISCARD, not file.
4. **Carry list** is for genuinely-deferred work with a named next action — never a parking lot for observations.

If an observation feels too valuable to discard but does not clear the filing bar, it is a **watch** (`memory/watches.md`), not an issue. Recurrence promotes it; silence retires it.

## Evaluation → Task extraction

After generating the evaluation, extract a numbered checklist of items that clear the **filing bar** above — not "ALL actionable items". Items below the bar are discarded silently and do NOT need to appear anywhere.

⚠️ **The old contract here — "every extracted item must appear either as a carried task or with an explicit reason it was excluded" — is REVOKED (cc#578).** It made discarding more expensive than filing, and was the pressure valve that routed observations into the backlog. Requiring a written justification per discard is exactly the friction that made filing the path of least resistance.

When writing the session summary, report only: the count of observations made, the count filed (with refs), and the count discarded. A high discard ratio is a HEALTHY signal, not a gap to explain.

## MANDATORY: Run end-session validator before committing

After completing the session workflow but BEFORE committing, run:

```bash
bash ~/.claude/hooks/session-end-validator.sh
```

Present the full output to the user. If there are BLOCKERS, you MUST fix every blocker before committing. Do not skip, defer, or work around them. The validator checks for zombie items, unprocessed staging, stale MEMORY.md, day-of-week errors, and uncommitted repos.

## Tier selection (cc#221)

`/end-session` defaults to **full**. Two tiers available for lighter wrap-ups:

- `/end-session quick` — mid-day intermediate save; runs the load-bearing subset (process staging, write summary, validator, commit + push). Skips cross-project collect, satellite sync, skill audits, QMD re-index, registry update, delegation log.
- `/end-session super-quick` — pivoting tasks; runs validator + commit + push only. Skips everything else including the self-improvement evaluation.

Honor the tier argument when present. See the "End session — tier selection" section of `~/.claude/workflows/cc-session-workflow.md` (CC) or `~/.claude/workflows/session-workflow.md` (focused) for the per-tier step list — read the one matching `pwd`, on demand.

## End session

Execute the end-session workflow for the selected tier.
