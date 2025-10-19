# Development Setup Guide

This guide will help you set up a complete development environment for contributing to mcp-pty.

## Prerequisites

### Required Software

- **Bun** v1.2.0+ - Primary runtime and package manager
- **Git** - Version control
- **VS Code** (recommended) - Development environment

### Optional Tools

- **Docker** - For containerized testing
- **Node.js** v18+ - For some development tools
- **Make** - For build automation

## Installation

### 1. Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# Verify installation
bun --version
```

### 2. Clone Repository

```bash
git clone https://github.com/your-username/mcp-pty.git
cd mcp-pty
```

### 3. Install Dependencies

```bash
bun install
```

This will:
- Install all package dependencies
- Set up workspace configuration
- Prepare development tools

### 4. Verify Setup

```bash
# Type checking
bun check
```

## Development Workflow

### Daily Development Commands

```bash
# Install new dependency
bun add package-name
bun add -D package-name  # Dev dependency

# Type checking
bun check

# Linting and formatting
bun run lint
bun run format

# Testing
bun test                    # All tests
bun test --watch           # Watch mode
bun test packages/pty-manager  # Specific package

# Building
bun run build

# Development server (if applicable)
bun run dev
```

### Package-Specific Development

```bash
# Work on specific package
cd packages/pty-manager

# Install package-specific dependency
bun add -D some-dev-tool

# Run package tests
bun test

# Type check package
bun check
```

## IDE Setup

### VS Code Configuration

Install recommended extensions:

```json
{
  "recommendations": [
    "biomejs.biome",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.test-adapter-converter"
  ]
}
```

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```

### Debugging Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug MCP Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/packages/mcp-pty/src/index.ts",
      "runtime": "bun",
      "args": ["--transport", "stdio"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug HTTP Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/packages/mcp-pty/src/index.ts",
      "runtime": "bun",
      "args": ["--transport", "http", "--port", "6420"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Testing Setup

### Running Tests

```bash
# All tests
bun test

# Specific package
bun test packages/pty-manager

# Specific test file
bun test packages/pty-manager/src/__tests__/pty-manager.test.ts

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

### Test Structure

```
packages/package-name/src/__tests__/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── security/          # Security tests
└── e2e/              # End-to-end tests
```

### Writing Tests

```typescript
import { test, expect, describe } from "bun:test";
import { withTestPtyManager } from "@pkgs/pty-manager";

describe("PTY Manager", () => {
  test("creates PTY process", async () => {
    await withTestPtyManager(async (manager) => {
      const pty = await manager.createPty("echo hello", {
        cwd: "/tmp",
      });
      
      expect(pty.getId()).toBeDefined();
      expect(pty.getOutput()).toContain("hello");
    });
  });
});
```

## Build System

### Project Structure

```
mcp-pty/
├── packages/          # Monorepo packages
├── docs/             # Documentation
├── tools/            # Build tools
├── .github/          # CI/CD workflows
└── scripts/          # Build scripts
```

### Build Commands

```bash
# Build all packages
bun run build

# Build specific package
bun run build:pty-manager

# Clean build artifacts
bun run clean

# Rebuild everything
bun run rebuild
```

### TypeScript Configuration

Root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@pkgs/*": ["./packages/*/src"]
    }
  },
  "references": [
    { "path": "./packages/pty-manager" },
    { "path": "./packages/session-manager" },
    { "path": "./packages/mcp-pty" },
    { "path": "./packages/normalize-commands" },
    { "path": "./packages/logger" }
  ]
}
```

## Configuration

### Environment Variables

Create `.env.local` for development:

```bash
# Development settings
MCP_PTY_DEACTIVATE_RESOURCES=false
MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS=true

# Logging
LOG_LEVEL=debug

# Development server
PORT=6420
TRANSPORT=http
```

### XDG Configuration

Create `~/.config/mcp-pty/config.json`:

```json
{
  "transport": "stdio",
  "port": 6420,
  "deactivateResources": false
}
```

## Common Development Tasks

### Adding New Package

1. Create package directory:
```bash
mkdir packages/new-package
cd packages/new-package
```

2. Initialize package:
```bash
bun init -y
```

3. Configure `package.json`:
```json
{
  "name": "@pkgs/new-package",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  }
}
```

4. Add to root `tsconfig.json` references

### Adding New Dependency

```bash
# Runtime dependency
bun add lodash

# Development dependency
bun add -D @types/lodash

# Exact version
bun add lodash@4.17.21
```

### Debugging PTY Processes

```bash
# Enable debug logging
LOG_LEVEL=debug bun test

# Test specific PTY functionality
bun test packages/pty-manager/src/__tests__/pty-process.test.ts

# Manual testing
bun run packages/mcp-pty/src/index.ts --transport http
```

## Performance Optimization

### Development Performance

```bash
# Use Bun's hot reload
bun test --watch

# Incremental builds
bun run build --incremental

# Parallel testing
bun test --parallel
```

### Memory Management

- Monitor PTY process memory usage
- Clean up test processes properly
- Use weak references where appropriate

## Troubleshooting

### Common Issues

1. **TypeScript Errors**
```bash
# Clear TypeScript cache
bun run clean
bun check
```

2. **Test Failures**
```bash
# Run tests with verbose output
bun test --verbose

# Run specific failing test
bun test --testNamePattern="failing test"
```

3. **Build Issues**
```bash
# Clean and rebuild
bun run clean
bun install
bun run build
```

4. **PTY Process Issues**
```bash
# Check for orphaned processes
ps aux | grep -i pty

# Kill orphaned processes
pkill -f "pty"
```

### Getting Help

- Check existing GitHub issues
- Read architecture documentation
- Join community discussions
- Review test examples

## Release Preparation

### Before Release

1. **Code Quality**
```bash
bun check
bun test
bun run lint
```

2. **Documentation**
```bash
# Update READMEs
# Update CHANGELOG
# Update API docs
```

3. **Version Bump**
```bash
# Update package versions
bun run version:bump
```

### Release Testing

```bash
# Test installation
bun pack
bun install mcp-pty-*.tgz

# Test CLI commands
mcp-pty --help
mcp-pty --transport http --port 6420
```

This setup guide should help you get started with mcp-pty development. For more specific questions, refer to the project documentation or open an issue.