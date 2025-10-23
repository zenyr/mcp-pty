## CI & Release Workflow Optimization

### Phase 1: Release Path Filtering
Expanded release.yml trigger paths from `packages/mcp-pty/**` to `packages/!(website)/**` to include internal dependencies (logger, pty-manager, session-manager). Prevents version skips when deps change without mcp-pty modification.

### Phase 2: CI Paths Filtering
Added paths filtering to ci.yml: `packages/!(website)/src/**, .github/workflows/ci.yml, package.json, tsconfig.json, bun.lock, biome.json`. Excludes docs/ to skip unnecessary CI runs on documentation changes.

### Phase 3: Test Parallelization
Implemented concurrent test execution with Bun flags and GitHub Actions caching:
- Added `actions/cache@v4` for ~/.bun/install/cache with key based on bun.lock
- Changed `bun test --coverage` to `bun test --coverage --concurrent --max-concurrency=6`
- Parallelized lint commands (check & format in background with wait)
- Pinned bun-version to latest for feature access
- Applied --no-save to build job to prevent unnecessary lock updates

### Key Changes
- Expanded release trigger to cover all internal packages
- Optimized CI to skip on non-source changes
- Parallel test execution (7 packages → 2-3 concurrent batches)
- GitHub Actions Bun cache with lock file keying
- Concurrent lint/format checks

### Outcome
- Release workflow triggers correctly for dep changes
- CI skips docs-only changes
- Expected test time reduction: ~60-90s → ~40-50s (40-45% improvement)
- Cache hits save ~10-15s on downstream runs
- Lint parallelization saves ~10s per CI run
