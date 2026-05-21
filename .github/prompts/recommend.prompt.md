---
description: "Ask for a recommendation on what to work on or how to proceed."
name: "recommend"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/recommend.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Make a concrete recommendation. Commit to a position — don't ask scoping questions back.

## Branch on session state

**If this is early in the session** (briefing just completed, no substantive work done yet, user is picking what to work on): recommend a **high-value GitHub issue** to pick up next.

- Query open issues across active SPTK-EPB repos via `gh search issues --owner SPTK-EPB --state open --sort updated --limit 30` (or use the per-issue lists already loaded from session-start). Prefer `agent-ready` and `quick-fix` labels for first-pick candidates; consider higher-leverage `enhancement` issues when no quick wins are open.
- Score by: unblocks other work (highest), fits this workspace's scope, ships in one session, recent activity (not stale), clear acceptance criteria. Avoid issues blocked on a sibling repo, ambiguous scope, or pending design review.
- Verify the candidate is still open and unowned (`gh issue view <num>`) — issue lists go stale within hours. For sibling-repo carries, cross-check live state per the "Verify sibling repo state via `gh`" learned-rule.

**If this is mid-session** (work in progress, user is asking how to proceed from current context): recommend the next concrete action based on the conversation's current state — what's been tried, what's blocked, what's the cheapest path forward.

## Output shape (both branches)

1. **Recommended path** — one sentence + 2-3 bullet rationale (for issues: include `<repo>#<num>` and one-line title)
2. **Top alternative** — one sentence + the key tradeoff against the recommendation
3. **What to verify before committing** — only if there's genuine uncertainty worth flagging

Read relevant docs/code/issues if needed to form the position. Reserve scoping questions for cases where intent could go in materially different directions; otherwise pick a defensible default and let the user redirect.
