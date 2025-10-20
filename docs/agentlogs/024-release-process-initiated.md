# 024: Release Process Initiated

## Summary
Initiated release process for mcp-pty package version 0.0.4. Confirmed npm registry does not have version 0.0.4, allowing patch bump from current 0.0.3.

## Changes
- Verified current version: 0.0.3
- Checked npm registry: mcp-pty@0.0.4 not found
- Planned version bump: patch (0.0.3 → 0.0.4)
- Release method: GitHub Actions workflow_dispatch

## Impact
- Automated version bump, build, test, and publish via CI/CD
- Generates CHANGELOG and GitHub release
- Syncs version to develop branch

## Decisions
- Use existing release.yml workflow for consistency
- No manual version changes; let CI handle semver bump
- Dry run option available but not used for actual release