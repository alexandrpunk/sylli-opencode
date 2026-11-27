# Changelog

All notable changes to Sylli are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [0.4.1] - 2026-11-26

### Changed

- Global installation of `oxlint`, `stylelint` and `html-validate` is now enabled by default to strengthen code-quality checks.
- Added `--without-linters` for environments that do not want global linter installation; `--with-linters` remains supported as a compatibility alias.
- Synchronized the plugin package and lockfile version to `0.4.1`.

## [0.4.0] - 2026-11-25

### Added

- Vendored and pinned the complete Taste Skill checkout at upstream commit `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`.
- Granted the Taste Skill to the `designer` and `oracle` roles through the verified skill manifest.
- Added upstream manifest and installation verification for the vendored skill.
- Added release, update, and safe installation documentation.
- Added a separate, opt-in manual update checker (`update.sh --check`).

### Changed

- Improved installation guidance, including the required OpenCode restart after installation.
- Synchronized the plugin package and lockfile version to `0.4.0`.

### Update policy

The update monitor is manual and opt-in. It only checks remote tags or commits after an explicit command; it does not download or execute code automatically. Sylli has no auto-update mechanism and collects no telemetry.

[0.4.1]: https://github.com/alexandrpunk/sylli-opencode/releases/tag/v0.4.1
[0.4.0]: https://github.com/alexandrpunk/sylli-opencode/releases/tag/v0.4.0
