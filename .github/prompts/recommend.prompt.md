---
description: "Ask for a recommendation on what to work on or how to proceed."
name: "recommend"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/recommend.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Make a concrete recommendation. Commit to a position — don't ask scoping questions back. Present:

1. **Recommended path** — one sentence + 2-3 bullet rationale
2. **Top alternative** — one sentence + the key tradeoff against the recommendation
3. **What to verify before committing** — only if there's genuine uncertainty worth flagging

Read relevant docs/code if needed to form the position. Reserve scoping questions for cases where intent could go in materially different directions; otherwise pick a defensible default and let the user redirect.
