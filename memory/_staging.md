# Staging — Mid-Session Capture

> Items captured during the current session. Processed at end-session.

<!-- Append new items below this line -->

[CC] Adoption checklist propagation — issue #3 (closed in this session) asked for "a one-line note in the adoption checklist for agent-ready issues that consume this library". That's cross-repo: the adopter issues are ADM#197, dugnad-dashboard#28, smie#67. Options for CC to pick: (a) comment on each adopter issue reminding them that `npx playwright install chromium` is a required post-install step, (b) add the line to the `@sptk-epb/visual-audit` section of each consumer's agent-ready issue template if one exists, (c) treat it as already satisfied by the README update (4ba2f57) and close the cross-repo ask. Preference: (c) — the README is canonical; adopter issues can link to it.

[CC] Learned rule candidate — "Match dev-setup script package manager to CI + committed lockfile". When authoring a dev-setup.sh for any library repo, check `.github/workflows/ci.yml` and the tracked lockfile (`package-lock.json` / `bun.lock` / `pnpm-lock.yaml`) BEFORE picking which installer the script calls. Divergence (e.g., script uses bun, CI uses npm) produces a second lockfile on first run and a maintainer walk-back. Session sptk-visual-audit 2026-04-20 hit this once. Might be too niche for learned-rules.md on its own — merge into a broader "verify against CI when scaffolding maintainer scripts" rule if one gets filed, else skip.

[CC] Pre-commit-gate hook fix — `~/.claude/hooks/pre-commit-gate.sh` canonical version runs `bun test` directly, which exits non-zero on "no tests found" (e.g., Phase 1 library repos that haven't written tests yet). Fixed locally in `sptk-visual-audit/.claude/hooks/pre-commit-gate.sh` line ~76 by swapping to `bun run test` — respects the package.json script, which conventionally ends with `|| true` in these states. Should propagate to the canonical version and to other workspaces using the same scaffold (`agent-obs`, `dugnad-dashboard`, `mcp-connectors` per session 530). Symptom: doc-only commits blocked with "Tests need '.test', '_test_', ... in filename".
