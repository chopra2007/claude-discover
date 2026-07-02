# Kickoff Prompt Template — Pass 5 (Plan-only handoff)

This is the template the Pass 4 synthesizer fills in and writes to `EXECUTE.md` when the run
style is **Plan-only**. The user types a **single short line** into a fresh Claude Code session
to start the build — they do NOT paste the contents of `EXECUTE.md`. The skill reads `EXECUTE.md`
from disk when it re-activates.

## What to write to EXECUTE.md

Replace the placeholders below before writing the file:

- `{{RUN_NAME}}` — the kebab-case run name
- `{{RUN_DIR}}` — absolute path to `.claude/discover/<run-name>/`
- `{{PLAN_PATH}}` — absolute path to `final-plan.md`
- `{{ACTIVATION_SUMMARY}}` — one-sentence summary of what flipping the feature on entails (e.g. "set `enable_reddit_sentiment: true` and restart `tradebot.service`")

## Template (written to EXECUTE.md)

```
# discover — Pass 5 context for run: {{RUN_NAME}}
# Loaded automatically when the user runs: discover: build {{RUN_NAME}}

RUN_NAME={{RUN_NAME}}
RUN_DIR={{RUN_DIR}}
PLAN_PATH={{PLAN_PATH}}
ACTIVATION={{ACTIVATION_SUMMARY}}

## Instructions for the skill (Pass 5)

1. Read `final-plan.md` at {{PLAN_PATH}} and `state.json` in {{RUN_DIR}}. If anything is missing or contradictory, ask once and stop.
2. Implement in a loop until the plan's Verification Checklist passes. If OMC's ralph is present and healthy, use it; otherwise run the built-in loop (implement → test → a FRESH verifier agent, never the implementer, checks the checklist → fix → repeat).
3. PROBE GATE — before any commit, run every probe in the plan's Feature Probes section: a live_probe is executed and its real output compared to the expected evidence; a deferred_probe first has its named prerequisite verified as genuinely absent (a deferral with a present prerequisite is void — run it). Record every result in `pass-5-execution-log.md`.
4. ASK BEFORE COMMIT — one message enumerating every probe (✅ ran, with a one-line evidence note / ⏸ deferred, with the reason). Wait for the user's OK. Then commit; push only if a github remote exists (skip with a note otherwise). On push failure, surface the exact next step — never force-push.
5. Write `outcome.json` to {{RUN_DIR}}: every candidate that entered the kill-test, with its verdict (shipped + commit SHA / killed + reason / deferred + reason).
6. Append a final report to `pass-5-execution-log.md`: files changed, test results, probe evidence, commit SHA, push status, and any open issues.

Only ask for input on real ambiguity:
- Plan-vs-reality structural mismatch
- Test failure that signals a design flaw rather than a code bug
- Git auth that needs interactive input
- Service restart failure with unclear rollback path

Otherwise, plow through.
```

## What the user sees in chat (at the end of Pass 4, Plan-only)

Print this — and only this — to the chat as the kickoff instruction. Do NOT ask the user to copy-paste `EXECUTE.md`'s contents.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Plan saved to: {{PLAN_PATH}}
✅ Pass 5 context saved to: {{RUN_DIR}}/EXECUTE.md

Open a fresh Claude Code session and type:

    discover: build {{RUN_NAME}}

The skill will re-activate and read EXECUTE.md from disk.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The leading `discover:` ensures the skill re-activates in the new session and recognizes this as a Pass 5 build rather than a fresh run. The `EXECUTE.md` file is the context; the one-liner is the trigger.
