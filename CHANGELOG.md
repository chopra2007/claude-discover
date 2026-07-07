# Changelog

All notable changes to the **discover** plugin are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/), and the project
uses [semantic versioning](https://semver.org/).

## [1.2.0] — 2026-07-07

### Added
- **Per-seat model + thinking-depth.** Each of the ~20 helper roles now runs on a model matched to
  its job instead of inheriting the session model: Haiku for mechanical read/format/parse, Sonnet
  for faithful code reads and the big parallel pools, Opus for the reasoning seats, and Fable only
  for the two make-or-break judges (which idea to kill, which plan wins).
- **Model-tier dial (`Quick` / `Balanced` / `Max`).** A ceiling on how strong the two judges may
  get — Quick caps at Opus (never Fable), Balanced reaches Fable only when a decision is genuinely
  hard, Max uses Fable at full depth. Distinct from Thoroughness (how many agents). The mechanical
  steps stay on the cheap fast model at every tier; the judges' effort auto-tunes to run complexity.
- **Optional per-judge pins.** Power users can hand-pin a judge inline (`discover: <name>
  judge=fable:max`, `plan-judge=opus:high`) or set the tier (`tier=max`), or hand-tune both judges
  through a follow-up prompt.
- **Batched click-to-choose setup.** The fixed setup choices (Thoroughness, Model tier, Reviews,
  Build-now/Stop) come as a single AskUserQuestion; only the free-text run name stays prose.

### Changed
- **Run style → review points.** The rigid Hands-off / Checkpoints / Plan-only choice became a
  multi-select of plain-English pause points (after the shortlist is pre-checked; after the
  kill-test; rarely, after the map or research) plus a Build-now/Stop choice. All three original
  modes are preserved; the finished plan is always shown for one OK before any code is written.
- **`approach-enum`** upgraded from Haiku to Opus — it gates whether the plan tournament runs at
  all, so a wrong call there is costly.

### Fixed
- **Silent corruption on an API error — now systemic.** The engine returns `null` from an agent
  only when it dies on a terminal API error (a real empty result is still a structured object), so a
  `null` always means "died". The run now records those deaths and halts loud + resumable at the next
  pass boundary — at *any* pass, not just Pass 0 — instead of continuing on missing data or letting a
  downstream step fabricate results. Critical parallel pools abort on a total wipeout; partial losses
  log and continue. A dead redundancy verifier keeps the candidate (never drop an unverified claim),
  which also removes a latent crash that could take down all of Pass 2.
- **dry-judge hardening** — the round dedup step is now explicitly "not a generator": it may only
  return a subset of the candidates it was handed, never invent one, even when the list is empty.
- **Gemini CLI invocation** — the cross-model call and the booster-health probe now pass
  `--skip-trust -y -m gemini-flash-latest`; without the flags the CLI hangs on a trust prompt and the
  probe would false-negative Gemini as broken.

## [1.1.0] — 2026-07-02

Complete rebuild onto Claude Code's built-in **Workflow engine** (passes 0–4). tmux removed
entirely; OMC / superpowers / Codex / Gemini are now fully optional boosters. Added the
evidence-rule kill-test (an objection kills only on evidence inspected this run — no vote), the plan
tournament, the Pass-5 probe gate, and cross-run outcome memory. Disk artifacts under
`.claude/discover/<run>/` are the source of truth; the engine journal is a throwaway cache.

## [0.1.x] — pre-2026-07

The original tmux-based skill that composed OMC + superpowers across multi-agent tmux panes. Later
gained a verification-before-completion gate in Pass 5, a non-tmux native parallel-agent option, and
a one-line kickoff prompt. Superseded by 1.1.0.

[1.2.0]: https://github.com/chopra2007/claude-discover/releases/tag/v1.2.0
[1.1.0]: https://github.com/chopra2007/claude-discover/releases/tag/v1.1.0
