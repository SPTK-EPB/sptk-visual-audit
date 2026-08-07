---
description: "Mirrored from ~/.claude/commands/news.md"
name: "news"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/news.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Review collected news depth-first and capture keepers durably. This is the REVIEW half of the collect/review split (cc#419) — collection runs automatically + cheap in start-session (`feed-monitor.py check --collect` → `news-archive.jsonl`); `/news` reads that archive on demand with all the context budget it wants.

CC-scope only. Run this in its own session (or when the start-session one-liner flags a backlog worth reviewing).

## 1. Ask the lookback window

Use `AskUserQuestion` (header "Lookback") with options: **24h**, **7d**, **30d**, and a fourth path for a custom window — instruct the user that "Other" accepts a free-text lookback like `72h`, `3w`, `6mo`, or a bare number = days. Default-select 7d. Do NOT proceed on assumption — the window changes how much HN backfill is fetched.

## 2. Read the archive

Run (venv python):

```bash
~/.venv/bin/python3 ~/scripts/integrations/feed-monitor.py review --since <window> --hn-backfill --json
```

- `--since <window>` — the value from step 1 (`24h`/`7d`/`30d`/`3w`/`6mo`/`Nd`). Omit `--since` to read since the last `--mark-reviewed` watermark.
- `--hn-backfill` — adds an HN Algolia date-range fetch across the configured HN search terms, so a deep lookback works even before the archive has that much history (free public HN API, no auth). Skip it for a quick 24h/7d pass over just the archive if you want it fast.
- `--all` — include the unflagged "other" bucket (HN front-page noise). Default is keyword/3D-flagged only — keep the default unless the user asks for the long tail.

The JSON gives `{window, count, records[], hn_errors}`. If `hn_errors` is non-empty, say so and treat the pass as **DEGRADED** — do not conclude "nothing relevant" off partial coverage (degraded-coverage-honesty rule).

## 3. Triage every item through the product lens (reuse the weekly-digest 3-tier lens)

**Never dismiss an item solely because "we're past this version" or "we don't use this tool."** For each item, answer the two mandatory questions (weekly-digest deep-eval rule):

1. Does this reveal a pattern/technique/approach we could adopt to improve our setup?
2. Is it a cheaper/better alternative to something we currently use?

Then classify each keeper:

- **build-candidate** — prior art that should inform a product we build (lokalmeny / ADM / ReQuest / Smie / UDM). File a GitHub issue on the owning repo.
- **adopt-watch** — a tool/pattern/harness change worth trying (a Claude Code / VS Code / Cloudflare feature, a new library, an agent-workflow idea).
- **stack-fit** — a cheaper/better alternative to something in our stack.
- **genuinely-FYI** — industry noise, no action. One line, then drop.

"Requires no CC action this session" is NOT "not worth acting on." Surface build/adopt/stack items as options; never bury the section under one dismissive phrase.

## 4. Capture keepers durably (the whole point — nothing silently dropped)

Route each keeper to exactly one durable home:

- **Strong build-candidate** → `gh issue create` on the owning repo (per the cross-repo-issues rules), THEN note it as done in this review.
- **Genuine build/adopt keeper for the batch backlog** → append to the standing adopt-watch backlog issue **cc#420** (`gh issue edit 420 --repo SPTK-EPB/command-center` or a comment; add title · class · one-line why · source link · date). It re-surfaces via the session-start issues overview and is batch-worked at ~5 items or the 14-day meta-eval.
- **Near-term "act soon" item** → the transient follow-up queue, which re-fires at EVERY session start until acked:

  ```bash
  ~/.venv/bin/python3 ~/scripts/integrations/feed-monitor.py followup add "<url>" --class <build-candidate|adopt-watch|stack-fit> --title "<short>" --note "<why>"
  ```

  (`followup list` / `followup ack <hash|all>` to manage; it surfaces via `feed-monitor.py alerts` in step 3/2c of every start.)

Pick ONE home per keeper — don't double-file. Use cc#420 for backlog-class keepers, `followup` for act-soon, a real issue for a concrete build task.

## 5. Mark reviewed-through

After triage + capture, advance the watermark so the next default `/news` pass only shows new items:

```bash
~/.venv/bin/python3 ~/scripts/integrations/feed-monitor.py review --mark-reviewed
```

## 6. Report

Summarize: window reviewed · N items · the keepers by class with their durable home (issue #, cc#420 append, or followup hash) · anything filed. If the pass was DEGRADED (HN errors / feed errors), say so and name what coverage was missing.

## Notes

- HARD local-3D hits are a SEPARATE always-on channel (`feed-monitor.py alerts`, cc#322) — they surface at every start regardless of `/news`. Don't duplicate them here.
- `/news` reuses the weekly-digest classification lens but is NOT the weekly digest: it does news only, off the archive, lookback-configurable. `weekly-digest` remains the heavy whole-stack weekly ritual (billing + changelogs + security + trend-scouting + model-watch).
