# mcp-pty

MCP (Model Context Protocol) server for PTY session management with Bun runtime.

## Installation

```bash
bun add mcp-pty
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
- Dual-mode input API (safe mode with named control codes + raw mode)

## API Examples

### Interactive Input with `write_input`

The `write_input` tool supports two modes:

#### Safe Mode (Recommended)

Separates plain text from control codes to prevent escape sequence confusion:

```json
{
  "method": "tools/call",
  "params": {
    "name": "write_input",
    "arguments": {
      "processId": "proc_xxx",
      "input": "print(2+2)",
      "ctrlCode": "Enter"
    }
  }
}
```

**Available control codes:**
- Line: `Enter`, `Return`, `Tab`
- Navigation: `Escape`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- Control keys: `Ctrl+C`, `Ctrl+D`, `Ctrl+A`, `Ctrl+E`, `Ctrl+U`, `Ctrl+W`, etc.
- Raw sequences: `"\n"`, `"\x1b"`, `"\x03"`, etc.

**Examples:**

```json
// Execute Python command
{"processId": "proc_xxx", "input": "x = 10", "ctrlCode": "Enter"}

// Interrupt process
{"processId": "proc_xxx", "ctrlCode": "Ctrl+C"}

// Navigate history
{"processId": "proc_xxx", "ctrlCode": "ArrowUp"}

// Vim: Exit insert mode
{"processId": "proc_xxx", "ctrlCode": "Escape"}
```

#### Raw Mode

For advanced use cases (multiline text, ANSI codes, binary data):

```json
{
  "method": "tools/call",
  "params": {
    "name": "write_input",
    "arguments": {
      "processId": "proc_xxx",
      "data": "line1\nline2\nline3\n"
    }
  }
}
```

**Note:** `data` and `input`/`ctrlCode` are mutually exclusive.

## Requirements

- Bun >= 1.0.0
- TypeScript >= 5.0

## License

MIT
