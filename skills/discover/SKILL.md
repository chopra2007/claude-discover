---
name: discover
description: Methodical 5-pass workflow (existing-system analysis, external research, filter/prioritize, adversarial+ccg cross-model stress test, ralplan implementation plan, autonomous execution with verification and git push) for adding new features to existing software or automation systems with high success rate and zero redundancy. Composes OMC and superpowers skills rather than reimplementing them. ONLY trigger when one of four hard triggers is present in the user's message — the `/discover` slash command, a message starting with `discover` followed by a colon (including `discover: resume <name>` for resuming Pass 5 in a fresh session), or the literal phrase "discover skill" anywhere in the message. Words like "add", "build", "feature", "extend", or "improve" alone are NEVER sufficient. If none of the four hard triggers is present, do NOT activate even if the request seems like a perfect fit; let the normal flow handle it. The user has chosen explicit-invocation-only because this skill is intentionally heavyweight.
---

# discover — 5-Pass Feature Discovery & Execution

A workflow that takes a feature idea for an existing system and runs it through a structured pipeline: understand what already exists, research what's possible, filter to what's high-impact and non-redundant, stress-test under adversarial conditions, produce a build-ready plan, and then execute it autonomously.

The point: cut the failure rate of "throw a feature at the codebase and hope" by enforcing a research and validation gate before code gets written, and by leaning on existing battle-tested skills (OMC's agents, `ralplan`, `ccg`, `ralph`, `external-context`, `sciomc`; superpowers' `brainstorming`) rather than reinventing them.

## When this fires

Only on one of four explicit triggers:

- `/discover` slash command
- A message that starts with `discover:` (e.g. `discover: add reddit sentiment to the trade bot`)
- `discover: resume <run-name>` — re-enters Pass 5 in a fresh session using artifacts saved from Pass 4
- The literal phrase **"discover skill"** anywhere in the message (e.g. `use the discover skill to add reddit sentiment`)

If none of those four triggers is in the message, this skill does NOT activate — even if the request looks like a perfect fit. Phrases like "add a feature", "extend my system", "build me X", or "improve the bot" alone are never enough. The user has chosen explicit-invocation-only on purpose to avoid heavyweight workflows for simple changes.

## Prerequisites you should sanity-check before starting

Before kicking off Pass 0, verify these are available. If any are missing, tell the user what to install and stop — don't try to limp along without them.

- **tmux** — required only for the tmux layout. Optional — the native layout uses Claude Code's built-in parallel `Agent` / `Task` dispatch instead and does not require tmux at all. Check with `command -v tmux`; if missing, the native layout is your path forward.
- **OMC (Oh My ClaudeCode)** — required for the agent and skill primitives this workflow leans on. Check by looking for `~/.claude/plugins/oh-my-claudecode` or running `/oh-my-claudecode:omc-doctor` if the user wants a deeper check.
- **superpowers** plugin (optional but recommended for Pass 1 ideation) — check `~/.claude/plugins/superpowers`.
- **git** — needed for Pass 5 commit/push step. Check with `command -v git`.

If running on a fresh project with no `git remote`, that's fine — just note it; the Pass 5 push step will be skipped automatically.

## Run state and artifacts

Each invocation creates a run directory at `.claude/discover/<run-name>/` (relative to the project root). This is where every pass's output lands, and it's what survives a context compaction or a fresh terminal session.

```
.claude/discover/<run-name>/
├── state.json              # current pass, agent assignments, mode, decisions
├── pass-0-system-map.md    # output of Pass 0 (skipped on greenfield)
├── pass-1-candidates.md    # output of Pass 1
├── pass-2-filtered.md      # output of Pass 2
├── pass-3-stress-tested.md # output of Pass 3 (includes ccg synthesis)
├── final-plan.md           # output of Pass 4 — the build-ready plan
├── EXECUTE.md              # kickoff prompt to paste in a fresh session
└── pass-5-execution-log.md # populated during Pass 5
```

The `<run-name>` should be a short kebab-case slug derived from the feature idea (e.g. `reddit-sentiment`, `csv-export`, `wallet-attribution`). Ask the user to confirm the auto-generated slug — it's the key for the entire run.

## Initial Setup — before Pass 0

When the skill triggers, do these things in order:

