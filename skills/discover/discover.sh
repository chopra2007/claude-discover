#!/usr/bin/env bash
# discover.sh — Set up the tmux session for a discover run.
# Idempotent: re-running on an existing session attaches instead of recreating.
#
# Usage:
#   ./discover.sh <run-name> [--layout 3|6]
#
# Layouts:
#   --layout 6 (default, Max plan equivalent — full parallel)
#       ┌─────────────────┬─────────────────┐
#       │  orchestrator   │    architect    │
#       │     (opus)      │     (opus)      │
#       ├─────────────────┼─────────────────┤
#       │     planner     │     critic      │
#       │     (opus)      │     (opus)      │
#       ├─────────────────┼─────────────────┤
#       │  researcher-1   │  researcher-2   │
#       │    (sonnet)     │    (sonnet)     │
#       └─────────────────┴─────────────────┘
#
#   --layout 3 (Pro plan equivalent — lean, sequential)
#       ┌─────────────────────────────────────┐
#       │           orchestrator              │
#       │              (opus)                 │
#       ├─────────────────┬───────────────────┤
#       │ architect-critic│    researcher     │
#       │     (opus)      │     (sonnet)      │
#       └─────────────────┴───────────────────┘

set -euo pipefail

usage() {
  echo "Usage: $0 <run-name> [--layout 3|6]" >&2
  exit 1
}

RUN_NAME="${1:-}"
[ -z "${RUN_NAME}" ] && usage
shift

LAYOUT=6
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

if [ "${LAYOUT}" != "3" ] && [ "${LAYOUT}" != "6" ]; then
  echo "Error: --layout must be 3 or 6 (got: ${LAYOUT})" >&2
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

if [ "${LAYOUT}" = "6" ]; then
  write_pane_env orchestrator    opus
  write_pane_env architect       opus
  write_pane_env planner         opus
  write_pane_env critic          opus
  write_pane_env researcher-1    sonnet
  write_pane_env researcher-2    sonnet
else
  write_pane_env orchestrator      opus
  write_pane_env architect-critic  opus
  write_pane_env researcher        sonnet
fi

# If session exists, just attach.
if tmux has-session -t "${SESSION}" 2>/dev/null; then
  echo "Session ${SESSION} already exists — attaching."
  exec tmux attach-session -t "${SESSION}"
fi

# Build the layout.
tmux new-session -d -s "${SESSION}" -n discover -c "$(pwd)"

if [ "${LAYOUT}" = "6" ]; then
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
else
  tmux send-keys    -t "${SESSION}:0.0" "echo 'orchestrator pane (opus) — run: ${RUN_NAME}'" C-m
  tmux split-window -t "${SESSION}:0.0" -v -c "$(pwd)"
  tmux send-keys    -t "${SESSION}:0.1" "echo 'architect-critic pane (opus)'" C-m
  tmux split-window -t "${SESSION}:0.1" -h -c "$(pwd)"
  tmux send-keys    -t "${SESSION}:0.2" "echo 'researcher pane (sonnet)'" C-m
fi

tmux select-layout -t "${SESSION}:0" tiled

echo "Session ${SESSION} created with --layout ${LAYOUT}. Run dir: ${RUN_DIR}"
echo "Attach with:  tmux attach -t ${SESSION}"
