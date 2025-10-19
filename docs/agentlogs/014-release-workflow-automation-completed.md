# Release Workflow Automation - Completed

## Date
2025-10-20

## Objective
Implement a two-stage release workflow:
1. Manual version bump selection (patch/minor/major)
2. Automated CHANGELOG generation and GitHub Release creation

## Changes Made

### 1. Modified `.github/workflows/release.yml`

**Key Changes:**
- Removed automatic `push` trigger (now manual-only via `workflow_dispatch`)
- Added `version_type` input parameter with choices: `patch`, `minor`, `major`
- Replaced hardcoded `patch` with dynamic `${{ github.event.inputs.version_type }}`
- Simplified logic: removed complex conditional checks for `push` vs `workflow_dispatch`
- Removed direct GitHub Release creation (delegated to `changelog.yml`)
- Added step to trigger `changelog.yml` workflow after successful NPM publish

**Workflow Flow:**
```
1. Checkout & Setup
2. Bump version (selected type)
3. Build & Test
4. Publish to NPM (or dry-run)
5. Commit version bump
6. Trigger CHANGELOG workflow
7. Sync to develop branch
```

### 2. Integrated CHANGELOG Generation into release.yml

**Previous Design:** Separate `changelog.yml` workflow triggered asynchronously
**Current Design:** Inline CHANGELOG generation within `release.yml` to prevent race conditions

**Process:**
1. Bump version in package.json
2. Build & Test
3. Publish to NPM (with rollback on failure)
4. Commit version bump
5. **Generate CHANGELOG** via git-cliff (inline)
6. **Commit CHANGELOG** to main
7. **Create GitHub Release** via gh CLI
8. Sync main → develop with `--no-ff` merge

**Advantages:**
- Eliminates race condition between NPM publish and CHANGELOG generation
- Atomic operation: either everything succeeds or everything rolls back
- Simpler deployment model (single workflow)
- Ensures CHANGELOG always matches released version

### 3. Created `cliff.toml` Configuration

**Features:**
- Conventional Commits parsing (feat, fix, doc/docs, perf, refactor, style, test, chore)
- Grouped output by commit type
- Automatic link generation for issue references (#123)
- Semantic versioning friendly
- Proper Keep a Changelog format

**Commit Groups:**
- Added (feat)
- Fixed (fix)
- Documentation (doc/docs - both singular and plural)
- Performance (perf)
- Refactored (refactor)
- Styled (style)
- Testing (test)
- Miscellaneous Tasks (chore)

## Usage

### Normal Release Flow
```bash
# On GitHub Actions UI:
1. Go to Actions → Release & Publish
2. Click "Run workflow"
3. Select version_type: patch/minor/major
4. Leave dry_run: false
5. Click "Run workflow"

# Automatically:
- Version bumps in package.json
- NPM publish
- CHANGELOG updated
- GitHub Release created
- develop synced with main
```

### Dry Run
```bash
# Same as above but set dry_run: true
# Skips: NPM publish, CHANGELOG commit, GitHub Release creation
```

## Design Decisions

### Why Manual Version Selection (Type B)?
- Semantic Versioning requires human judgment
- Breaking changes context matters
- Avoids accidental major version bumps
- Simpler and safer for teams

### Why Inline CHANGELOG Generation?
- **Race Condition Prevention:** Async `gh workflow run` caused timing issues
  - Old design: trigger → develop sync → CHANGELOG may not exist yet
  - New design: generate → commit → sync (atomic)
- **Rollback Safety:** NPM failure triggers `git reset --hard` before exit
- **Atomic Release:** All-or-nothing semantics prevent zombie version bumps
- **Simpler Debugging:** Single workflow log for entire release process

### Why `git merge --no-ff`?
- Prevents failures when `develop` has commits ahead of `main`
- Creates explicit merge commit for release tracking
- More reliable than `--ff-only` in multi-branch environments

## Future Enhancements (Type A - Automatic)

When comfortable, can implement:

1. **Commit Analysis Script**
   - Parse commits between tags
   - Detect BREAKING CHANGE: prefix
   - Auto-select major/minor/patch

2. **Conditional Logic**
   ```yaml
   - name: Determine version type
     id: detect_version
     run: |
       # Analyze develop...main commits
       TYPE=$(custom-script.ts)
       echo "type=$TYPE" >> $GITHUB_OUTPUT
   
   - name: Release with detected version
     run: gh workflow run release.yml -f version_type=${{ steps.detect_version.outputs.type }}
   ```

3. **Benefits of Type A:**
   - Zero-click releases
   - Consistent with commit conventions
   - Error-free for maintainers

## Testing Recommendations

1. **Dry Run First**
   - Trigger with `dry_run: true`
   - Verify logic without side effects

2. **Patch Release**
   - Use smallest change to test full flow
   - Verify NPM and CHANGELOG both succeed

3. **Tag Verification**
   - Check GitHub Releases appear correctly
   - Verify CHANGELOG format

## Files Modified
- `.github/workflows/release.yml` (refactored with inline CHANGELOG generation & rollback)
- `cliff.toml` (new, with regex fix for both doc/docs)
- `docs/agentlogs/014-release-workflow-automation-completed.md` (this document, updated)

## Notes
- All workflows use Bun for consistency
- git-cliff is lightweight and CLI-first
- No external GitHub Actions beyond setup-bun, checkout
- Compatible with monorepo structure
