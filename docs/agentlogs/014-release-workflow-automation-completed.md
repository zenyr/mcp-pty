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

### 2. Created `.github/workflows/changelog.yml`

**Purpose:** Separate workflow for CHANGELOG generation and GitHub Release creation

**Inputs:**
- `version`: New version (e.g., 0.1.0)
- `old_version`: Previous version (e.g., 0.0.1)

**Steps:**
1. Checkout with full history
2. Generate CHANGELOG via git-cliff
3. Commit CHANGELOG to main
4. Create GitHub Release with version tag

**Advantages:**
- Decoupled from NPM publish logic
- Can be triggered independently for hotfixes or backports
- Isolated failure handling

### 3. Created `cliff.toml` Configuration

**Features:**
- Conventional Commits parsing (feat, fix, docs, perf, refactor, style, test, chore)
- Grouped output by commit type
- Automatic link generation for issue references (#123)
- Semantic versioning friendly
- Proper Keep a Changelog format

**Commit Groups:**
- Added (feat)
- Fixed (fix)
- Documentation (doc)
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

### Why Separate `changelog.yml`?
- **Single Responsibility:** One workflow for documents, one for packages
- **Error Isolation:** NPM failure ≠ CHANGELOG failure
- **Reusability:** Can trigger independently
- **Future-proofing:** Ready for A (automatic version detection) upgrade

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
- `.github/workflows/release.yml` (refactored)
- `.github/workflows/changelog.yml` (new)
- `cliff.toml` (new)

## Notes
- All workflows use Bun for consistency
- git-cliff is lightweight and CLI-first
- No external GitHub Actions beyond setup-bun, checkout
- Compatible with monorepo structure
