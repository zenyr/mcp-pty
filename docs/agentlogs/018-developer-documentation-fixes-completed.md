# Developer Documentation Fixes - AgentLog #017

**Date**: 2025-10-20  
**Agent**: Claude Haiku 4.5  
**Branch**: `docs/fix-developer-documentation` (from `origin/develop`)

## Summary

Fixed inaccuracies and removed unnecessary details from PR #35 developer documentation based on deep-dive review findings.

## Issues Identified

### 1. **Monitoring Configuration Mismatch**
- **Document claim**: "5-minute idle timeout with configurable monitoring"
- **Actual code**: 5-minute timeout ✓, but monitoring interval is hardcoded to 1 minute (not configurable)
- **Impact**: Misleading documentation about configurability

### 2. **`bun link` Misuse**
- **Document claim**: "`bun link` - Register as global command"
- **Actual behavior**: `bun link` registers package as linkable (symlink), not global command
- **Impact**: Developers would follow incorrect setup procedure

### 3. **TypeScript Import Preferences Contradiction**
- **Document setting**: `"typescript.preferences.importModuleSpecifier": "relative"`
- **Project requirement**: All imports use `@pkgs/*` path aliases (non-relative)
- **Impact**: IDE would suggest incorrect import style contradicting project standards

### 4. **Excessive Documentation Detail**
- Performance benchmarks (1-2ms overhead) - implementation-specific, unnecessary for integration docs
- Future enhancement speculation (custom security policies, whitelisting, audit logging) - premature
- Troubleshooting sections - limited practical value for integration guide
- **Impact**: Document bloat reducing clarity for actual use cases

## Changes Made

### 1. **docs/architecture.md**
- Line 75: Changed `"5-minute idle timeout with configurable monitoring"` → `"5-minute idle timeout with 1-minute monitoring interval"`
- Adds 3-second SIGTERM timeout for clarity

### 2. **CONTRIBUTING.md**
- Lines 37-44: Removed incorrect `bun link` setup step
- Simplified to just `bun check` verification

### 3. **docs/development-setup.md**
- Lines 52-60: Removed `bun link` from setup (same reason as CONTRIBUTING.md)
- Line 130: Changed import specifier preference from `"relative"` → `"non-relative"` (matches @pkgs/* requirement)

### 4. **docs/normalize-commands-integration.md**
- Removed 5-step detailed command processing flow (replaced with 4-point summary)
- Removed 6-item shell detection list (replaced with concise comparison)
- **Deleted**: Performance Considerations section (1-2ms benchmarks)
- **Deleted**: Custom Security Rules section (future-spec, not implemented)
- **Deleted**: Troubleshooting section
- **Deleted**: Future Enhancements section
- Kept: Core API, security validation, usage examples, testing patterns

## Metrics

- **Lines removed**: 166
- **Lines added**: 18
- **Net change**: -148 lines
- **Files modified**: 4

## Rationale

**Keep**: Essential, actionable content (API, security, examples, tests)  
**Remove**: Implementation details, speculation, redundant info

Documents should guide developers without drowning them in technical minutiae. Focus: integration points + usage patterns.

## Testing

All documentation changes are non-functional. Verification:
```bash
bun check  # TypeScript still valid with @pkgs/* imports
bun test   # No behavior changes
```

## Related Issues

- Addresses PR #35 deep-dive review findings
- Fixes contradiction between docs and actual implementation
- Simplifies onboarding experience
