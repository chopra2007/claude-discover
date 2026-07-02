---
name: discover
description: Methodical 5-pass workflow (existing-system analysis, external research, filter/prioritize, evidence-rule adversarial kill-test, plan tournament, main-session execution with verification) for adding new features to existing software or automation systems with high success rate and zero redundancy. ONLY trigger when one of four hard triggers is present in the user's message — the `/discover` slash command, a message starting with `discover` followed by a colon (including `discover: resume <name>` for resuming Pass 5 in a fresh session), or the literal phrase "discover skill" anywhere in the message. Words like "add", "build", "feature", "extend", or "improve" alone are NEVER sufficient. If none of the four hard triggers is present, do NOT activate even if the request seems like a perfect fit; let the normal flow handle it. The user has chosen explicit-invocation-only because this skill is intentionally heavyweight.
---

# discover — 5-Pass Feature Discovery & Execution (Workflow-engine edition)

Passes 0–4 (map → research → filter → kill-test → plan) run inside Claude Code's built-in
Workflow engine via the bundled script `workflows/discover-pipeline.js` (resolve the absolute
path from this skill's base directory). Pass 5 (the build) runs here in the main session.
Helpers' output never lands in this session's context: bursts return a short summary + file
paths only. Artifacts on disk under `.claude/discover/<run-name>/` are ALWAYS the source of
truth; the engine journal is a disposable same-burst cache.

## When this fires

Only on one of four explicit triggers:

- `/discover` slash command
- A message that starts with `discover:` (e.g. `discover: add reddit sentiment to the trade bot`)
- `discover: resume <run-name>` — re-enters Pass 5 in a fresh session using artifacts saved from Pass 4
- The literal phrase **"discover skill"** anywhere in the message (e.g. `use the discover skill to add reddit sentiment`)

If none of those four triggers is in the message, this skill does NOT activate — even if the request looks like a perfect fit. Phrases like "add a feature", "extend my system", "build me X", or "improve the bot" alone are never enough. The user has chosen explicit-invocation-only on purpose to avoid heavyweight workflows for simple changes.

Additional sub-triggers: `discover: recheck` (force capability rescan) · `discover: build <name>`
(build a saved plan) · `discover: <name> budget=N` (power-user token cap override).

## Startup sequence — in order, before ANY work

1. **Engine gate.** Check the Workflow tool is present in YOUR current tool list. If absent, STOP
   with zero artifacts written: "discover needs Claude Code 2.1.154 or newer (the built-in
   Workflow engine). You have <version from `claude --version`>. Update with: `claude update` —
   then run discover again." Do NOT improvise a degraded run; a prose fallback is explicitly
   forbidden (design decision — two pipelines would drift).
2. **Capability scan (cached).** Read `~/.claude/discover/environment.json`. If missing, or its
   recorded Claude Code version ≠ current, or the user said `discover: recheck`: rescan — OMC
   (`~/.claude/plugins/cache/` contains oh-my-claudecode, or /oh-my-claudecode:* skills listed),
   superpowers (same pattern), codex CLI (`command -v codex`), gemini CLI (`command -v gemini`).
   Write the file: `{claude_code_version, omc, superpowers, codex_installed, gemini_installed,
   scanned_at}`.
3. **Booster health (per run, parallel, ~10s timeout each).** Only for installed CLIs:
   `timeout 10 codex exec "say ok"` and `GEMINI_CLI_TRUST_WORKSPACE=true timeout 10 gemini -p "say ok"`.
   healthy = replies; broken = installed but errors (usually logged out). Show ONE status line, e.g.:
   `✅ OMC · ✅ superpowers · ⚠️ Codex (logged out) · ✅ Gemini — cross-model will use Gemini only.`
   If anything is ⚠️: say the exact fix (`codex login` / `gemini` re-auth) and ask: pause & fix, or
   proceed without it? EXCEPTION — Hands-off run style: never block; proceed-without and put the
   ⚠️ prominently in the final report.
