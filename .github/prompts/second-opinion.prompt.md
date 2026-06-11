---
description: "Mirrored from ~/.claude/commands/second-opinion.md"
name: "second-opinion"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/second-opinion.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Dispatch a second adversarial reviewer for the most recent plan, recommendation, or design proposal in this conversation — either an Opus general-purpose sub-agent (Claude-family, has tools so it can read foundational docs itself) or, to catch same-family blind spots, a cross-family OpenRouter reviewer (`second-opinion-or.py`, non-Anthropic). They compose; pick per the path-selection guidance in step 3. **Scale the review to the decision's stakes — classify the tier (see "Stakes tier" below) and dispatch with `--stakes`, which sets reviewer count + model strength together.** Then engage critically with its findings — do not silently accept all feedback.

## Dispatch protocol

1. **Identify the target.** What is the most recent plan/recommendation in conversation? If ambiguous (multiple candidates in scroll), name the candidates and ask. If clear, proceed.

2. **Gather foundational context.** Before dispatch, locate project-specific foundational docs that the reviewer should consult (apply session 707's N=1 watch: pre-loaded reviewers produce sharper critique). Standard paths to check in the active project workspace:
   - `docs/strategy.md` (or `docs/product-plan.md`, `docs/development-plan.md`)
   - `docs/architecture-principles.md`
   - `docs/threat-model.md`
   - `memory/decisions.md` (recorded architectural decisions)
   - Any prep-research input doc explicitly named in the conversation (e.g., `memory/research/<topic>-<date>.md`)

   For CC-scope work (no project workspace), substitute: `~/docs/projects.md`, `~/docs/infrastructure.md`, `~/docs/runbooks.md`, relevant `~/.claude/rules/learned-rules.md` sections.

3. **Select the reviewer model and dispatch.** Behavior depends on harness:

   **Claude Code (Agent tool available):** Dispatch one Agent tool call, foreground (orchestrator waits for findings before continuing):
   - `subagent_type: "general-purpose"`
   - `model: "opus"` (Opus 4.7 / 1M default; switch to Sonnet only if cost-bound)
   - Use the prompt template below.

   **Copilot Chat (no Agent tool):** Present a model picker to the user. As of 2026-05, qualifying top-tier reasoning models exposed in the Copilot model picker include:
   - **GPT-5** (OpenAI)
   - **Claude Opus 4.7** (Anthropic)
   - **Gemini 2.5 Pro** (Google)

   Recommend a model from a **different vendor** than the conversation's current model — same-lineage reviewers share blind spots. Then present the prompt template below as a copy-paste fenced block, preceded by: "Switch your Copilot model picker to <chosen>, then send the block below as your next message." After the review lands, remind the user to switch back to their preferred model.

   **Cross-family via OpenRouter (model diversity — catches same-family blind spots):** When the value you want is a *genuinely different model family* (not just a separate context window), run the OpenRouter reviewer. The Opus sub-agent shares Claude's training priors; an OpenRouter reviewer from openai / deepseek / qwen / x-ai does not. Trade-off: the script is a stateless API call — it only sees what you pass it, so **inline the relevant foundational context into the plan text** (it can't read docs itself).
   - Write the proposal + the relevant foundational context to a temp file (e.g. `/tmp/so-plan.md`). **Do NOT inline live secrets/credentials** into the plan text — it's sent to a third-party endpoint.
   - **Classify the stakes tier FIRST (see "Stakes tier" below), then dispatch with `--stakes`** — that one flag sets reviewer COUNT + model strategy + tradeoff together so you can't half-set it (count and model-strength used to drift independently; that's the failure this closes):
     `python3 ~/scripts/integrations/second-opinion-or.py --stakes <routine|significant|high> --author-family anthropic --plan /tmp/so-plan.md --session <N> --workspace <ws>`
     (`--author-family` = whoever wrote the plan — `anthropic` when it's me — excluded from reviewers. Always pass `--session`/`--workspace` for the cost-log attribution.)
   - **State the tier + reason before dispatching**: `T<n> — <one-line reason>`.
   - `--dry-run` first to SEE which families/models/tradeoff a tier resolves to (no API call, no cost). `--json` for structured output. The output's top line `> reviewer model(s): …` shows the model actually used — sanity-check it isn't a stale generation.
   - Granular overrides (rare): `--panel-size N`, `--cost-quality-tradeoff N` (0–10), `--high-quality` (= tradeoff 0 + frontier allowlist). The tier is the default path; reach for these only to override.
   - **Pin exact reviewers (rare):** `--models <slug,slug,...>` names the precise reviewer slugs (one review per slug), bypassing stakes/panel auto-routing — for comparing a specific new model or recording a reproducible reviewer set. Each slug is validated against the live `/models` catalog (unknown slugs rejected); wins over `--stakes`/`--panel`. Every leg (panel or pinned) auto-falls-back to a bare direct call if the auto-router 404s on a constrained allowlist, and any degraded panel is surfaced loudly rather than running silently short-handed (cc#278).
   - The script supplies its own adversarial system prompt, so do NOT use the prompt template below for this path — just pass the proposal + inlined context as the `--plan` content.
   - Cost: ~$0.01–0.20 single, ~$0.03–0.10 panel — bills to the OpenRouter balance (the sanctioned third budget, separate from claude.ai / Copilot). Every run self-logs `{ts, workspace, session, path, reviewers, tokens, cost_usd, outcome}` to `memory/second-opinion-log.jsonl` (per-workspace, append-only) — capture is automatic; pass `--session`/`--workspace` for attribution. **At end-session, stamp the `outcome` field** of this session's line(s) — `accepted` | `partial` | `rejected`, or a count like `8acc-4rej` — since only the orchestrator knows whether the findings landed. This log is the cc#243 effectiveness-scorecard input: it quantifies the Kill-Switch "does `/second-opinion` earn its keep" question (cost spent vs. fixes that shipped).

   **Which path?** Opus sub-agent = best for project-specific reviews where the reviewer should read foundational docs itself (it has tools). OpenRouter = best when you want family-diversity or a multi-model panel and the relevant context fits in the plan text. **Strongly prefer the cross-family OpenRouter path when the load-bearing risk is the orchestrator's OWN family bias** — e.g. a not-invented-here adopt-vs-reject call, "we already do this better," or any judgment where an Opus reviewer would share my Claude training priors and thus the same blind spot. They compose — dispatch both for a genuinely high-stakes call.

   **Prompt template (used for the Agent + Copilot paths):**

   ```
   You are an adversarial senior architect reviewing a plan/recommendation from another agent. Think hard before responding. Your job is to find blind spots, miscalibrated assumptions, and load-bearing gaps. Do not be polite if the plan is wrong; do not invent disagreement if the plan is right.

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

## Stakes tier — classify FIRST (drives count + model strength)

Reviewer **count** and **model strength** both scale to the decision's stakes — a single `--stakes` input sets them together, so they can't drift independently (the "sometimes 1, sometimes 3" + "stale model on a big call" failures). Escalate to the highest tier whose trigger fires:

| Tier | Escalation trigger (ANY) | `--stakes` | Reviewers | Model |
|---|---|---|---|---|
| **T3 high** | irreversible / data-loss risk · modifies auth or security surface · touches prod infra/deploy · affects ≥2 products or the whole fleet · cross-repo contract change · launch-blocking | `high` | 3-family panel | frontier allowlist, best model |
| **T2 significant** | architecture/design choice · multi-touchpoint (≥3 files/components) · new-project or major-refactor scope · committed to a position fast without exploring alternatives | `significant` | 2-family panel | frontier allowlist, best model |
| **T1 routine** | reversible, single-component judgment call worth a sanity check | `routine` | 1 reviewer | family glob, cost-aware |

The frontier allowlist (`~/scripts/integrations/reviewer-models.json`) is what stops the auto-router from picking a stale model at T2/T3 — `cost_quality_tradeoff: 0` alone does NOT reliably select the newest model (priciest ≠ newest), so high-stakes tiers constrain to curated current frontier slugs.

## Proactively OFFER it (problem the agent forgets)

**The moment you commit to a T2 or T3 decision, offering `/second-opinion` in the same turn is mandatory** — one line tied to the trigger that fired: *"This is a T3 decision (touches prod deploy + auth); want a panel review before we commit?"* Don't wait to be asked. (A Stop-hook nudge is a backstop, not a substitute — the offer is yours to make.)

## When to skip

- Mechanical execution (no judgment calls in the plan)
- Already-validated patterns (e.g., reusing a PEV template the user has approved before)
- Trivial, reversible scope (one-line fix, single-skill rotation) — below T1
- Time-sensitive incident response where the reviewer round-trip costs more than it saves
