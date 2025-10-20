# bun inspect CLI — Concise and Accurate Guide

bun inspect CLI is used to call and test MCP servers in script/automation environments. Below is the core syntax and commonly used method/argument patterns based on the official README.

Basic execution

- Local bundle (process execution)
  bun inspect --cli node build/index.js

- Select server from config file
  bun inspect --cli --config path/to/config.json --server myserver

Environment variables / Server arguments

- Pass environment variables
  bun inspect --cli -e KEY=val -e KEY2=val2 node build/index.js

- Pass server arguments (distinguish from inspector flags)
  bun inspect --cli -- node build/index.js --server-flag

Core method patterns

- Query type (simple)
  bun inspect --cli <target> --method tools/list
  bun inspect --cli <target> --method resources/list
  bun inspect --cli <target> --method prompts/list

  <target> is "node build/index.js" for local server execution or remote URL (e.g., https://host).

- Tool execution (tools/call)
  bun inspect --cli <target> --method tools/call --tool-name <name> [--tool-arg k=v ...]

Tool argument rules (truth only)

- Simple key=value
  --tool-arg key=val --tool-arg another=val2

- JSON / nested object passing
  Documentation does not mention CLI automatically supporting file inclusion like `@file.json`. That is, --tool-arg @file.json does not automatically read and expand the file.

  Alternative (recommended): Read file content in shell and make it one line (compact) for --tool-arg. Examples below.

  POSIX (bash/zsh) assuming jq installed:
  bun inspect --cli node build/index.js --method tools/call --tool-name mytool --tool-arg "payload=$(jq -c . file.json)"

  When jq is not available (simple newline removal):
  bun inspect --cli node build/index.js --method tools/call --tool-name mytool --tool-arg "payload=$(tr -d '\n' < file.json)"

  PowerShell (pwsh):
  $p = (Get-Content -Raw file.json).Trim(); bun inspect --cli node build/index.js --method tools/call --tool-name mytool --tool-arg "payload=$p"

- Control characters / multiline
  --tool-arg 'data="line1\nline2"'  # or escape appropriately in shell

Remote connection / transport method

- Default (remote URL) — SSE recommended
  bun inspect --cli https://my-mcp-server.example.com --method tools/list

- Streamable HTTP
  bun inspect --cli https://my-mcp-server.example.com --transport http --method tools/list

- Add headers
  bun inspect --cli https://... --header "Authorization: Bearer TOKEN" --method tools/list

Authentication / session token

- Session token output to console when starting Inspector Proxy.
- Token passing example: --header "Authorization: Bearer <token>" or env MCP_PROXY_AUTH_TOKEN=<hex>
- DANGEROUSLY_OMIT_AUTH is not recommended.

Main default tools (project example)

- start: input { command: string, pwd: string } → { processId, screen, exitCode }
- kill: input { processId } → { success }
- list: input none → { ptys: [ { id, status, createdAt, lastActivity, exitCode } ] }
- read: input { processId } → { screen }
- write_input: TWO MODES (mutually exclusive)
  - Safe mode (RECOMMENDED): { processId, input?, ctrlCode?, waitMs? }
    - input: Plain text without escape sequences (e.g., "print(2+2)")
    - ctrlCode: Named control codes (e.g., "Enter", "Escape", "Ctrl+C") or raw bytes (e.g., "\n", "\x1b")
    - Example: --tool-arg processId=proc_123 --tool-arg input="2+2" --tool-arg ctrlCode="Enter"
  - Raw mode: { processId, data, waitMs? }
    - data: Raw bytes with escape sequences (e.g., "line1\nline2\n")
    - Example: --tool-arg processId=proc_123 --tool-arg 'data="hello\nworld\n"'
  - Output: { screen, cursor:{x,y}, exitCode, warning? }

Output·debugging

- CLI outputs JSON to stdout. Parse with jq or reuse in scripts.
- Timeout/progress settings: Adjustable via env vars like MCP_SERVER_REQUEST_TIMEOUT.

Token efficiency tips

- Use only --method for simple queries. Reduce unnecessary serialization.
- Save complex payloads to files then read via shell commands.
- Encapsulate repeated commands in small wrapper scripts.

Reference
- Official README (original): https://raw.githubusercontent.com/modelcontextprotocol/inspector/refs/heads/main/README.md
