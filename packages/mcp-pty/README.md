# mcp-pty-server

MCP (Model Context Protocol) server for PTY session management with Bun runtime.

## Installation

```bash
bun add mcp-pty-server
```

## Usage

### With Bun (Recommended)

```bash
bunx mcp-pty
```

Or via MCP client config:

```json
{
  "mcpServers": {
    "pty": {
      "command": "bunx",
      "args": ["mcp-pty"]
    }
  }
}
```

### With Node.js

Requires transpilation - not recommended. Use Bun for optimal performance.

## Features

- PTY session management (create, execute, resize, close)
- ANSI escape code handling with xterm.js
- Session-based command execution
- Real-time output streaming
- Safe command execution with validation

## Requirements

- Bun >= 1.0.0
- TypeScript >= 5.0

## License

MIT
