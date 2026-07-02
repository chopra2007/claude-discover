# Artifact inventory — the run directory

Every discover run keeps all its work under `.claude/discover/<run-name>/`. That folder is the
source of truth: it survives a crashed session, a slept laptop, or a context compaction. The
Workflow engine's own memory is a throwaway cache — only these files are permanent.

This file lists every artifact, who writes it, and roughly what goes in it. The *shapes* of the
structured data live in the pipeline script (`workflows/discover-pipeline.js`) — this file does
not repeat them, so the two can never drift.

---

## `state.json` — the run's control record
- **Written by:** the main session (SKILL.md), at startup and after every burst.
- **When:** created in startup step 6; updated after each Workflow burst returns.
- Holds `format_version: 2`, the run name, the thoroughness dial, the run style, the created
  timestamp, which pass is current, the list of bursts run so far (from/to/ok/partial), and the
  booster status line. This is what a resume reads first to know where the run left off.

## `pass-0-system-map.md` — what already exists
- **Written by:** the Pass 0 synthesizer (inside the engine).
- **When:** the moment Pass 0 finishes (skipped entirely on a greenfield project).
- A plain-language inventory of the current system: each component and what it does, the data
  sources in use, the real gaps (only things truly absent), and a separate "inferred but not
  verified" list for anything guessed from a filename rather than read.

## `pass-1-candidates.md` — the wide net
- **Written by:** the Pass 1 synthesizer.
- **When:** the moment research finishes (bounded rounds, stops when a round finds nothing new).
- The full, unfiltered list of candidate features. Each one names its function, why it's worth
  considering for *this* system, its source quality (high / medium / low), and the sources.

## `pass-2-filtered.md` — the shortlist
- **Written by:** the Pass 2 synthesizer.
- **When:** after the filter ranks candidates and an independent verifier checks any "already
  exists" claims against real code.
- The kept candidates, ranked, each with its failure modes, the safeguards to bake in, and any
  note from a prior run's outcome. Includes the redundancy-verifier's evidence for anything it
  confirmed or rescued.

## `drops-log.md` — nothing disappears silently
- **Written by:** the drop-logger (appended to by any pass that cuts something).
- **When:** every time a candidate is dropped, in any pass.
- One bullet per dropped candidate: its name, the stage and reason-code, the plain reason, and
  the evidence pointer. This is the audit trail — the user can always see why an idea is gone.

## `pass-3-kill-report.md` — the adversarial verdict
- **Written by:** the Pass 3 synthesizer.
- **When:** after the skeptic panel, the advocate defense, and the judge finish.
- Two symmetric sections. KILLS: each killed idea with the objection, the evidence, the
  advocate's rebuttal, the judge's reason, and whether a cross-model family disputed the kill.
  SURVIVORS: each with its demerits, safeguards, the strongest objection it faced and how that
  resolved, and any cross-family note. A single-family panel is labelled prominently at the top.

## `build-next.md` — the backlog
- **Written by:** the Pass 4 synthesizer.
- **When:** only when more survivors passed the kill-test than the build cap (top 3).
- The ranked survivors beyond the build cap. Never deleted — the human can promote one into the
  next run.

## `final-plan.md` — the build spec
- **Written by:** the Pass 4 synthesizer.
- **When:** at the end of Pass 4.
- The build-ready plan Pass 5 reads: all eight required sections in order (System Overview,
  Component Architecture, Data Flow Pipeline, Data Structures, Integration Plan, Failure
  Handling, Feature Activation Plan, Verification Checklist), then a "Feature Probes" section
  with every feature's probe verbatim, then (if a plan tournament ran) the tournament notes.

## `EXECUTE.md` — the separate-session kickoff (Plan-only runs)
- **Written by:** the Pass 4 synthesizer, only in Plan-only run style.
- **When:** at the end of Pass 4 when the user chose to stop at the plan.
- The one-screen handoff a fresh session reads: run name, absolute path to `final-plan.md`, a
  short activation summary, and the one-line trigger `discover: build <name>`.

## `checkpoint-edits.md` — the human's overrides
- **Written by:** the main session, at any review checkpoint.
- **When:** whenever the user changes something at a shortlist / kill / plan review.
- The user's decisions, verbatim, under a dated heading ("drop candidate 3", "overrule that
  kill of X"). The next burst reads this and applies it literally — an overruled kill re-enters
  planning with its objection attached as a safeguard.

## `outcome.json` — how discover remembers
- **Written by:** the main session, at the end of Pass 5.
- **When:** after the build finishes.
- Shape:
  ```json
  {
    "run": "<run-name>",
    "closed": "<date>",
    "candidates": [
      { "name": "<feature>", "verdict": "shipped", "detail": "<commit SHA>" },
      { "name": "<feature>", "verdict": "killed",  "detail": "<short kill reason>" },
      { "name": "<feature>", "verdict": "deferred","detail": "<deferral reason>" }
    ]
  }
  ```
  Every candidate that entered Pass 3 gets a verdict. Future runs on this repo read every
  `outcome.json` and surface the prior verdicts next to matching candidates — but never
  auto-drop because of them (reasons go stale).

## `pass-5-execution-log.md` — the build record
- **Written by:** the main session, during and after Pass 5.
- **When:** as the build runs.
- Files changed, test results, the actual probe output for every feature, the commit SHA and
  push status, and any open issues.
