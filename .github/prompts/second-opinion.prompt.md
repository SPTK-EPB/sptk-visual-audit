---
description: "Mirrored from ~/.claude/commands/second-opinion.md"
name: "second-opinion"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/second-opinion.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Dispatch a second adversarial reviewer for the most recent plan, recommendation, or design proposal in this conversation — either an Opus general-purpose sub-agent (Claude-family, has tools so it can read foundational docs itself) or, to catch same-family blind spots, a cross-family OpenRouter reviewer (`second-opinion-or.py`, non-Anthropic). They compose; pick per the path-selection guidance in step 3. **Scale the review to the decision's stakes — classify the tier (see "Stakes tier" below) and dispatch with `--stakes`, which sets reviewer count + model strength together.** Then engage critically with its findings — do not silently accept all feedback.

## Dispatch protocol

1. **Identify the target — and which of two INDEPENDENT gates it is.** There are two review targets, and clearing one NEVER clears the other (they catch different failure classes):
   - **Design gate** — a plan / recommendation / architecture proposal, reviewed BEFORE building. Catches *wrong approach*: missing failure mode, wrong architecture, the fallback that can't fire.
   - **Implementation gate** — a completed diff / PR about to merge, reviewed AFTER building. Catches *right approach built wrong*: a guard placed one layer too late, the wrong lever pulled, an ambient side-effect going live, an off-by-one, an untested branch, the diff quietly doing something the plan never said.

   A prior design review is NOT a reason to skip the implementation review (operator directive 2026-07-12; T3-panel-confirmed). If ambiguous which target (multiple candidates in scroll), name them and ask; if clear, proceed. For the implementation gate use the **implementation-review prompt** (below), not the design template.

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
   - **Untrusted content is auto-hardened (cc#297 #2):** the plan text is treated as quoted DATA, never instructions — it's wrapped in a data-fence and known model-control tokens / control chars are defanged, and the system prompt tells the reviewer to ignore any embedded "ignore previous instructions" payloads (so you can safely pass a raw diff / PR body / commit message). Inspect the exact sanitized+fenced prompt that would be sent with `--show-prompt` (no API call).
   - Granular overrides (rare): `--panel-size N`, `--cost-quality-tradeoff N` (0–10), `--high-quality` (= tradeoff 0 + frontier allowlist). The tier is the default path; reach for these only to override.
   - **Pin exact reviewers (rare):** `--models <slug,slug,...>` names the precise reviewer slugs (one review per slug), bypassing stakes/panel auto-routing — for comparing a specific new model or recording a reproducible reviewer set. Each slug is validated against the live `/models` catalog (unknown slugs rejected); wins over `--stakes`/`--panel`. Every leg (panel or pinned) auto-falls-back to a bare direct call if the auto-router 404s on a constrained allowlist, and any degraded panel is surfaced loudly rather than running silently short-handed (cc#278).
   - The script supplies its own adversarial system prompt, so do NOT use the prompt template below for this path — just pass the proposal + inlined context as the `--plan` content.
   - **PR IMPLEMENTATION reviews AUTO-INJECT the linked-issue REQUIREMENT (cc#386).** When you pass `--pr <OWNER/REPO#N> --target impl`, the dispatcher resolves the PR's closing-linked issue (`closingIssuesReferences`) and prepends a `## What this was asked to do` section — the issue body + up to 3 recent non-bot comments, each attributed with author/association/timestamp — into a SEPARATE requirement-fence, and tells the reviewer to verify the diff against the ASK *and* flag anything the diff does that the issue didn't ask for (the "right-approach-built-wrong" class is only decidable against the requirement). It is UNTRUSTED third-party text (sanitized + fenced like the diff) and explicitly NOT treated as authority — the reviewer weighs it from the timestamps. In-memory only (never rewrites your `--plan`); fails OPEN (a gh error → `intent: unavailable`, the review still runs). Override with `--intent-ref <OWNER/REPO#N>` (also enables the check on a design review with no `--pr`) or disable with `--no-intent`. Inspect the resolved section with `--show-prompt`.
   - **PR IMPLEMENTATION reviews AUTO-RECORD the attestation (cc#342) — pass `--pr <OWNER/REPO#N> --target impl`.** When the target is a PR's *implementation* gate (a diff/PR about to merge), add `--pr <OWNER/REPO#N> --target impl` to the invocation. The script then records a SHA-keyed impl attestation to the central store — **deriving the PR's live head SHA itself** (no `--head-sha` needed; pass it only to pin a specific non-current head) — which **clears the focused-side panel gate** (`check-pr-panel-attestation.sh`) at that repo's next session-start **without a manual `--record`**. This closes the loop so a panel run via this CC flow leaves no lingering `PANEL-PENDING`. NB: the **Opus sub-agent path does NOT shell out to the script, so it does NOT auto-record — and does NOT auto-inject the linked-issue intent (cc#386) either** — for a PR impl gate prefer this OpenRouter path (which is also the cross-family impl-review canonical path); if the Opus path is genuinely needed, (a) record afterward via `bash ~/scripts/infra/check-pr-panel-attestation.sh --record <N> --target impl` **from the focused workspace's cwd**, and (b) resolve the requirement yourself — the Opus reviewer has tools, so `gh pr view <N> --json closingIssuesReferences` then `gh issue view <n> --json body,comments` and inline the issue's ask (labeled "requirement — verify the diff satisfies it, may be stale/reframed") into the packet, so the reviewer verifies the claim, not just the diff.
   - **Set the Bash tool call's `timeout` to ≥300s (T2) / ≥590s (T3 panel + large plan)** — the Bash default is 2 min, and a 3-family panel over a 60KB+ plan routinely exceeds it (CTR 2026-07-01: a `--stakes high` run was killed at the 2m default, exit 143; CTR session 294 pre-empted with 590s and the panel took several minutes). A killed run wastes the partial API spend.
   - Cost: ~$0.01–0.20 single, ~$0.03–0.10 panel for a small plan — but cost scales with plan SIZE, and a T3 impl panel that inlines a large diff is an order of magnitude more: a 99KB packet across 3 frontier models measured **$0.81** (dugnad-agent PR #255, 2026-07-25). Budget accordingly when the packet inlines whole source files rather than hunks — bills to the OpenRouter balance (the sanctioned third budget, separate from claude.ai / Copilot). Every run self-logs `{ts, workspace, session, path, reviewers, tokens, cost_usd, outcome}` to `memory/second-opinion-log.jsonl` (per-workspace, append-only) — capture is automatic; pass `--session`/`--workspace` for attribution. **At end-session, stamp the `outcome` field** of this session's line(s) — `accepted` | `partial` | `rejected`, or a count like `8acc-4rej` — since only the orchestrator knows whether the findings landed. This log is the cc#243 effectiveness-scorecard input: it quantifies the Kill-Switch "does `/second-opinion` earn its keep" question (cost spent vs. fixes that shipped).

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

   **Implementation-review prompt (use this when the target is a completed diff/PR — NOT the design template above).** The impl gate reviews the ACTUAL CODE, risk-scoped. For the OpenRouter path, inline the diff (or just the risky hunks for a large change) into the plan text.

   ```
   You are an adversarial senior engineer reviewing a COMPLETED code change (a diff/PR) about to merge. The design may already have been reviewed — that does NOT clear this gate. Your job is to find implementation defects: right-approach-built-wrong. Think hard.

   ## The change
   [inline the diff — or the security/state/concurrency/fallback/error/API/persistence hunks for a large diff — plus a one-paragraph summary of what it's supposed to do + the design it implements]

   ## Review in two passes
   1. Risk hunks (primary): for each hunk touching security/auth, persisted state/data, concurrency/ordering, a fallback/retry/recovery path, error handling, an external API/wire contract, or money — is it correct? Look specifically for: a guard placed AFTER the thing it guards; the wrong lever pulled (a proxy-injected header used as auth; a timestamp cursor where a monotonic sequence is needed); an ambient side-effect going live; an off-by-one; a fail-OPEN where fail-closed is required; an untested branch; a partial/non-atomic mutation.
   2. Holistic (secondary, compact): does the diff faithfully implement the design? What does it DO that the design/PR-description did NOT mention? Integration effects on callers/siblings not in the diff?

   Structure: (a) blocking defects — each with exact file:line + the failure input→wrong output; (b) non-blocking risks; (c) faithfulness-to-design deviations; (d) what's untested. Be specific — "breaks when <input> because <mechanism>", not "might have bugs". A clean CI is NOT evidence of correctness.
   ```

   **Large / heterogeneous diffs:** do NOT dump the whole diff on one reviewer — it exceeds context and spends attention on generated/vendor noise. Scope to the risk hunks above + a compact holistic pass; for a genuinely large change, chunk by subsystem with a final integration pass, or split the PR.

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

### Diff-size floor — code-change targets only (cc#297)

When the review target is a concrete code change (a branch / PR / diff), run the diff-size classifier to get a recommended floor, then take the **higher** of it and your stakes judgment from the table above:

```bash
python3 ~/scripts/infra/review-tier-classify.py --git-range <base>..<head> [--stakes <your-judgment>]
```

It prints `--stakes <routine|significant|high>` from `effective_tier = max(diff_tier, stakes_tier, security_floor)`: diff size sets a **minimum**, your stakes judgment overrides **upward only** (never down), and security-sensitive paths (auth / secrets / crypto / CI / deploy / migrations / manifests) force `high` regardless of size. Pass the printed value as `--stakes`. The cheap reviewer lane is implied only when it returns `routine` (trivial diff + routine stakes + no security paths).

Effect: a 12-line docs/test edit becomes a 1-reviewer `routine` instead of a 3-family panel, while a 5-line auth change still forces `high`. Path patterns are per-repo-tunable in the classifier (don't trust the defaults blindly on a new repo). **When the target is a PLAN / DESIGN with no diff (e.g. an architecture recommendation), skip the classifier** — your stakes judgment from the table stands alone; the floor only applies to code changes.

## Proactively OFFER it (problem the agent forgets)

**The moment you commit to a T2 or T3 decision, offering `/second-opinion` in the same turn is mandatory** — one line tied to the trigger that fired: *"This is a T3 decision (touches prod deploy + auth); want a panel review before we commit?"* Don't wait to be asked. (A Stop-hook nudge is a backstop, not a substitute — the offer is yours to make.)

**Two more mandatory offer surfaces (the implementation gate):**
- **After you finish coding a design that got a design-review** — that is the trigger for the IMPLEMENTATION review, before merge. Route it **cross-family from the design's reviewer** (a same-family impl review inherits the design review's blind spots); at minimum one impl reviewer that was not the design's primary reviewer, and a different family from the author where possible.
- **Presenting any PR as merge-ready** — attach a one-line `2nd-opinion: RECOMMEND-T<n> | SKIP` disposition that NAMES a concrete risk reason ("modifies cache-eviction," "new exception in the auth path"), not a bare flag. A RECOMMEND an agent can silently ignore is the loophole in a new coat: a product-source PR resolves to review-ran · named-semantic-exemption · explicit-operator-waiver — never silent-skip. RECOMMEND is the DEFAULT for product-source diffs; SKIP is the justified exception.

**Before dispatching an impl review, pass your own rigorous self-review + tests first** — the reviewer protects against residual blind spots, not negligence. When findings return, adjudicate each explicitly (accept / reject-with-reason / defer); never blanket-accept.

## When to skip — a SEMANTIC exemption, not a file-type or review-history one

SKIP is the JUSTIFIED EXCEPTION, not the default. For any change that ships **product source**, the review is the default — the operator's lived experience (T3-panel-acknowledged) is that a review almost always surfaces something on a non-trivial diff. Two hard rules first:

- **Prior design review is NEVER a skip reason.** The design gate and the implementation gate are independent (step 1). "We already panel-reviewed the design" does not clear the PR. Delete this from your reasoning — a faithful implementation of a subtly-wrong detail is exactly the class the impl gate exists to catch. A prior design review + a faithful impl LOWERS the *tier* (a cheap design-fidelity pass can step T3→T2); it does NOT authorize a skip.
- **File type is NOT a reliable skip signal.** Config can change auth/deploy/billing/feature-flags/resource-limits; lockfiles + dependency manifests are supply-chain changes; renames break reflection/serialization/public-API/string-reference/dynamic-import; a one-line runtime constant can outrank 200 lines of boilerplate. Treat config / lockfile / migration / generated-file / rename diffs as *classify*, never auto-skip.

SKIP a change ONLY when ALL of these hold (the semantic exemption): no runtime/deploy/dependency/generated-output effect · no public-contract or persisted-data effect · no security/data/money/concurrency/fallback path · mechanically verifiable · below a small line threshold. **The stakes/security floor overrides every SKIP** — a security-sensitive path forces a review regardless of size.

Genuinely skippable without a review: pure docs/memory prose · a single-skill rotation · mechanical execution with no judgment call · a time-sensitive incident where the round-trip costs more than it saves (say so explicitly).
