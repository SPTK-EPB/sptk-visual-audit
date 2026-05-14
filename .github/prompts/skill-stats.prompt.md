---
description: "Mirrored from ~/.claude/commands/skill-stats.md"
name: "skill-stats"
agent: "agent"
---
<!-- Mirrored from ~/.claude/commands/skill-stats.md by scripts/harness/sync-commands-to-prompts.sh -- do not edit directly -->
Query agent-obs for skill usage analytics. Without args: top-20 skills by 30d load count + retirement candidates. With one arg: detailed breakdown for that skill.

## Data source

agent-obs HTTP API on CT 252 (LAN-only: `192.168.1.252:3100`). Auth: `X-API-Key` header.

## Reachability

The agent-obs endpoint is on the VM LAN (192.168.1.0/24).

- **From a satellite (devsat1/2/3)**: direct curl works — those CTs are on the VM LAN
- **From CC home (WSL2 laptop)**: WSL2 cannot reach the VM LAN. Fall back to an SSH jump via a Proxmox node (e.g., `ssh -i ~/.ssh/copilot_homelab copilot@192.168.72.13 'curl ...'`)

Try the direct path first with `--max-time 5`. If the curl times out or refuses, run the SSH-jump fallback. Don't ask the user which environment — detect.

## API key

```bash
AGENT_OBS_KEY=$(grep '^AGENT_OBS_API_KEY=' ~/secrets.env | cut -d= -f2-)
```

If `~/secrets.env` doesn't exist locally (some satellite contexts), fall back to reading it via the same SSH jump used for the curl.

## Endpoints

- `GET /api/skills/usage` — full list, sorted by 30d-loads descending. Optional `?skill=<name>` returns just that skill.
- `GET /api/skills/daily` — per-day per-skill load counts for the last 30 days (heatmap drill-down). Optional `?skill=<name>`.

Response shape for `/api/skills/usage`:

```json
{
  "skills": [
    {
      "name": "mui-datagrid",
      "loads_7d": 12,
      "loads_30d": 48,
      "loads_all": 312,
      "last_loaded": "2026-05-12T18:30:00Z",
      "workspaces_top3": [{"name": "android-device-manager", "count": 28}],
      "models": {"claude-opus-4-6": 30, "claude-sonnet-4-6": 18}
    }
  ]
}
```

## Behavior

### No args — overview

1. Fetch `/api/skills/usage`
2. Render three sections, in order:
   - **Top 20 by 30d loads** — table: `skill | 7d | 30d | all | last_loaded | top workspace`. Sort by `loads_30d` desc, tiebreak by `loads_all` desc.
   - **Retirement candidates** — skills present in `~/.claude/skills/` but **not** in the response (never loaded) + skills with `loads_all <= 2` (loaded once or twice ever). List as `- <skill>` with the reason (`never loaded` or `loaded N times, last <date>`).
   - **Most-active workspaces** — aggregate `workspaces_top3[].count` across all skills, show top 5 workspaces by total skill-load count.
3. If the response is empty or has very few rows, note: "Backfill may still be running on CT 252. Re-run in a few minutes for fuller data."

For the never-loaded computation, list `~/.claude/skills/` (one dir per skill) and diff against the `skills[].name` set in the response. Skip any skill whose directory is empty or whose `SKILL.md` is missing.

### One arg — single-skill drill-down

`/skill-stats <skill-name>`

1. Fetch `/api/skills/usage?skill=<name>` AND `/api/skills/daily?skill=<name>` in parallel
2. Render:
   - **Header**: skill name + `loads_7d / loads_30d / loads_all`, `last_loaded` (relative + absolute)
   - **Workspaces** — full `workspaces_top3` (the API returns top-3; render all returned rows)
   - **Models** — Opus vs Sonnet vs Haiku breakdown from `models` map
   - **Daily** — sparkline-style 30-day load count using `daily` response; one line, count-per-day, missing days as `0`. Compact ascii like `▁▂▁▂▃▁▁▂▄...`
3. If the skill is in `~/.claude/skills/` but the response is empty/404, say: "Skill exists on disk but has no recorded loads — never invoked, or backfill incomplete."

## Output style

- Concise. No preamble, no explanation of what the data means unless the user asks.
- Markdown tables for the overview. Bullet lists for retirement candidates and per-skill drill-down sections.
- Relative timestamps for `last_loaded` (e.g., "2 days ago"), absolute in parens.
- Don't dump the raw JSON — format it.

## Notes

- This is Phase 2 of cc#191 (demand-driven skill rotation). Phase 3 will weight `skill-rotation.sh check` by these stats. Phase 4 will add a hard-stale prompt at skill-load time.
- The API currently exposes ONLY explicit `Skill` tool-call events (per agent-obs#21). Reminder-derived skill loads (auto-triggered via system reminders) are NOT yet captured — tracked at agent-obs#22. If a user expects a skill to show high usage but it shows low/zero, the gap is likely reminder-derived loads not yet counted.
- Data freshness: agent-obs on CT 252 only sees its own `~/.claude/projects/` — fleet-wide transcripts (laptop + satellites) are not synced as of 2026-05-14. Tracked at agent-obs#23. Never-loaded counts may be inflated until this is resolved. Until then, the output represents "what CT 252 has seen" rather than "what the fleet has loaded".