1. **Read `state.json` if it exists.** If the user is resuming a previous run (i.e. they invoked `discover:` and a state file exists for the same feature), offer to resume from the last completed pass. Don't silently overwrite.

2. **Ask the three setup questions — REQUIRED, even under "always proceed" / no-confirmation user instructions.**

   These are parameter inputs, not "shall I proceed?" confirmations. They cannot be auto-defaulted because each one materially changes what the run does (filesystem key, token budget, parallelism, review checkpoints). A user-level rule like "never ask for confirmation" / "always proceed without asking" does NOT apply here — those rules govern yes/no gates on already-specified work. Setup parameters for a heavyweight workflow are a different category, and the user explicitly opted into this skill's heavyweight nature by triggering it.
   
   Ask all three in a single message, then wait for the answer. Do not pick defaults silently. Do not infer from CLAUDE.md / GEMINI.md / AGENTS.md. If the user replies with partial answers, ask only for the missing ones — don't fill in the rest.
   
   - **Run name**: confirm or correct the auto-generated kebab-case slug. When you ask the user, phrase it so they understand *why* it matters — not just "what should we call this run?". Tell them: this slug becomes the directory at `.claude/discover/<run-name>/` where every artifact for this run lives (state.json + per-pass markdown + EXECUTE.md), it's the **resume key** if context compacts or the terminal dies (re-invoking `discover:` with the same name picks up from the last completed pass), and `EXECUTE.md` (the Pass 5 kickoff prompt) embeds the absolute path containing this slug — so renaming mid-run is awkward. Show them the auto-suggested slug and ask them to confirm or replace it. Example phrasing: *"**Run name** — I'll use `reddit-sentiment` as the slug for this run. All artifacts (state.json, pass-*.md, EXECUTE.md) will live at `.claude/discover/reddit-sentiment/`, and that name is the key you'd re-use to resume if context compacts or you reopen the session later. Confirm, or give me a different short kebab-case name."*
   - **Mode**: pause-for-review after each pass, OR run all 5 passes autonomously and present the final result. Pass 5 always pauses (it's a separate session anyway — see below). The mode question only governs Passes 1–4.
   - **Layout type**: tmux or native.
     - **tmux** — agents run in separate terminal panes via `discover.sh`. Requires tmux to be installed. Good when you want visible parallel panes or are resuming a layout that's already running.
     - **native** — agents are dispatched as parallel `Agent` / `Task` tool calls from `superpowers:dispatching-parallel-agents`. No tmux needed. Recommended on systems without tmux or when you want the skill to manage parallelism internally. Works identically to tmux from the perspective of the workflow; `final-plan.md` schema is the same regardless.
   - Suggest native as the recommendation when tmux is not installed; otherwise ask without a default.
   - **How many parallel agents?** (suggested: 2–6). Below 2 there is no parallelism benefit. Above 6, coordination overhead and token costs outweigh the gains. Frame the tradeoff: fewer agents = lower token cost + fits smaller API quotas; more agents = faster wall-clock for research-heavy passes. The user's chosen count applies to both tmux and native layouts. For tmux it controls how many panes are created; for native it controls how many parallel `Agent` calls are dispatched per pass. Do not pick a default silently.

   Only after the user answers all three do you proceed to step 3 (greenfield detection). If the user types something that bypasses the questions ("just go", "do it"), still answer the parameter questions yourself with explicit defaults stated in the chat — never silently — so the user can see and correct what you picked.

3. **Detect greenfield.** Run `git ls-files | head -50` and `find . -maxdepth 2 -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.rs" \) | head -20` (adjust extensions to context). If the project has fewer than ~10 source files or no recognizable structure, it's greenfield. **In greenfield, skip Pass 0 and proceed to Pass 1 with a one-line note in `state.json`.** Tell the user this is happening and why.

4. **Set up the agent layout.**
   - **tmux layout:** Run `discover.sh <run-name> --layout <agent-count>` where `<agent-count>` is the number chosen in question 3. The script creates the named tmux session with the right number of panes and writes per-pane `.env` files. See `references/tmux-layout.md` for layout details and dispatch helpers.
   - **Native layout:** Invoke `superpowers:dispatching-parallel-agents` to establish the dispatch pattern. Write per-agent `.env` files to `${RUN_DIR}/.agent-<n>.env` (same format as tmux pane env files). No tmux session is created. Agents will be dispatched as parallel `Agent` tool calls rather than `tmux send-keys` commands. Record `layout: "native"` and `agent_count: <n>` in `state.json`.

5. **Initialize `state.json`** with the run name, mode, layout type (`tmux` or `native`), agent count, current pass = 0 (or 1 if greenfield), agent slots, and a creation timestamp.

Save `state.json` after every meaningful step. It's the recovery point.

## Agent Layout Options

This skill supports two layout types. Pick at startup (see Initial Setup). Both produce identical `final-plan.md` output and use the same per-pass workflow; the only difference is how agents are dispatched.

### Tmux layout

Agents run in separate terminal panes created by `discover.sh`. Requires tmux.

**Role mapping (scales with agent count):**

| Agent slot | Role | Model |
|------------|------|-------|
| `orchestrator` | Owns the run, dispatches work, reads/writes `state.json` | opus |
| `architect` | System design, integration points, trade-offs | opus |
| `planner` | Task sequencing, plan structure | opus |
| `critic` | Adversarial review, gap analysis | opus |
| `researcher-N` (one per remaining agent slot) | External + codebase research | sonnet |

With fewer agents, the orchestrator combines roles sequentially (e.g. 3 agents → orchestrator + architect-critic + researcher; 2 agents → orchestrator + architect-critic-researcher). With more agents, dedicated researcher panes run in parallel. The `discover.sh` script handles pane creation for any count from 2 to 6.

Researchers are sonnet because the work is breadth-heavy and output is reviewed by an opus synthesizer. Reasoning roles (architect, planner, critic) are opus because their decisions propagate downstream.

### Native layout (no tmux required)

Agents are dispatched as parallel `Agent` tool calls from the orchestrator using the pattern in `superpowers:dispatching-parallel-agents`. No tmux session is created. The orchestrator is the current Claude Code session itself; parallel work is sent as multiple simultaneous `Agent` / `Task` invocations in a single message. See `references/tmux-layout.md` for the native dispatch pattern and how it maps to the tmux pane model.

The native layout supports the same agent count range (2–6) as the tmux layout. Each "slot" becomes a named parallel `Agent` invocation instead of a tmux pane.

---

## Pass 0 — Existing System Analysis

**Goal:** Build a faithful map of what's already implemented so later passes don't propose redundant features.

**Skip condition:** Greenfield (detected during Initial Setup). Note in `state.json` and proceed to Pass 1.

**Approach:**

1. Dispatch parallel `explore` agents (haiku tier where available, sonnet otherwise) to cover the codebase. Split coverage by directory or concern (e.g., one researcher covers `src/data/` + `src/signals/`, the other covers `src/output/` + `src/config/`). Each writes findings to a scratch file in the run directory.
   - **Tmux layout:** `tmux send-keys` to each `researcher-N` pane.
   - **Native layout:** Dispatch all researcher agents as parallel `Agent` tool calls in a single message — don't send them sequentially.

2. While researchers run, the orchestrator reads `README.md`, top-level config files, `package.json`/`Cargo.toml`/`pyproject.toml`, and any obvious entrypoints to build a high-level mental model.

3. Once researchers report back, dispatch `architect` (opus) in its pane to synthesize their findings into the system map. The architect should explicitly mark anything as "inferred but not verified" if it's based on naming conventions rather than actual code reading.

**Output to `pass-0-system-map.md`:**
- Component inventory (what each module does)
- Data sources currently in use
- Pipeline / data flow diagram (text/mermaid)
- Strengths (what's working well)
- Gaps (clear missing or weak capabilities — only things that are actually absent, not "could be improved")

**Anti-pattern to avoid:** Inferring functionality from filenames. If `sentiment.py` exists but only contains a stub, that's a gap, not a feature. Researchers MUST read source, not just list files.

If `pause-for-review` mode: stop here, present the system map, ask the user to confirm or correct before continuing.

---

## Pass 1 — External Research & Candidate Features

**Goal:** Surface a wide net of candidate features grounded in how real systems solve the same problem.

**Approach:**

1. Optionally invoke `superpowers:brainstorming` if the user's feature ask is fuzzy ("make the bot smarter"). Brainstorming asks one clarifying question at a time and gets to a sharp design intent — feed that intent into the rest of Pass 1.

2. Dispatch `/oh-my-claudecode:external-context` for parallel document-specialist research on the feature domain (papers, blog posts, public datasets, similar open-source projects). This populates external knowledge fast.

3. In parallel, dispatch `/oh-my-claudecode:sciomc` if the feature involves data analysis, statistical methods, or anything where multiple analytical angles help. `sciomc` runs parallel scientist agents — useful for "what are the 5 ways people approach X" questions.

4. The researcher panes (sonnet) consolidate findings into a candidate list. Each candidate must include:
   - **Function** — what it does
   - **Rationale** — why it's worth considering for *this* system
   - **Source category** — High / Medium / Low signal quality (where High = peer-reviewed or production-validated, Medium = widely-used pattern, Low = blog-post-grade)

**Constraints (preserve from the original 4-pass philosophy):**
- Free, public data only by default. If the user wants paid data sources, they need to say so explicitly — surface it as a flag.
- No fragile scraping or terms-of-service violations.
- Don't suggest features that already exist in Pass 0's map.

**Output to `pass-1-candidates.md`:** the full candidate list, unfiltered. Pass 2 does the filtering.

If `pause-for-review`: stop, present the candidate list, ask the user if anything's missing or off-base.

---

## Pass 2 — Filter, Deduplicate, Prioritize

**Goal:** Cut the candidate list down to the high-impact, non-redundant, feasible subset.

**Approach:**

1. Dispatch `analyst` (opus) in the architect pane (or a dedicated analyst pane if you want to keep architect free) to compare Pass 1 candidates against Pass 0's system map and remove anything redundant or already implemented.

2. Dispatch `critic` (opus) on the remaining set to identify failure modes per feature: false signals, manipulation vectors, latency issues, crowded-trade dynamics, race conditions, integration friction — whatever applies.

3. The architect adds safeguards per feature: confirmation logic, thresholds, source weighting, time decay, fallback behavior.

4. Rank surviving features along three axes: signal quality improvement, practical edge / impact, feasibility. Drop the bottom tier.

**Output to `pass-2-filtered.md`:**
- Final new-feature set (non-redundant, high-impact)
- Per-feature: function, rationale, identified failure modes, safeguards, rank
- Implementation notes (practical, stable approaches — not full design yet, that's Pass 4)

If `pause-for-review`: present the filtered set; the user gets a chance to drop or add features before stress-testing.

---

## Pass 3 — Adversarial Stress Test + Cross-Model Synthesis

**Goal:** Catch features that look good on paper but break under adversarial or real-world conditions, then validate the survivors against multiple AI models for diverse-perspective robustness.

**Approach:**

**Step 1 — Local adversarial review:**
- Dispatch `critic` (opus) to attack the filtered feature set: where do signals become misleading? What structural weaknesses exist (noise, crowding, delayed data, lack of edge)? What scenarios cause the feature to fail or be exploited?
- Dispatch `/oh-my-claudecode:security-reviewer` (sonnet) on any feature touching auth, external input, or sensitive data flows.
- Strengthen surviving features or remove ones whose weaknesses can't be safeguarded.

**Step 2 — Cross-model synthesis (final step of Pass 3):**
- Invoke `/oh-my-claudecode:ccg` (Claude-Codex-Gemini) on the post-adversarial feature set with the prompt: "Here are N proposed features for [system X]. For each, identify: (a) the strongest reason to keep it, (b) the strongest reason to drop it, (c) hidden risks not yet considered."
- `ccg` queries Codex and Gemini in parallel and Claude synthesizes. The output should explicitly call out: where all three models agreed, where they disagreed, and which features have only single-model support (these are the riskiest — flag, don't necessarily drop).

**Output to `pass-3-stress-tested.md`:**
- Refined feature set with adversarial review notes
- ccg synthesis section: agreement matrix, disagreements, single-model-support flags
- Realistic edge — what these features actually improve, in concrete terms
- Explicit limitations — what they don't solve

If `pause-for-review`: this is an important checkpoint. Show the user the cross-model synthesis especially — features only one model supports are decision points.

---

## Pass 4 — Modular Implementation Plan

**Goal:** Convert the validated feature set into a build-ready design that integrates cleanly with the existing system.

**Approach:**

This pass is largely delegated to `/oh-my-claudecode:ralplan` — its Planner + Architect + Critic consensus loop is exactly what's needed here, and reimplementing it would be silly.

1. Compose a context bundle: Pass 0 system map + Pass 3 final feature set + any user constraints captured during pause-for-review checkpoints.
2. Invoke `ralplan` with that bundle and the directive: "Produce an implementation plan that integrates these features into the existing system without duplicating functionality or creating redundant components."
3. After `ralplan` reaches consensus, the orchestrator reviews the output for completeness against the required sections (below) and adds any missing pieces.

**Required sections in `final-plan.md`:**
1. **System Overview** — how the new features fit in
2. **Component Architecture** — for each new module: purpose, inputs, outputs, core logic
3. **Data Flow Pipeline** — step-by-step with new components highlighted
4. **Data Structures** — schemas for new data objects
5. **Integration Plan** — exact connection points to existing code (file paths, function signatures, config keys)
6. **Failure Handling** — behavior when data is missing, delayed, or conflicting
7. **Feature Activation Plan** — which config flags / env vars need to flip to "on" after the code is in place, and how the running service picks up the change (restart vs. hot reload)
8. **Verification Checklist** — concrete checks Pass 5 must pass before declaring success

**Then, generate the kickoff prompt:**
- Write `EXECUTE.md` using the template at `references/kickoff-prompt.md`. Fill in all placeholders (run-name, absolute path to `final-plan.md`, activation summary, git remote).
- The file the user pastes from is `EXECUTE.md`; the *prompt they type* must be exactly one short line — `discover: resume <run-name>`. Do NOT ask them to copy-paste the contents of `EXECUTE.md`. The skill re-activates from the one-liner and reads `EXECUTE.md` from disk itself.
- Print to chat with a clear marker:

  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Plan saved to: <abs-path>/final-plan.md
  ✅ Pass 5 context saved to: <abs-path>/EXECUTE.md

  Open a fresh Claude Code session and type:

      discover: resume <run-name>

  The skill will re-activate and read EXECUTE.md from disk.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```

The reason for the context split: Passes 0–4 burn a lot of context on research and synthesis. Pass 5 is execution-heavy and benefits from a clean slate. The one-liner trigger is the simplest reliable way to guarantee that without making the user paste a wall of text.

If autonomous mode was selected, this is still where the skill stops — Pass 5 is *always* a separate session because the context-clearing benefit is structural.

---

## Pass 5 — Execution (separate session)

This pass runs when the user types `discover: resume <run-name>` into a fresh Claude Code session. The skill re-activates, locates the run directory at `.claude/discover/<run-name>/`, reads `EXECUTE.md`, `state.json`, and `final-plan.md`, then runs the execution flow. The user does NOT paste `EXECUTE.md` contents — they type only the one-line trigger; the skill reads the file from disk.

**Goal:** Implement, verify, activate, and (if applicable) push. Minimize human input — only ask when genuinely stuck on direction.

**Approach:**

1. **Read context.** Load `final-plan.md`, `state.json`, and any decisions captured during earlier pauses. If anything is missing or contradictory, ask once for clarification.

2. **Implement.** Use `/oh-my-claudecode:ralph` with the directive: "Execute the implementation plan at `<abs-path>/final-plan.md`. Loop until the verification checklist passes." `ralph`'s loop-until-verified semantics are exactly what's wanted here — it won't stop at "looks done", it'll keep going until the verifier agent confirms.

   - Inside `ralph`, `executor` (sonnet) does the code changes, `test-engineer` (sonnet) writes/runs tests, `verifier` (sonnet) checks the verification checklist from Pass 4.

3. **Activate features.** Once the code is in and tests pass, perform the Feature Activation Plan from `final-plan.md`:
   - Flip the relevant config flags / env vars to enable the new features.
   - If the system is a running service (look for systemd unit, pm2 process, docker container, or running tmux/screen session), restart or hot-reload it so the new code takes effect.
   - Tail logs for ~10–30 seconds and confirm the new feature is producing expected output.
   - This is "Option 2" semantics: functional + features turned on, not a full prod deploy.

4. **Verify before committing.** Invoke `superpowers:verification-before-completion` now. This skill enforces "no completion claim without fresh evidence in the same message" — a stronger gate than the verifier loop alone. It must confirm the verification checklist from `final-plan.md` section 8 is fully satisfied before the commit step runs. If it raises any open items, resolve them first (loop back to ralph) before proceeding.

5. **Commit and push.**
   - Check `git remote -v`. If there's a remote pointing at github.com, proceed; otherwise skip with a note.
   - Stage all changes, commit with a message summarizing the feature(s) added (reference the run name and a one-line summary from `final-plan.md`).
   - Push to the **current branch** directly. (No PR flow — user opted for fastest path.)
   - If the push fails (auth, conflict), surface the error to the user with the exact next step they need to take, and stop. Don't try to force-push or rewrite history.

6. **Final report.** Append to `pass-5-execution-log.md`:
   - What was implemented (file list + summary)
   - Test results
   - Activation confirmation (log excerpts showing the feature working)
   - Git commit SHA + push status
   - Any issues encountered and how they were resolved (or remain open)

**When to stop and ask the user:**
- Plan-vs-reality mismatch: the existing code is structured differently than Pass 0's map suggested, and the integration plan no longer fits.
- A test fails for reasons that suggest a design flaw, not a code bug. (Code bugs: keep looping. Design flaws: surface.)
- Git remote requires interactive auth that wasn't pre-configured.
- Service restart fails and rollback semantics aren't clear.

Otherwise, plow through.

---

## Composition with other skills — reference table

| Pass | Primary skills/agents used | Why |
|------|---------------------------|-----|
| 0 | `explore` (parallel), `architect` | Fast, faithful codebase mapping |
| 1 | `external-context`, `sciomc`, optional `superpowers:brainstorming` | Wide-net research + clarifying intent |
| 2 | `analyst`, `critic` | Filtering against reality + failure-mode discovery |
| 3 | `critic`, `security-reviewer`, `ccg` | Adversarial + cross-model robustness |
| 4 | `ralplan` | Consensus-based implementation planning (Planner+Architect+Critic) |
| 5 | `ralph`, `executor`, `test-engineer`, `verifier`, `superpowers:verification-before-completion`, `git-master` | Loop-until-verified execution; explicit verification gate before commit |

If any of these skills is unavailable on the user's system, fall back gracefully: use direct tool calls instead, but note the degradation in `state.json` so the user knows the run was less rigorous than the full pipeline.

---

## Reference files

- `references/tmux-layout.md` — exact tmux session layout, pane naming, dispatch helpers
- `references/pass-templates.md` — output structure templates for each pass file
- `references/kickoff-prompt.md` — template for `EXECUTE.md`
- `discover.sh` — tmux setup helper

Read these as needed; don't preload them.

---

## Failure modes and recovery

- **Context compaction mid-run:** the `state.json` + per-pass markdown files are the recovery point. On resume, read them and continue from the last completed pass. Don't re-run completed passes unless the user asks.
- **Tmux session killed:** `discover.sh` is idempotent — re-running it attaches if the session exists, creates if not.
- **An OMC skill isn't installed:** degrade gracefully (do the work directly), note the degradation, keep going.
- **Pass 5 paste in stale context:** if the user pastes the kickoff prompt but the run directory doesn't exist or `state.json` is corrupted, refuse and tell them to re-run from Pass 4. Don't try to reconstruct.
- **User aborts mid-run:** leave `state.json` intact with a `status: "aborted"` field. Re-invoking `discover:` on the same run name should offer resume.

---

## Anti-patterns to avoid

- **Skipping the three setup questions because the user has a "no confirmation" rule in CLAUDE.md.** Those questions are parameter inputs, not yes/no gates. Auto-defaulting them — especially `mode`, `layout type`, and `agent count` — silently strips the user's ability to control token budget and review checkpoints. Always ask.
- **Silently picking an agent count without asking.** The user must specify it. If tmux is unavailable, offer native as the layout; still ask for agent count.
- **Skipping Pass 0 to "save time."** It's the redundancy guard. Without it, Pass 1 will propose features that already exist.
- **Letting researcher panes infer functionality from filenames.** Source must be read.
- **Treating ccg's output as gospel.** It's a tiebreaker / second opinion, not an oracle. The user makes the call on disagreements.
- **Auto-pushing on test failure.** Pass 5 only commits if verification passes. A red test halts the commit.
- **Asking the user for permission at every step in Pass 5.** They opted into autonomous execution — only stop on real ambiguity.
