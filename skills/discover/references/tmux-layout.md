# Tmux Layout — discover

The `discover.sh` helper creates a tmux session named `discover-<run-name>` with one of two layouts. The orchestrator dispatches work into panes by sending keystrokes via `tmux send-keys`.

## Picking a layout — Pro vs Max

The choice is mostly about your Claude plan and how much budget you want to spend on a single run.

| Plan | Recommended | Why |
|------|-------------|-----|
| **Pro (5-hr usage window)** | 3-pane | A 6-pane run with parallel researchers will eat the 5-hour limit fast. 3-pane is roughly half the agent overhead. |
| **Max** | 6-pane | More parallelism, faster wall-clock, no realistic budget concern. |

You can override either way — the skill asks at startup. If the user picks 6-pane on Pro and burns through their window mid-run, the saved `state.json` lets them resume on a new window.

---

## 6-pane layout

Indexes are tmux's internal pane indexes after `select-layout tiled`. They're stable as long as panes aren't killed mid-run.

| Pane | Role | Default model | Reads env from |
|------|------|---------------|----------------|
| 0.0 | orchestrator | opus | `.orchestrator.env` |
| 0.1 | architect | opus | `.architect.env` |
| 0.2 | planner | opus | `.planner.env` |
| 0.3 | critic | opus | `.critic.env` |
| 0.4 | researcher-1 | sonnet | `.researcher-1.env` |
| 0.5 | researcher-2 | sonnet | `.researcher-2.env` |

Researchers run in parallel — that's the main point of this layout.

## 3-pane layout

| Pane | Role | Default model | Reads env from |
|------|------|---------------|----------------|
| 0.0 | orchestrator | opus | `.orchestrator.env` |
| 0.1 | architect-critic | opus | `.architect-critic.env` |
| 0.2 | researcher | sonnet | `.researcher.env` |

The `architect-critic` pane wears three hats sequentially: architect for design, critic for adversarial review, planner for sequencing. The orchestrator changes its prompt between phases. The researcher pane handles all research (codebase + external) sequentially.

---

## Dispatching work

The orchestrator pane is the one the user is interactively connected to. To send a task to another pane:

```bash
tmux send-keys -t discover-<run>:0.<pane-index> "<command>" C-m
```

Example — kick off two parallel researchers in Pass 0 (6-pane mode):

```bash
# Researcher 1 covers data + signal layers
tmux send-keys -t discover-reddit-sentiment:0.4 \
  "claude --model sonnet -p 'Read src/data/ and src/signals/, write a component inventory to .claude/discover/reddit-sentiment/scratch-r1.md'" C-m

# Researcher 2 covers output + config layers
tmux send-keys -t discover-reddit-sentiment:0.5 \
  "claude --model sonnet -p 'Read src/output/ and src/config/, write a component inventory to .claude/discover/reddit-sentiment/scratch-r2.md'" C-m
```

In 3-pane mode the same Pass 0 work runs in two sequential dispatches to pane `0.2`:

```bash
tmux send-keys -t discover-reddit-sentiment:0.2 \
  "claude --model sonnet -p 'Read src/data/ and src/signals/, write to scratch-r1.md'" C-m
# wait for completion (poll for scratch-r1.md non-trivial content)
tmux send-keys -t discover-reddit-sentiment:0.2 \
  "claude --model sonnet -p 'Read src/output/ and src/config/, write to scratch-r2.md'" C-m
```

Don't block on a fixed timer for completion — that's wasteful for fast runs and inadequate for slow ones. Poll for scratch file content.

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
