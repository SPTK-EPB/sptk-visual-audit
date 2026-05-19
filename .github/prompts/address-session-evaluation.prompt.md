---
description: "Address actionable items from the session evaluation screenshot and propose a fix for each one."
name: "address-session-evaluation"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/address-session-evaluation.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Address actionable items from the session evaluation (either an attached screenshot OR the most recent `/end-session` evaluation in scroll).

For each item:

1. Classify: **two-minute fix** (apply now) vs **deferred** (file as GitHub issue OR add to carry list, with rationale)
2. For two-minute fixes: propose the exact change inline, apply on user approval
3. For deferred items: propose issue title + label + target repo, OR which carry list it belongs in

Present items one at a time. Don't batch — each needs explicit approval before moving on. Cross-reference the two-minute-rule wording in `/end-session` for consistency.
