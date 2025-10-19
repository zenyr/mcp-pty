# Contributing to mcp-pty

Thank you for your interest in contributing to mcp-pty! This guide will help you get started with contributing to this MCP server project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Contribution Workflow](#contribution-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Security Considerations](#security-considerations)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- **Bun** v1.2.0+ (required runtime and package manager)
- **Git** for version control
- **Node.js** compatible environment (for some dev tools)

### Initial Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/mcp-pty.git
   cd mcp-pty
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Verify Setup**
   ```bash
   # Type checking
   bun check
   ```

4. **Run Tests**
   ```bash
   bun test
   ```

### Development Commands

```bash
# Type checking
bun check

# Linting and formatting
bun run lint
bun run format

# Testing
bun test                    # All tests
bun test packages/pty-manager  # Specific package

# Build
bun run build

# Development mode (with watch)
bun run dev
```

## Project Structure

```
mcp-pty/
├── packages/
│   ├── mcp-pty/           # Main MCP server
│   ├── pty-manager/       # PTY process management
│   ├── session-manager/   # Session lifecycle
│   ├── normalize-commands/# Command parsing & security
│   ├── logger/           # Centralized logging
│   └── experiments/      # Experimental features
├── docs/                 # Documentation
├── .github/              # GitHub workflows
└── tools/               # Build and dev tools
```

### Package Development

Each package follows this structure:
```
packages/package-name/
├── src/
│   ├── index.ts         # Main exports
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   └── __tests__/       # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## Contribution Workflow

### 1. Create Issue

- Search existing issues first
- Use appropriate labels (bug, enhancement, documentation)
- Provide clear description and reproduction steps for bugs

### 2. Create Branch

```bash
# From main branch
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-number-description
```

### 3. Make Changes

- Follow code standards (see below)
- Add tests for new functionality
- Update documentation as needed
- Keep changes focused and atomic

### 4. Test Your Changes

```bash
# Run all tests
bun test

# Type checking
bun check

# Linting
bun run lint

# Integration tests (if applicable)
bun test packages/mcp-pty/src/__tests__/integration/
```

### 5. Commit Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
feat: add new PTY monitoring feature
fix: resolve session cleanup issue
docs: update API documentation
test: add integration tests for HTTP transport
refactor: simplify session manager initialization
```

### 6. Create Pull Request

- Use descriptive title and description
- Link related issues
- Include screenshots for UI changes
- Ensure CI passes

## Code Standards

### TypeScript Guidelines

- **Strict Mode**: All code must pass strict TypeScript checks
- **No `any`**: Use proper typing or `unknown` with type guards
- **No `@ts-ignore`**: Forbidden except in test files
- **Prefer `const`**: Use arrow functions and const declarations
- **Type Exports**: Export types explicitly for better documentation

### Import Rules

- **Path Aliases**: Use `@pkgs/*` instead of relative imports
- **Named Exports**: Prefer named exports over default exports
- **Type Imports**: Use `import type` for type-only imports

```typescript
// Good
import { PtyManager } from "@pkgs/pty-manager";
import type { Session } from "@pkgs/session-manager";

// Bad
import { PtyManager } from "../pty-manager";
import Session from "../session-manager";
```

### Code Style

- **2-space indentation**
- **TSDoc comments** for public APIs
- **Descriptive variable names**
- **Error handling** with proper typing

```typescript
/**
 * Creates a new PTY process with the specified command.
 * @param command - Command to execute
 * @param options - PTY configuration options
 * @returns Promise resolving to PTY process instance
 */
export const createPty = async (
  command: string,
  options: PtyOptions,
): Promise<PtyProcess> => {
  // Implementation
};
```

## Testing Guidelines

### Test Structure

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test package interactions
- **Security Tests**: Test command validation and security
- **E2E Tests**: Test complete user workflows

### Test Utilities

Each package includes test utilities in `__tests__/`:

```typescript
// Use provided test utilities
import { withTestPtyManager } from "@pkgs/pty-manager";

test("PTY process lifecycle", async () => {
  await withTestPtyManager(async (manager) => {
    const pty = await manager.createPty("echo hello");
    expect(pty.getOutput()).toContain("hello");
  });
});
```

### Test Coverage

- Aim for >80% code coverage
- Test error conditions and edge cases
- Test security validation thoroughly
- Include performance tests for critical paths

### Security Testing

Test command validation scenarios:
```typescript
test("blocks dangerous commands", () => {
  expect(() => normalizeCommand("rm -rf /")).toThrow();
  expect(() => normalizeCommand("mkfs.ext4 /dev/sda1")).toThrow();
});
```

## Documentation

### Code Documentation

- **TSDoc**: Document all public APIs
- **Examples**: Include usage examples in complex functions
- **Type Definitions**: Document complex types and interfaces

### README Updates

- Update feature descriptions
- Add new configuration options
- Include breaking changes
- Update installation instructions

### Architecture Documentation

- Update `docs/architecture.md` for structural changes
- Add new diagrams to `docs/diagrams.md`
- Document new security considerations
- Update integration examples

## Security Considerations

### Command Validation

- All user commands must pass through `normalize-commands`
- Test security validation thoroughly
- Never bypass security checks
- Document security assumptions

### Path Safety

- Validate all file paths
- Use absolute paths for PTY working directories
- Prevent directory traversal attacks
- Sanitize user inputs

### Resource Limits

- Implement reasonable timeouts
- Limit output buffer sizes
- Monitor resource usage
- Clean up resources properly

### Reporting Security Issues

- Do not open public issues for security vulnerabilities
- Email maintainers directly
- Provide detailed reproduction steps
- Follow responsible disclosure

## Release Process

### Version Management

- Follow [Semantic Versioning](https://semver.org/)
- Update package.json versions
- Update CHANGELOG.md
- Tag releases appropriately

### Release Checklist

1. **Code Quality**
   - [ ] All tests pass
   - [ ] Code coverage meets requirements
   - [ ] No linting errors
   - [ ] Documentation updated

2. **Security Review**
   - [ ] Security tests pass
   - [ ] No new vulnerabilities
   - [ ] Dependencies audited

3. **Release Preparation**
   - [ ] Version numbers updated
   - [ ] CHANGELOG.md updated
   - [ ] Release notes prepared

4. **Publishing**
   - [ ] Create release tag
   - [ ] Run automated release workflow
   - [ ] Verify package publication

### Automated Releases

The project uses automated releases via GitHub Actions:
- Releases are triggered on main branch merges
- Version bumps follow conventional commits
- Packages are published to npm automatically

## Getting Help

### Communication Channels

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For general questions and discussions
- **Documentation**: Check existing docs first

### Common Issues

1. **TypeScript Errors**: Ensure strict mode compliance
2. **Test Failures**: Check test utilities and mocks
3. **Build Issues**: Verify Bun version and dependencies
4. **Security Tests**: Update command validation if needed

### Contributing Areas

We welcome contributions in:
- **Core Features**: PTY management, session handling
- **Security**: Command validation, access control
- **Performance**: Optimization, resource management
- **Documentation**: Guides, examples, API docs
- **Testing**: Test coverage, new test scenarios
- **Tooling**: Build tools, development utilities

Thank you for contributing to mcp-pty! Your contributions help make this project better for everyone.