# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- feat: wait for main PR merge before creating GitHub Release (#54)

### Fixed
- fix: upgrade bun-pty to 0.4.4 and clarify Windows SSH CRLF requirement
- fix: remove non-existent release label from workflow (#53)
- fix: adapt release workflow for protected develop branch (#51)

### Changed
- refactor: concisely rewrite all tool/resource descriptions for clarity (50-60% reduction)

### Miscellaneous Tasks
- chore: bump version to 0.5.2 (#52)
- chore: sync version to 0.5.0 to match NPM registry
