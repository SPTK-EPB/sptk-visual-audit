---
description: "Mirrored from ~/.claude/commands/worklog.md"
name: "worklog"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/worklog.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
---
description: Per-repo standup — features & bugs worked on / shipped in a time window or session range
argument-hint: [--since 7d|2w|YYYY-MM-DD] [--last-session|--sessions N|--session ID] [--type fix|feat] [--scope shipped] [--deep] [--no-why] [--json]
---

Produce a **standup overview of the features and bugs worked on / shipped** for the repo of the **current workspace**. Data comes from `~/scripts/infra/worklog-extract.sh` (workspace-adaptive: merged PRs + closed issues + conventional commits + session notes). You synthesize — the script only extracts.

## Step 1 — args or picker

Look at `$ARGUMENTS` (text typed after `/worklog`).

- **If `$ARGUMENTS` is non-empty** → skip the picker; use it verbatim as the script flags. Go to Step 3.
- **If `$ARGUMENTS` is empty** → present the picker (Step 2) so the user picks from a menu instead of typing flags.

## Step 2 — picker (empty args only)

Call **AskUserQuestion** with these two single-select questions, then map the answers to flags:

**Q1 — header `Range`, question "How far back?"**
| Option | → flag |
|---|---|
| `Since last session` *(Recommended)* | `--last-session` |
| `Today` | `--since today` |
| `Last 7 days` | `--since 7d` |
| `Last 2 weeks` | `--since 2w` |
| *(Other, free text)* | `--since <verbatim text>` |

**Q2 — header `Show`, question "What to include?"**
| Option | → flag |
|---|---|
| `Everything` *(Recommended)* | *(none)* |
| `Only what shipped` | `--scope shipped` |
| `Bugs fixed` | `--type fix` |
| `Features / enhancements` | `--type feat` |

Combine the two mapped flags into one flag string.

## Step 3 — run the extractor

```
bash ~/scripts/infra/worklog-extract.sh <flags>
```
Run it from the session's current directory (do **not** `cd` — the script keys off `$PWD` to detect the repo). The output is one JSON object.

- If the JSON has `"error"` (e.g. "not a git repo") → tell the user to run `/worklog` inside a project repo, or pass `--repo <name>`. Stop.
- If `$ARGUMENTS` contains `--json` → print the raw JSON in a fenced block and stop.

## Step 4 — synthesize the standup

Turn the JSON into a **tight standup** (not an essay). Rules:

**Dedup & categorize**
- A merged PR and its squash commit `(#NN)` are the **same item** — show it once, preferring the PR/issue (it has the label + link).
- Bug vs feature, in priority order: issue/PR **label** (`bug` → Fixed; `enhancement`/`feature` → Shipped) → **conventional-commit prefix** (`fix:` → Fixed, `feat:` → Shipped) → infer from the title.
- Drop pure bookkeeping (`chore:`/`docs:`/`test:`/`ci:`/`style:` commits, `end-session`/memory commits) from the headline lists — fold into the footer count.
- If `repo_is_cc` is `true`: the closed issues + `sessions[]` are the primary signal; **do not** list the chore/memory commits (they're session bookkeeping).

**Cause — the headline of this command.** For every item you show, add a one-line **cause** under it:
- 🐛 bug → the **root cause** (why it happened / what was wrong), not a restatement of the fix.
- ✨ feature → the **why** (what gap or need motivated it).
- Source: the item's `body` (issue/PR body, up to ~1200 chars — look for a `## Summary` / `## Cause` / `Root cause` / release-notes section). For a closed issue resolved by a listed PR, the issue body usually carries the cause and the PR carries the fix — read both.
- If `.filters.deep` is `true`, top items also carry `comments[]`. For a forensic bug the *real* root cause often lands in a follow-up comment (an analysis posted after filing), not the body — **prefer the root-cause comment over the body when one is present**. Without `--deep`, note that a body-only cause may be approximate for deep incidents.
- **Group shared causes.** When several items trace to **one** root cause (an incident fixed across N PRs/issues), state the cause **once** as a group heading and list the items under it — never repeat the same cause per line.
- **Never fabricate.** If `body` is `null` (item older than `.filters.why_limit`, so no body was fetched) or the body doesn't state a cause, write `cause: —` or `cause: not stated in issue` — do **not** guess. Widen with `--why-limit N` if many are null.

**Honor filters** (`.filters`): `type=fix` → show only Fixed; `type=feat` → only Shipped; `scope=shipped` → omit the "Worked on, not shipped" section. `changelog=true` → format as terse user-facing release notes grouped by ✨/🐛 instead of the standup layout.

**Honesty**: if `.warnings` is non-empty, print each as a one-line `> ⚠️ …` note under the header (degraded coverage — never present a clean conclusion over missing data).

**Output shape** (omit empty sections):

```
## <repo> — standup · <window.label>

### 🐛 Fixed (<n>)
- [#<num>](<url>) <short what was wrong / what the fix does> · <date>
  ↳ **cause:** <one-line root cause from body>

<When several items share ONE cause, use the grouped form instead of repeating it:>
- **<incident / theme>** — [#a](url) <slice> · [#b](url) <slice> · [#c](url) <slice>
  ↳ **cause:** <shared root cause, stated once>

### ✨ Shipped / features (<n>)
- [#<num>](<url>) <what shipped> · <date>
  ↳ **why:** <one-line motivation from body>

### 🔧 Worked on, not shipped
- <from sessions[] headers/teasers + issues closed as NOT_PLANNED / mentioning "OPEN", "blocked", "not merged">

### 📌 Notable
- <reverts[] and hotfixes, if any>

### 📎 Carry-forward
- <still-open items referenced in sessions this window — best-effort, only if clearly signalled>

_<N> PRs merged · <N> issues closed · <N> sessions · <N> other commits — <window.since>→<window.until>_
```

- Use markdown links (`[#123](url)`), never bare numbers.
- If a list would exceed ~15 items, group by theme with counts rather than dumping every row.
- If every count is 0: say "Nothing recorded in this window." and suggest widening the range.
