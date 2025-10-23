## Documentation Fixes & Output Buffer Optimization

### Phase 18-20: Documentation & Performance

**Documentation Audit (Phase 18)**:
- Fixed 4 documentation inaccuracies: monitoring interval hardcoded (not configurable), `bun link` misuse, TypeScript import preferences contradiction, excessive implementation details
- Modified files: docs/architecture.md, CONTRIBUTING.md, docs/development-setup.md, docs/normalize-commands-integration.md
- Removed 166 lines (spec, benchmarks, troubleshooting), added 18 lines (clarity)
- Impact: Simplified onboarding, corrected contradictions with actual implementation

**Examples & Demos (Phase 19)**:
- Created docs/examples/ with MCP client configs and use cases
- Added claude_desktop_config.json, http-server.ts, use-cases.md
- Closed issue #20

**Output Buffer Optimization (Phase 20)**:
- Added 64KB FIFO buffer limit in PtyProcess.outputBuffer to prevent unbounded memory growth
- Rationale: 64KB ≈ 16K tokens, optimized for LLM context windows; safe for 100 concurrent processes (~6.4MB)
- Implementation: FIFO trimming in onData() handler, API unchanged
- Modified: packages/pty-manager/src/process.ts
- Tests: All 25 MCP tests passing

### Key Changes
- Removed speculative/redundant documentation (performance benchmarks, future enhancements)
- Corrected TypeScript import preferences from relative to @pkgs/* path aliases
- Eliminated incorrect `bun link` setup steps
- Added bounded output buffer to prevent OOM on long-running processes (tail -f, watch)
- FIFO trimming preserves recent output for LLM context

### Outcome
✅ Documentation accuracy verified and cleaned; examples created for issue #20; memory safety enhanced with output buffer limits while maintaining backward compatibility and test coverage.
