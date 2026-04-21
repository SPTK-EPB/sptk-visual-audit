---
description: "End a session by evaluating the session, running the end-session validator, and then completing the end-session workflow."
name: "end-session"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/end-session.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
We will continue in a new session. Execute session evaluation and end steps:

## Self-improvement evaluation

Before running the end-session workflow, evaluate this session for improvements:

1. **Friction points** — Did anything fail, require retries, or take longer than it should? Could a hook, script, or rule have prevented it?
2. **Skill gaps** — Did you have to look something up, guess at an API, or work without a relevant skill loaded? Should a skill be created or updated?
3. **Rule contradictions** — Did any rule or instruction conflict with what we actually did? Flag for cleanup.
4. **Patterns worth capturing** — Did we establish an approach that should be reusable? Note for skill promotion or shared learnings.
5. **Tooling gaps** — Did you work around a missing MCP tool, missing script, or manual step that could be automated?

IMPORTANT: Add everything, even minor items, as tasks for a future session. Don't filter — small improvements compound.

## Evaluation → Task extraction

After generating the evaluation, extract a numbered checklist of ALL actionable items from it — every friction point fix, skill update, pattern to capture, and MCP gap. Then when writing the session summary, cross-reference this checklist against the carried items list. Every extracted item must appear either as a carried task or with an explicit reason it was excluded. Present this cross-reference to the user before finalizing.

## MANDATORY: Run end-session validator before committing

After completing the session workflow but BEFORE committing, run:

```bash
bash ~/.claude/hooks/session-end-validator.sh
```

Present the full output to the user. If there are BLOCKERS, you MUST fix every blocker before committing. Do not skip, defer, or work around them. The validator checks for zombie items, unprocessed staging, stale MEMORY.md, day-of-week errors, and uncommitted repos.

## End session

Execute the end-session workflow.