4. **The three setup questions** (ask all in ONE message; parameter inputs, exempt from
   no-confirmation rules; never silently defaulted):
   - **Name** — confirm or correct the auto-generated kebab-case slug. When you ask the user, phrase it so they understand *why* it matters — not just "what should we call this run?". Tell them: this slug becomes the directory at `.claude/discover/<run-name>/` where every artifact for this run lives (state.json + per-pass markdown + EXECUTE.md), it's the **resume key** if context compacts or the terminal dies (re-invoking `discover:` with the same name picks up from the last completed pass), and `EXECUTE.md` (the Pass 5 kickoff prompt) embeds the absolute path containing this slug — so renaming mid-run is awkward. Show them the auto-suggested slug and ask them to confirm or replace it. Example phrasing: *"**Run name** — I'll use `reddit-sentiment` as the slug for this run. All artifacts (state.json, pass-*.md, EXECUTE.md) will live at `.claude/discover/reddit-sentiment/`, and that name is the key you'd re-use to resume if context compacts or you reopen the session later. Confirm, or give me a different short kebab-case name."*
   - **Thoroughness** — Light / Standard (default) / Deep. Explain in plain words with the cost
     line: Light ≈ a quick sweep (2 mappers, 2 research rounds, 2 skeptics, 1 plan; small token
     spend); Standard ≈ the default balance (3/3/3/2 rivals); Deep ≈ exhaustive (5 mappers,
     up to 5 rounds, 5 skeptics, 3 rival plans; can be a large chunk of a 5-hour usage window).
   - **Run style** — Hands-off (passes 0–4 straight; build after one OK on the plan) /
     Checkpoints (recommended: review the shortlist after pass 2; if the kill-test kills
     something, review that too; review the plan before build) / Plan-only (stop at the plan;
     `discover: build <name>` later).
5. **Greenfield detection.** Run `git ls-files | head -50` and `find . -maxdepth 2 -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.rs" \) | head -20` (adjust extensions to context). If the project has fewer than ~10 source files or no recognizable structure, it's greenfield. Sets
   `greenfield: true` in args; Pass 0 is skipped by the script with a note.
6. **Run dir init.** Create `.claude/discover/<name>/`; write `state.json`:
   `{format_version: 2, name, dial, run_style, created, current_pass: null, bursts: [],
   booster_status: {...}}`. If the dir already exists: `format_version` 2 → offer resume;
   missing/other `format_version` → "This run folder is from the old discover. Finish it with
   plugin v0.1.0, or restart fresh under a new name." — never touch its contents.

## Running bursts

