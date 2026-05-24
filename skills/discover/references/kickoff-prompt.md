# Kickoff Prompt Template — Pass 5

This is the template the orchestrator fills in at the end of Pass 4 and writes to `EXECUTE.md`. The user types a **single short line** into a fresh Claude Code session to start Pass 5 — they do NOT paste the contents of `EXECUTE.md`. The skill reads `EXECUTE.md` from disk when it re-activates.

## What to write to EXECUTE.md

Replace the placeholders below before writing the file:

- `{{RUN_NAME}}` — the kebab-case run name
- `{{RUN_DIR}}` — absolute path to `.claude/discover/<run-name>/`
- `{{PLAN_PATH}}` — absolute path to `final-plan.md`
- `{{ACTIVATION_SUMMARY}}` — one-sentence summary of what flipping the feature on entails (e.g. "set `enable_reddit_sentiment: true` and restart `tradebot.service`")
- `{{GIT_REMOTE}}` — the result of `git remote get-url origin 2>/dev/null` or `(no remote configured)`

## Template (written to EXECUTE.md)

```
# discover — Pass 5 context for run: {{RUN_NAME}}
# Loaded automatically when the user runs: discover: resume {{RUN_NAME}}

RUN_NAME={{RUN_NAME}}
RUN_DIR={{RUN_DIR}}
PLAN_PATH={{PLAN_PATH}}
ACTIVATION={{ACTIVATION_SUMMARY}}
GIT_REMOTE={{GIT_REMOTE}}

## Instructions for the skill (Pass 5)

1. Read `final-plan.md` at {{PLAN_PATH}} and `state.json` in {{RUN_DIR}}. If anything is missing or contradictory, ask once and stop.
2. Use `/oh-my-claudecode:ralph` to implement the plan, looping until the verification checklist in section 8 of the plan passes. Inside ralph: executor for code, test-engineer for tests, verifier for the checklist.
3. Once verification passes, perform the Feature Activation Plan from section 7: flip the config flags, restart/reload the running service, tail logs for 30s, confirm the new feature is firing.
4. Invoke `superpowers:verification-before-completion` — confirm the checklist is fully satisfied before committing.
5. If a GitHub remote exists ({{GIT_REMOTE}}), stage all changes, commit with a message summarizing the feature(s) added (reference the run name), and push directly to the current branch. No PR. If push fails, surface the error and stop.
6. Append a final report to `pass-5-execution-log.md` covering: files changed, test results, activation log excerpts, commit SHA, push status, and any issues.

Only ask for input on real ambiguity:
- Plan-vs-reality structural mismatch
- Test failure that signals a design flaw rather than a code bug
- Git auth that needs interactive input
- Service restart failure with unclear rollback path

Otherwise, plow through.
```

## What the user sees in chat (at the end of Pass 4)

Print this — and only this — to the chat as the kickoff instruction. Do NOT ask the user to copy-paste `EXECUTE.md`'s contents.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Plan saved to: {{PLAN_PATH}}
✅ Pass 5 context saved to: {{RUN_DIR}}/EXECUTE.md

Open a fresh Claude Code session and type:

    discover: resume {{RUN_NAME}}

The skill will re-activate and read EXECUTE.md from disk.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The leading `discover:` ensures the skill re-activates in the new session and recognizes this as a Pass 5 resume rather than a fresh run. The `EXECUTE.md` file is the context; the one-liner is the trigger.
