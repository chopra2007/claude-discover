# discover

discover takes a feature idea for an existing project and runs it through five disciplined
passes — map what's already there, research what's possible, cut to what's worth building,
adversarially try to kill each idea, then produce and execute a build-ready plan. The point is
to cut the failure rate of "throw a feature at the codebase and hope" by forcing a research and
validation gate before any code gets written.

Passes 0–4 run inside Claude Code's built-in **Workflow engine**, so the heavy research keeps a
clean context and survives crashes; Pass 5 (the actual build) runs in your normal session.

---

## Requirements

- **Claude Code 2.1.154 or newer** (paid) — discover runs on the built-in Workflow engine, which
  ships in that version. If it's missing, discover stops and tells you to run `claude update`.
- **git** — for the Pass 5 commit/push step (skipped cleanly if there's no GitHub remote).
- Nothing else is required.

---

## How it works

There's a back room and a front desk. The **back room** is the Workflow engine: it runs many
small helper agents in parallel, and their raw output never lands in your chat — it's written
straight to files on disk. The **front desk** is the skill you talk to: it asks a few setup
questions, launches each burst of passes, and relays back a short summary plus the file paths.
Everything the run produces lives under `.claude/discover/<run-name>/`, which is the source of
truth — the engine's own memory is a throwaway cache, so a crashed session or a slept laptop
never loses work.

| Pass | What happens |
|------|--------------|
| **0 — Map** | Parallel mappers read the actual source; an architect merges it into one faithful system map (skipped on a brand-new project). |
| **1 — Research** | Researchers search real sources for candidate features, in bounded rounds that stop when a round turns up nothing new. |
| **2 — Filter** | Candidates are ranked; anything claimed to "already exist" is independently checked against real code before it's dropped. |
| **3 — Kill-test** | A panel of skeptics tries to disprove each idea. An idea dies only on proven, checked evidence — never a vote. |
| **4 — Plan** | Rival planners each draft a build plan; a judge picks the winner and grafts in the best safeguards, producing one build-ready plan. |
| **5 — Build** | In your main session: implement in a loop until the plan's checklist passes, run a real probe for every feature, then (with your OK) commit. |

The kill-test is the core idea: a skeptic can only kill a feature by citing evidence it actually
inspected this run (a file and line, a command's output, a fetched page), and an advocate gets to
defend before a judge re-checks that evidence and rules. One proven fatal objection kills — there
is no majority vote.

---

## Install

```
/plugin marketplace add https://github.com/chopra2007/claude-discover
/plugin install discover
```

---

## Usage

discover is heavyweight, so it only activates on an explicit trigger:

| Trigger | Example |
|---------|---------|
| `/discover` slash command | `/discover` |
| Message starting with `discover:` | `discover: add CSV export` |
| The literal phrase **"discover skill"** | `use the discover skill to add wallet attribution` |

Extra sub-commands:

- `discover: <name>` — resume a run where it left off.
- `discover: build <name>` — build a plan you saved earlier (Plan-only style).
- `discover: recheck` — re-scan for optional boosters.
- `discover: <name> budget=N` — power-user cap on how many Claude tokens the run may spend.

It will NOT activate on plain "add a feature", "build me X", or "improve my system" — the trigger
is intentionally narrow.

---

## The three setup questions

discover asks these once, at the start, and never guesses them for you:

- **Run name** — a short kebab-case slug (e.g. `reddit-sentiment`). It becomes the folder at
  `.claude/discover/<run-name>/` where every artifact lives, and it's the key you re-use to
  resume if the session dies.
- **Thoroughness** — how hard it digs, and roughly what it costs:
  - **Light** — a quick sweep (2 mappers, 2 research rounds, 2 skeptics, 1 plan); small token spend.
  - **Standard** (default) — the balanced middle (3 mappers, 3 rounds, 3 skeptics, 2 rival plans).
  - **Deep** — exhaustive (5 mappers, up to 5 rounds, 5 skeptics, 3 rival plans); can eat a large
    chunk of a 5-hour usage window.
- **Run style** — **Hands-off** (passes 0–4 straight through, then build after one OK on the plan),
  **Checkpoints** (review the shortlist, any kills, and the plan before the build), or **Plan-only**
  (stop at the plan; build it later with `discover: build <name>`).

---

## Optional boosters

discover works with nothing but Claude Code. If any of these are installed, it uses them; if not,
it silently falls back to the built-in path. The difference between *absent* and *broken* matters:
an absent tool is used silently; a **broken** one (installed but, say, logged out) gets a loud
warning before any work starts, with the exact fix.

| Booster | What it adds | If absent |
|---------|--------------|-----------|
| **OMC** (Oh My ClaudeCode) | ralph's loop-until-verified build in Pass 5 | Built-in implement→verify loop |
| **superpowers** | the verification-before-completion gate | Built-in fresh-verifier check |
| **Codex CLI** | a second AI family's opinion in the kill-test | Single-family panel (labelled as such) |
| **Gemini CLI** | a second AI family's opinion in the kill-test | Single-family panel (labelled as such) |

Cross-model opinions are **advisory only — never a vote**. They can flag a disputed kill for you
to decide; they can't overturn one on their own.

---

## What you'll be shown

- A one-line booster status before any work (and the exact fix for anything broken).
- After every burst: a plain-language summary and the file paths — never a wall of raw agent output.
- A `drops-log.md` where every dropped idea has a reason and an evidence pointer — nothing vanishes silently.
- A kill report with symmetric detail: why each idea died *and* the strongest objection each survivor beat.
- Any decision that's genuinely yours (e.g. a kill one AI family disputes) surfaced explicitly.

---

## Costs & limits

- Thoroughness ≈ spend: Light is cheap, Deep can be a large chunk of a 5-hour window.
- The budget breaker meters **Claude tokens only** — Codex/Gemini CLI calls are not counted against it.
- Parallelism is capped at your machine's cores minus 2. More cores = faster, not more thorough.

---

## Tested on

Linux and macOS. Windows is untested.

---

## Changelog

- **1.0.0** — Rebuilt on Claude Code's built-in Workflow engine. tmux removed; boosters are now
  fully optional. New evidence-rule kill-test, plan tournament, and cross-run outcome memory.

---

## License

MIT