Launch the engine via the Workflow tool: `{scriptPath: "<skill-base>/workflows/discover-pipeline.js",
args: {...}}` with the args contract: name, run_dir (absolute), project_root (absolute),
feature_ask (user's words), dial, run_style, from_pass, to_pass, greenfield, capabilities
(from steps 2–3: {omc, superpowers, codex: healthy|broken|absent, gemini: ...}),
budget_override (from `budget=N` or null), free_data_only (true unless the user allowed paid).

- Hands-off / Plan-only: ONE burst `from_pass: 0, to_pass: 4`.
- Checkpoints: burst `0→2`; **shortlist review**; burst `3→3`; **kill review ONLY if
  counts.kills > 0 or decisions_needed is non-empty** (no kills → launch burst `4→4`
  immediately); **plan review**; then Pass 5.
- After EVERY burst: update `state.json` (current_pass, bursts += {from,to,ok,partial}); relay
  the returned summary + artifact paths to the user in plain language. NEVER paste artifact
  contents into chat unless the user asks; name the files instead.
- Checkpoint edits: whatever the user decides at a review ("drop candidate 3", "overrule that
  kill"), append verbatim to `<run_dir>/checkpoint-edits.md` under a dated heading. The next
  burst's bootstrap reads and applies it (an overruled kill re-enters planning WITH its
  objection attached as a safeguard).
- If a burst returns `partial: true`: show its summary and the `resume_command` verbatim, then
  stop. On resume (`discover: <name>`), read `state.json`, relaunch the SAME burst window —
  completed agent calls replay from the engine cache; finished passes are read from disk.

## Resume triggers
- `discover: <name>` — read `state.json`, continue from `current_pass` / the next burst.
- `discover: build <name>` — skip to Pass 5 using the saved `final-plan.md` (+ `EXECUTE.md` if present).

## Pass 5 — Build (main session)

1. **Read context:** `final-plan.md` + `state.json` (+ `EXECUTE.md` for `discover: build`).
2. **Implement in a loop until the Verification Checklist passes.** If OMC's ralph is present
   and healthy, use it with the directive: "Execute the implementation plan at <abs>/final-plan.md.
   Loop until the verification checklist passes." Otherwise run the built-in loop: implement →
   test → have a FRESH verifier agent (never the implementer) check the checklist with tool
   access → fix → repeat.
3. **Probe gate — before any commit.** For EVERY feature in the plan's Feature Probes section:
   - `live_probe`: execute the instruction, capture the actual output, compare to
     expected_evidence. Record both in `pass-5-execution-log.md`.
   - `deferred_probe`: first VERIFY the named prerequisite really is absent (e.g. grep config
     for the credential, check the env). A deferral with a present prerequisite is void — run
     the probe. Record the verification.
   If `superpowers:verification-before-completion` is available, invoke it now; either way the
   rule holds: no completion claim without fresh evidence in the same message.
4. **Ask before commit** — one message enumerating every probe: ✅ ran (evidence one-liner) /
   ⏸ deferred (reason). Wait for OK. Then commit; push only if a github remote exists (skip
   with a note otherwise); on push failure surface the exact next step, never force-push.
5. **Write `outcome.json`** to the run dir: every candidate that entered Pass 3, with verdict
   shipped (+ commit SHA) / killed (+ short reason) / deferred (+ reason). Future runs on this
   repo read this — it is how discover remembers.
6. **Final report** to `pass-5-execution-log.md`: files changed, test results, probe evidence,
   SHA + push status, open issues.
**When to stop and ask:**
- Plan-vs-reality mismatch: the existing code is structured differently than Pass 0's map suggested, and the integration plan no longer fits.
- A test fails for reasons that suggest a design flaw, not a code bug. (Code bugs: keep looping. Design flaws: surface.)
- Git remote requires interactive auth that wasn't pre-configured.
- Service restart fails and rollback semantics aren't clear.

## Failure modes and recovery
- Engine died / laptop slept mid-burst: artifacts exist for every completed pass; resume relaunches the burst window.
- `state.json` corrupt but artifacts present: rebuild state.json from which pass-N files exist; confirm with the user.
- User aborts: set `status: "aborted"` in state.json; same-name re-invocation offers resume.
- A booster dies MID-run: the script degrades per-call and notes it in the burst summary — no user action mid-run.

## Anti-patterns

- **Skipping the setup questions because the user has a "no confirmation" rule in CLAUDE.md.** Those questions are parameter inputs, not yes/no gates. Auto-defaulting them — especially thoroughness and run style — silently strips the user's ability to control token budget, review checkpoints, and whether the build runs in this session or a fresh one. Always ask.
- **Skipping Pass 0 to "save time."** It's the redundancy guard. Without it, Pass 1 will propose features that already exist.
- **Letting researchers infer functionality from filenames.** Source must be read.
- **Treating cross-model output as gospel.** It's a second opinion, not an oracle — advisory only, never a vote. The user makes the call on disagreements.
- **Auto-pushing on test failure.** Pass 5 only commits if verification passes. A red test halts the commit.
- **Asking the user for permission at every step in Pass 5.** They opted into autonomous execution — only stop on real ambiguity.
