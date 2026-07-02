# discover rebuild — end-to-end evidence log

## Task 11: real end-to-end run (Light, hands-off, passes 0→4)

**How it was run:** the built pipeline script was launched directly through Claude Code's
Workflow tool (the same tool SKILL.md uses) against a real toy project, with hand-constructed
args standing in for the SKILL.md front-of-house. This exercises the actual engine, real
schema-validated agents, real web/code reading, and real file writes — not the stub harness.

- **Toy project:** `/root/work/discover-toy/` — a tiny Python expense tracker (`tracker/store.py`,
  `tracker/cli.py`, `tests/test_store.py`). Its own `pytest` was green (2 passed) before the run.
- **Feature ask:** "add a monthly spending summary command that totals expenses per category for a given month"
- **Args:** dial=light, run_style=handsoff, from_pass=0, to_pass=4, greenfield=false,
  capabilities all absent (so single-family panel; Light has cross-model off anyway).
- **Run ID:** `wf_3b4134de-fb3`. Outcome: `ok:true, partial:false, completed_passes:[0,1,2,3,4]`.
- **Usage:** 21 agents, 0 errors, 0 empty results, 128 tool uses, **793,694 output tokens**, ~19.7 min.

### Bug caught by this run (fixed before the successful run)
The Workflow engine delivers the `args` global to the script as a **JSON string**, not an object.
The plan's verbatim `const A = args` therefore left `A` a string, `A.dial` undefined,
`DIALS[undefined]` undefined, and the script crashed at `DIAL.breaker` (line 75) in 12–28 ms with
zero agents run. Reproduced twice (run IDs `wf_0f081a45-904`, `wf_924bb499-e6b`). Fixed with a
parse-guard: `const A = typeof args === 'string' ? JSON.parse(args) : args`. This is load-bearing —
without it every production run through SKILL.md would die on arrival. Stub harness stays green
(it passes an object, so the guard is a no-op there).

### Gate-by-gate observations (claim → observed artifact)

- **All 5 passes completed** → return `completed_passes:[0,1,2,3,4]`, `counts:{candidates:18, drops:15, kills:0, survivors:3}`.
- **Burst returns summary + paths only (no artifact dumps)** → the workflow return carried a plain
  summary string + an `artifacts` array of 5 file paths; raw agent output stayed out of the caller.
- **`pass-0-system-map.md` names real files** → grep found `tracker/store.py`, `tracker/cli.py`,
  `tracker/__init__.py` (the actual toy files) — not inferred names.
- **`drops-log.md` exists, every drop has a reason-code** → 15 bullets, 15 with a `[stage / code]`
  tag; codes seen: `below-cut`, `dry-round-dedup`. Each bullet cites real evidence (e.g. `store.py:15`).
- **Kill report is symmetric and labels a single-family panel** → line 3:
  `> **SINGLE-FAMILY PANEL — all verdicts are from one AI family; unanimity counts for less.**`,
  and it explicitly caveats that "zero kills" is a weaker signal from one family. KILLS + SURVIVORS
  sections both present (0 kills, 3 survivors with demerits/safeguards/near-miss).
- **`final-plan.md` has all 8 sections + a probe per feature** → headers `## 1. System Overview`
  through `## 8. Verification Checklist` all present, plus `## Feature Probes` with a `live_probe`
  for each of the 3 survivors (c1 command, c2 grand-total row, c6 exact-decimal math). Each probe
  has an instruction and concrete `expected_evidence` (e.g. c6: prints exactly `0.30`, not
  `0.30000000000000004`).

### Not yet exercised (honest gaps)
- **Pass 5 (the build)** is driven by SKILL.md in the main session and was not run here — the live
  test covered the engine script (passes 0–4), which is the rebuilt core. Pass 5 logic is unchanged
  in shape from a normal implement→verify→commit loop.
- **The SKILL.md front-of-house** (engine gate, capability scan, 3 setup questions, checkpoint
  relay) was simulated by hand-built args, not driven interactively. It needs a fresh interactive
  Claude Code session to test as the real user experience (Task 11 Step 3 as written).

## Task 12: branch tests run (subset — the untested engine code paths)

Two cheap, high-value tests were run to cover engine paths the hands-off run skipped. Both passed,
no bugs. (The full B1–B8 matrix was deliberately not run — see the deferral note below.)

### B3 (budget soft-gate + partial-return) — ✅ PASS
Run `budget-test` on the toy with `budget_override: 250000` (feature ask: CSV export).
Result: `partial:true, completed_passes:[0,1,2]`, stopped with "Budget exhausted before Pass 3",
`resume_command:"discover: budget-test"`. On disk: `pass-0/1/2` + `drops-log.md` present with real
content (pass-2 kept 3, dropped extras); `pass-3-kill-report.md` correctly ABSENT (stop was before
Pass 3). 12 agents, 420k tokens. The soft-gate stops cleanly at a pass boundary and leaves a
correct, resumable on-disk state. (Unit note: `budget.spent()` meters output tokens while `passEst`
was sized against total spend, so the cap tripped later than a naive reading suggests — the
*mechanism* is correct; the exact trip point is a calibration nicety, logged for future tuning.)

### Disk resume + reparse (`from_pass:4`) — ✅ PASS
Relaunched `monthly-summary` with `from_pass:4, to_pass:4` against the existing completed run dir.
Result: `ok:true, completed_passes:[4]`. Bootstrap found the on-disk artifacts (found:true), the
`reparse-map` and `reparse-kill` agents reconstructed structured state from the saved markdown, and
Pass 4 re-ran to write a fresh `final-plan.md`. 7 agents, 260k tokens, 0 errors. This validates the
`from_pass > 0` branch and the markdown→structured reparse machinery that a Checkpoints/resume run
depends on.

### Deferred branch tests (run only if beta surfaces a bug)
B1 checkpoint-edit override, B2 kill+override, B4 mid-burst crash-resume, B5 broken booster,
B6 vanilla-user (no boosters), B7 outcome read-back, B8 old-run-dir message. Skipped to cap token
spend; the plan carries full recipes for each. The most load-bearing untested surface is the
SKILL.md front-of-house (engine gate, capability scan, 3 questions, burst launch) — it is
instructions to a Claude session, not runnable code, so it surfaces naturally in real use.

## Task 12 B9: budget calibration (partial — one dial measured)

The run journal (`journal.jsonl`) records per-agent *results* but not per-agent *token counts*, so a
precise per-pass split is not recoverable from it. What is measured: a full Light 0→4 run cost
**793,694 output tokens** across 21 agents and completed without tripping the 900k placeholder
breaker or overrunning any per-pass gate. So the Light envelope (breaker 900k; passEst summing to
870k) is empirically validated as reasonable, not just guessed. Standard and Deep remain
extrapolated (no run at those dials). The `DIALS` comment records this.
