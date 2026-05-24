#!/usr/bin/env bash
# discover.sh — Set up the tmux session for a discover run.
# Idempotent: re-running on an existing session attaches instead of recreating.
#
# Usage:
#   ./discover.sh <run-name> [--layout <2-6>]
#
# --layout <n>  Number of parallel agents (2–6). Default: 3.
#
# Role assignments by agent count:
#   2: orchestrator + architect-critic-researcher
#   3: orchestrator + architect-critic + researcher
#   4: orchestrator + architect + critic + researcher
#   5: orchestrator + architect + critic + researcher-1 + researcher-2
#   6: orchestrator + architect + planner + critic + researcher-1 + researcher-2
#
# Researchers (sonnet) run in parallel at count ≥ 5.
# Reasoning roles (architect, planner, critic) are opus.
# With fewer agents, combined panes wear multiple hats sequentially.

set -euo pipefail

usage() {
  echo "Usage: $0 <run-name> [--layout 2|3|4|5|6]" >&2
  exit 1
}

RUN_NAME="${1:-}"
[ -z "${RUN_NAME}" ] && usage
shift

LAYOUT=3
while [ $# -gt 0 ]; do
  case "$1" in
    --layout)
      LAYOUT="${2:-}"
      shift 2
      ;;
    --layout=*)
      LAYOUT="${1#--layout=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

if ! [[ "${LAYOUT}" =~ ^[2-6]$ ]]; then
  echo "Error: --layout must be 2, 3, 4, 5, or 6 (got: ${LAYOUT})" >&2
  exit 1
fi

SESSION="discover-${RUN_NAME}"
RUN_DIR=".claude/discover/${RUN_NAME}"

mkdir -p "${RUN_DIR}"

# Per-pane env files so each agent knows its role and tier.
write_pane_env() {
  local role="$1" tier="$2"
  cat > "${RUN_DIR}/.${role}.env" <<EOF
DISCOVER_RUN=${RUN_NAME}
DISCOVER_ROLE=${role}
DISCOVER_MODEL_TIER=${tier}
DISCOVER_RUN_DIR=${RUN_DIR}
DISCOVER_LAYOUT=${LAYOUT}
EOF
}

# Write env files based on agent count
case "${LAYOUT}" in
  2)
    write_pane_env orchestrator                opus
    write_pane_env architect-critic-researcher opus
    ;;
  3)
    write_pane_env orchestrator      opus
    write_pane_env architect-critic  opus
    write_pane_env researcher        sonnet
    ;;
  4)
    write_pane_env orchestrator  opus
    write_pane_env architect     opus
    write_pane_env critic        opus
    write_pane_env researcher    sonnet
    ;;
  5)
    write_pane_env orchestrator   opus
    write_pane_env architect      opus
    write_pane_env critic         opus
    write_pane_env researcher-1   sonnet
    write_pane_env researcher-2   sonnet
    ;;
  6)
    write_pane_env orchestrator   opus
    write_pane_env architect      opus
    write_pane_env planner        opus
    write_pane_env critic         opus
    write_pane_env researcher-1   sonnet
    write_pane_env researcher-2   sonnet
    ;;
esac

# If session exists, just attach.
if tmux has-session -t "${SESSION}" 2>/dev/null; then
  echo "Session ${SESSION} already exists — attaching."
  exec tmux attach-session -t "${SESSION}"
fi

# Build the layout.
tmux new-session -d -s "${SESSION}" -n discover -c "$(pwd)"

case "${LAYOUT}" in
  2)
    tmux send-keys    -t "${SESSION}:0.0" "echo 'orchestrator pane (opus) — run: ${RUN_NAME}'" C-m
    tmux split-window -t "${SESSION}:0.0" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.1" "echo 'architect-critic-researcher pane (opus)'" C-m
    ;;
  3)
    tmux send-keys    -t "${SESSION}:0.0" "echo 'orchestrator pane (opus) — run: ${RUN_NAME}'" C-m
    tmux split-window -t "${SESSION}:0.0" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.1" "echo 'architect-critic pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.1" -h -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.2" "echo 'researcher pane (sonnet)'" C-m
    ;;
  4)
    tmux send-keys    -t "${SESSION}:0.0" "echo 'orchestrator pane (opus) — run: ${RUN_NAME}'" C-m
    tmux split-window -t "${SESSION}:0.0" -h -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.1" "echo 'architect pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.0" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.2" "echo 'critic pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.1" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.3" "echo 'researcher pane (sonnet)'" C-m
    ;;
  5)
    tmux send-keys    -t "${SESSION}:0.0" "echo 'orchestrator pane (opus) — run: ${RUN_NAME}'" C-m
    tmux split-window -t "${SESSION}:0.0" -h -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.1" "echo 'architect pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.0" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.2" "echo 'critic pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.1" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.3" "echo 'researcher-1 pane (sonnet)'" C-m
    tmux split-window -t "${SESSION}:0.2" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.4" "echo 'researcher-2 pane (sonnet)'" C-m
    ;;
  6)
    tmux send-keys    -t "${SESSION}:0.0" "echo 'orchestrator pane (opus) — run: ${RUN_NAME}'" C-m
    tmux split-window -t "${SESSION}:0.0" -h -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.1" "echo 'architect pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.0" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.2" "echo 'planner pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.1" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.3" "echo 'critic pane (opus)'" C-m
    tmux split-window -t "${SESSION}:0.2" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.4" "echo 'researcher-1 pane (sonnet)'" C-m
    tmux split-window -t "${SESSION}:0.3" -v -c "$(pwd)"
    tmux send-keys    -t "${SESSION}:0.5" "echo 'researcher-2 pane (sonnet)'" C-m
    ;;
esac

tmux select-layout -t "${SESSION}:0" tiled

echo "Session ${SESSION} created with --layout ${LAYOUT} (${LAYOUT} agents). Run dir: ${RUN_DIR}"
echo "Attach with:  tmux attach -t ${SESSION}"
