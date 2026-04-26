# Kickoff Prompt Template — Pass 5

This is the template the orchestrator fills in at the end of Pass 4 and writes to `EXECUTE.md`. The user pastes the *filled* version into a fresh Claude Code session to start Pass 5.

## Filling instructions

Replace these placeholders before writing `EXECUTE.md`:

- `{{RUN_NAME}}` — the kebab-case run name
- `{{RUN_DIR}}` — absolute path to `.claude/discover/<run-name>/`
- `{{PLAN_PATH}}` — absolute path to `final-plan.md`
- `{{ACTIVATION_SUMMARY}}` — one-sentence summary of what flipping the feature on entails (e.g. "set `enable_reddit_sentiment: true` and restart `tradebot.service`")
- `{{GIT_REMOTE}}` — the result of `git remote get-url origin 2>/dev/null` or `(no remote configured)`

## Template

```
discover: resume Pass 5 (execution) for run `{{RUN_NAME}}`.

Plan file: {{PLAN_PATH}}
Run directory: {{RUN_DIR}}
Activation: {{ACTIVATION_SUMMARY}}
Git remote: {{GIT_REMOTE}}

Execute the plan autonomously per the discover skill's Pass 5 instructions:

1. Read `final-plan.md` and `state.json`. If anything is missing or contradictory, ask once and stop.
2. Use `/oh-my-claudecode:ralph` to implement the plan, looping until the verification checklist in section 8 of the plan passes. Inside ralph: executor for code, test-engineer for tests, verifier for the checklist.
3. Once verification passes, perform the Feature Activation Plan from section 7: flip the config flags, restart/reload the running service, tail logs for 30s, confirm the new feature is firing.
4. If a GitHub remote exists, stage all changes, commit with a message summarizing the feature(s) added (reference the run name), and push directly to the current branch. No PR. If push fails, surface the error and stop.
5. Append a final report to `pass-5-execution-log.md` covering: files changed, test results, activation log excerpts, commit SHA, push status, and any issues.

Only ask me for input on real ambiguity:
- Plan-vs-reality structural mismatch
- Test failure that signals a design flaw rather than a code bug
- Git auth that needs interactive input
- Service restart failure with unclear rollback path

Otherwise, plow through.
```

The leading `discover:` ensures the skill re-activates in the new session and recognizes this as a Pass 5 resume rather than a fresh run.
