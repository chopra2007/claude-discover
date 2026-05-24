# discover

Methodical 5-pass workflow for adding new features to existing software or automation systems with high success rate and zero redundancy. Composes existing OMC and superpowers skills via parallel multi-agent orchestration (tmux panes or native Claude Code `Agent` dispatch) — does not reinvent them.

The point: cut the failure rate of "throw a feature at the codebase and hope" by enforcing a research and validation gate before code gets written.

---

## Quick Start

**Step 1 — Install via the Claude Code plugin marketplace:**

```
/plugin marketplace add https://github.com/chopra2007/claude-discover
/plugin install discover
```

**Step 2 — Reload plugins:**

```
/reload-plugins
```

**Step 3 — Use it:**

```
discover: add reddit sentiment scoring to the trade idea bot
```

That's it.

---

## Triggers

The skill activates on one of three explicit forms:

| Trigger | Example |
|---------|---------|
| `/discover` slash command | `/discover` |
| Message starting with `discover:` | `discover: add CSV export` |
| The literal phrase **"discover skill"** | `use the discover skill to add wallet attribution` |

It will NOT activate on plain "add a feature", "build me X", "extend my system", etc. The trigger is intentionally narrow because this is a heavyweight workflow.

---

## What it does

| Pass | What happens | Output |
|------|--------------|--------|
| **0** — System Analysis | Parallel `explore` agents map the existing codebase; `architect` synthesizes a system map | `pass-0-system-map.md` |
| **1** — External Research | `external-context` + `sciomc` (and optional `superpowers:brainstorming`) gather candidate features from real-world sources | `pass-1-candidates.md` |
| **2** — Filter & Prioritize | `analyst` removes redundancy vs Pass 0; `critic` identifies failure modes; rank by quality/edge/feasibility | `pass-2-filtered.md` |
| **3** — Adversarial + Cross-Model | `critic` + `security-reviewer` adversarial pass, then `ccg` (Claude-Codex-Gemini) cross-model synthesis with agreement matrix | `pass-3-stress-tested.md` |
| **4** — Implementation Plan | `ralplan` consensus loop produces a build-ready plan; emits a kickoff prompt | `final-plan.md` + `EXECUTE.md` |
| **5** — Execution (separate session) | Paste kickoff prompt in a fresh session → `ralph` loop → executor + test-engineer + verifier → flip feature flags + restart service → direct commit + push to current branch | `pass-5-execution-log.md` |

All artifacts live in `.claude/discover/<run-name>/` so the workflow survives context compaction or terminal restarts.

---

## Setup options the skill asks at start

- **Run name** — short kebab-case slug (e.g. `reddit-sentiment`, `csv-export`) that becomes the directory name at `.claude/discover/<run-name>/` where every artifact for this run lives: `state.json`, the per-pass markdown files, and `EXECUTE.md`. It's also the **resume key** — if your terminal dies or context compacts mid-run, re-invoking `discover:` with the same name picks up where it left off. And `EXECUTE.md` (the prompt you paste into a fresh session for Pass 5) embeds the absolute path that includes this slug, so renaming after the run starts is awkward. The skill auto-suggests one from your feature description; you can confirm or correct it.
- **Mode** — pause-for-review after each pass, OR run all 5 autonomously
- **Layout type** — tmux (separate terminal panes) or native (Claude Code's built-in parallel `Agent` dispatch, no tmux required)
- **Agent count** — how many parallel agents to use (suggested: 2–6). More agents = faster research passes but higher token cost. With fewer agents, the orchestrator combines roles sequentially in shared slots.

---

## Greenfield handling

If `discover` detects fewer than ~10 source files in the project, it auto-degrades to a 4-pass mode (skips Pass 0 — there's nothing to analyze). It tells you this is happening so you can override if you want.

---

## Pass 5 semantics

"Live and ready to go" in this skill means: code in, tests pass, feature flags flipped, running service restarted/reloaded so the new feature is firing on the local box. It does NOT mean a full prod-deploy pipeline. If your prod is a different machine, you'll need to handle that separately.

Git push: direct to the current branch, no PR flow. If you want PR-based review, use `git-master` manually after Pass 5 completes.

---

## Prerequisites

- **Claude Code** CLI
- **tmux** — optional; required only for the tmux layout. The native layout uses Claude Code's built-in parallel `Agent` dispatch and works without tmux.
- **OMC (Oh My ClaudeCode)** — required for `ralplan`, `ccg`, `ralph`, `external-context`, `sciomc`, and the agent system. Install via `/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode` then `/plugin install oh-my-claudecode`.
- **superpowers** plugin (optional) — for Pass 1 ideation via `brainstorming`, and Pass 5 verification gate
- **git** — needed for Pass 5 commit/push (skipped if no GitHub remote)

The skill checks these at startup and tells you what's missing before doing anything destructive.

---

## Repository structure

```
.
├── .claude-plugin/
│   ├── marketplace.json     # marketplace catalog
│   └── plugin.json          # plugin manifest
├── skills/
│   └── discover/
│       ├── SKILL.md         # main 5-pass workflow instructions
│       ├── discover.sh      # tmux session helper (--layout 2|3|4|5|6)
│       └── references/
│           ├── tmux-layout.md
│           ├── pass-templates.md
│           └── kickoff-prompt.md
├── README.md
└── LICENSE
```

This is a single-plugin marketplace — the same repo serves as both the marketplace catalog and the plugin source.

---

## Alternative install (without the marketplace flow)

If you don't want to use the plugin marketplace, you can still install the skill directly:

```bash
git clone https://github.com/chopra2007/claude-discover.git
cp -r claude-discover/skills/discover ~/.claude/skills/
chmod +x ~/.claude/skills/discover/discover.sh
```

Then it's available as a regular skill (no marketplace involvement).

---

## License

MIT

---

## Inspired by

- [Oh My ClaudeCode](https://github.com/Yeachan-Heo/oh-my-claudecode) — the agent and workflow primitives this skill composes
- [Superpowers](https://github.com/obra/superpowers) — the brainstorming pattern used optionally in Pass 1
- The 4-pass adversarial-discovery pattern, extended with a 5th execution pass and `ccg` cross-model synthesis
