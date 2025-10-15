# tmux Pane Capture

## Basic Usage

```bash
# Capture visible content of specific pane
tmux capture-pane -p -t <session>:<window>.<pane>

# Example: window 9, pane 1 of session "main"
tmux capture-pane -p -t main:9.1

# Capture full scrollback history
tmux capture-pane -p -S - -E - -t main:9.1
```

## Pane Identification

```bash
# List sessions
tmux ls

# Show current pane ID
tmux display-message -p '#{pane_id}'

# List all panes in session
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_id}'
```

## Notes

- Snapshot only (not real-time)
- TUI apps (btop, htop) may include ANSI codes
- Use `-e` flag to preserve escape sequences
