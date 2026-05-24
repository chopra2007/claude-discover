# Layout Reference — discover

The skill supports two layout types. Both use the same per-pass workflow and produce identical `final-plan.md` output. The choice is how agents are dispatched.

---

## Tmux layout

The `discover.sh` helper creates a tmux session named `discover-<run-name>`. The orchestrator dispatches work into panes by sending keystrokes via `tmux send-keys`.

### Agent count and role mapping

The `--layout <n>` flag controls how many panes are created. Roles are assigned as follows:

| Count | Slots created |
|-------|--------------|
| 2 | orchestrator + architect-critic-researcher |
| 3 | orchestrator + architect-critic + researcher |
| 4 | orchestrator + architect + critic + researcher |
| 5 | orchestrator + architect + critic + researcher-1 + researcher-2 |
| 6 | orchestrator + architect + planner + critic + researcher-1 + researcher-2 |

With 5–6 agents, researchers run in parallel — that's the main parallelism win. With fewer agents, the orchestrator drives roles sequentially in combined panes.

### Dispatching work (tmux)

To send a task to another pane:

```bash
tmux send-keys -t discover-<run>:0.<pane-index> "<command>" C-m
```

Example — kick off two parallel researchers in Pass 0 (5 or 6 agents):

```bash
# Researcher 1 covers data + signal layers
tmux send-keys -t discover-reddit-sentiment:0.4 \
  "claude --model sonnet -p 'Read src/data/ and src/signals/, write a component inventory to .claude/discover/reddit-sentiment/scratch-r1.md'" C-m

# Researcher 2 covers output + config layers
tmux send-keys -t discover-reddit-sentiment:0.5 \
  "claude --model sonnet -p 'Read src/output/ and src/config/, write a component inventory to .claude/discover/reddit-sentiment/scratch-r2.md'" C-m
```

Don't block on a fixed timer for completion — that's wasteful for fast runs and inadequate for slow ones. Poll for scratch file content.

### Plan tier guidance

| Plan | Suggested agent count | Why |
|------|-----------------------|-----|
| **Pro (5-hr usage window)** | 2–3 | Fewer researchers = lower overhead; fits the window for most non-trivial runs |
| **Max** | 4–6 | More parallelism, faster wall-clock, no realistic budget concern |

You can override either way — the skill asks at startup. If you burn through your window mid-run, the saved `state.json` lets you resume on a new window.

---

## Native layout (no tmux required)

The native layout uses Claude Code's built-in parallel `Agent` / `Task` dispatch from `superpowers:dispatching-parallel-agents`. No tmux session is created — the orchestrator is the current Claude Code session itself.

### Agent count and role mapping

Same role table as tmux above. Each "slot" that would be a tmux pane is instead a named `Agent` invocation.

### Dispatching work (native)

Send all parallel agent calls in a **single message** so they run concurrently:

```
Agent(name="researcher-1", prompt="Read src/data/ and src/signals/...", ...)
Agent(name="researcher-2", prompt="Read src/output/ and src/config/...", ...)
```

Wait for both to complete before proceeding (the harness notifies you on completion). Then the orchestrator synthesizes the results, exactly as in tmux mode.

For sequential roles (architect → critic → planner on a combined slot), dispatch them in separate messages, waiting for each to complete before the next.

### Environment files (native)

The orchestrator writes per-agent env files to `${RUN_DIR}/.agent-<role>.env` using the same format as tmux pane env files. Agents read their role and model tier from these files. This keeps `state.json` recovery consistent between layout types.

---

## Why these model tiers

- **Opus** for orchestrator, architect, planner, critic: each decision propagates downstream. A wrong architectural call reaches Pass 4. Cheaping out is false economy.
- **Sonnet** for researchers: breadth-heavy work reviewed by an opus synthesizer. Right cost/quality balance.
- **Haiku** as fallback if opus is rate-limited, but expect quality degradation in synthesis steps.

## Why these tiers

- **Opus** for orchestrator, architect, planner, critic: each decision they make influences everything downstream. A wrong call from the architect propagates through Pass 4 and into Pass 5. Cheaping out here is false economy.
- **Sonnet** for researchers: the work is breadth-heavy (read N files, summarize) and the output is reviewed by an opus-tier synthesizer (architect). Sonnet is the right cost/quality balance.
- **Haiku** is fine as a fallback if opus is rate-limited, but expect quality degradation in synthesis steps.

## Cleanup

When a run completes (Pass 4 ends), the tmux session can be killed:

```bash
tmux kill-session -t discover-<run-name>
```

The orchestrator should NOT auto-kill — leave it to the user. They might want to review pane scrollback for debugging.
