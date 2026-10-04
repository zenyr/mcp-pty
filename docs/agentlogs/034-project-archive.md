## Project Archive Decision

### Initial Approach
Repo grooming after ~1 year idle: type-check, lint, tests, coding-rules gates.

### Issues Identified
- Tests green (237 pass), but #79 handler refactor half-finished: production uses legacy `tools/`/`resources/`, new `server/registrar.ts` path test-only; two schema copies already diverged (`asCRLF`, control-codes resource missing in new path).
- `normalize-commands` logs to stdout (corrupts stdio JSON-RPC) and branches on error message text.
- Input safety filter bypassable (any SGR code skips validation).
- 6 packages for ~3.9k LOC core.

### Rewrite Considered
Single-package rewrite planned, then dropped: project premise obsolete.

### Switched to Archive
- Bun 1.4 native PTY (`Bun.spawn({ terminal })`) verified locally: tty allocated, stdin write + output read work. `@zenyr/bun-pty` fork unnecessary.
- Agent harnesses now ship async/interactive PTY; tmux covers shell-capable harnesses lacking it.
- Remaining niche (shell-less MCP clients) judged not worth remote-shell risk.

### Implementation Details
- Archive notice added to root and package READMEs.
- Follow-up (manual): `npm deprecate mcp-pty`, GitHub repo archive.
