# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- PTY input handling for empty strings and newline characters (#15)
  - Empty input now returns a warning message instead of throwing ArrayBufferView error
  - Added proper validation and graceful handling for edge cases
  - Updated return types to include optional warning field

### Added
- Comprehensive test coverage for empty input and newline handling scenarios
- Warning system for edge cases in PTY input operations

### Changed
- Enhanced PTY write method with better error handling and user feedback
- Updated MCP tool schemas to support warning responses

---

## [Previous Versions]

*Initial release with basic PTY functionality*