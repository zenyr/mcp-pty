# Use Cases

## Dev Server

Start a Node.js development server using the `start_pty` tool.

Example MCP request:

```json
{
  "method": "tools/call",
  "params": {
    "name": "start_pty",
    "arguments": {
      "command": "npm run dev",
      "cwd": "/path/to/project"
    }
  }
}
```

This will start the dev server in a PTY and return the PTY ID for monitoring.

## Interactive Tools

Run interactive terminal applications like htop or vim.

### htop

```json
{
  "method": "tools/call",
  "params": {
    "name": "start_pty",
    "arguments": {
      "command": "htop"
    }
  }
}
```

### vim

```json
{
  "method": "tools/call",
  "params": {
    "name": "start_pty",
    "arguments": {
      "command": "vim",
      "args": ["/path/to/file"]
    }
  }
}
```

## Build Processes

Execute build commands and monitor their output.

Example for npm build:

```json
{
  "method": "tools/call",
  "params": {
    "name": "start_pty",
    "arguments": {
      "command": "npm run build"
    }
  }
}
```

Use `read_pty` to get the output and `list_pty` to check status.