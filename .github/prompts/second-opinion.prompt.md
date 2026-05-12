---
description: "Mirrored from ~/.claude/commands/second-opinion.md"
name: "second-opinion"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/second-opinion.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Dispatch a second Opus general-purpose agent as an adversarial reviewer for the most recent plan, recommendation, or design proposal in this conversation. Then engage critically with its findings — do not silently accept all feedback.

## Dispatch protocol

1. **Identify the target.** What is the most recent plan/recommendation in conversation? If ambiguous (multiple candidates in scroll), name the candidates and ask. If clear, proceed.

2. **Gather foundational context.** Before dispatch, locate project-specific foundational docs that the reviewer should consult (apply session 707's N=1 watch: pre-loaded reviewers produce sharper critique). Standard paths to check in the active project workspace:
   - `docs/strategy.md` (or `docs/product-plan.md`, `docs/development-plan.md`)
   - `docs/architecture-principles.md`
   - `docs/threat-model.md`
   - `memory/decisions.md` (recorded architectural decisions)
   - Any prep-research input doc explicitly named in the conversation (e.g., `memory/research/<topic>-<date>.md`)

   For CC-scope work (no project workspace), substitute: `~/docs/projects.md`, `~/docs/infrastructure.md`, `~/docs/runbooks.md`, relevant `~/.claude/rules/learned-rules.md` sections.

3. **Dispatch one Agent tool call**, foreground (orchestrator waits for findings before continuing):
   - `subagent_type: "general-purpose"`
   - `model: "opus"`
   - Prompt structure (adapt to context):
     ```
     You are an adversarial senior architect reviewing a plan/recommendation from another agent. Your job is to find blind spots, miscalibrated assumptions, and load-bearing gaps. Do not be polite if the plan is wrong; do not invent disagreement if the plan is right.

     ## What the orchestrator proposed
     [verbatim or close paraphrase of the recommendations + rationale]

     ## Foundational context to consult before critiquing
     - <path 1>: <one-line purpose>
     - <path 2>: ...
     [include 2-5 most relevant doc paths; do not flood]

     ## Your task
     Read the foundational docs first. Then critique the proposal. Structure your response:
     1. **Directional agreement** — what's right and why (one short paragraph max)
     2. **Load-bearing disagreements** — specific claims you think are wrong, with rationale grounded in the foundational docs or external evidence. Cite specifics.
     3. **Blind spots** — what the proposal didn't address but should have
     4. **Alternative recommendations** — one concrete alternative per major disagreement

     Be specific. "This might not scale" is not useful; "This breaks when N > 10k because <mechanism>" is. Cite the foundational docs by name when relevant.
     ```

4. **Engage critically with findings.** After the reviewer returns, present to the user:
   - Reviewer's directional agreement (one line)
   - Reviewer's disagreements — for each, my stance: **accept** / **partially accept** / **reject** + one-line reason. Do not blanket-accept; the reviewer can be wrong, especially on project-specific tradeoffs (session 707's reviewer was directionally right but miscalibrated because it lacked the project's existing-architecture context).
   - Reviewer's blind spots — flag which are real
   - **Updated proposal** OR **confirmation original holds** — be explicit about which

5. **Optional args** (when the user provides them after the command):
   - "focus on Q5" — narrow the reviewer's scope to a specific question/section
   - "be brutal" / "be balanced" — tune the framing intensity (default: adversarial-but-fair)
   - "compare with X" — ask the reviewer to specifically compare against an alternative the orchestrator didn't consider

## When the reviewer is likely to add value

- Architecture decisions where the orchestrator committed to a position fast
- Security-sensitive work (auth, isolation, signing pipelines)
- New project initiation or major refactor scope
- Multi-tier or multi-tenant designs
- Anything the user has flagged as high-stakes

## When to skip this command

- Mechanical execution (no judgment calls in the plan)
- Already-validated patterns (e.g., reusing a PEV template the user has approved before)
- Trivial scope (one-line fix, single-skill rotation)
- Time-sensitive incident response where reviewer round-trip costs more than it saves
