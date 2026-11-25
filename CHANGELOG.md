# Changelog

All notable changes to RADARLINE are documented here. The project follows semantic versioning.

## [Unreleased]

### Added

- `tests/brief.test.js`: coverage for the deterministic intelligence brief (ranking, archived/ignored filtering, 12-signal cap, Now/Next/Later grouping, verification queue, empty workspace).
- `tests/cli.test.js`: coverage for `radarline check` and the TRACE-1 contract validator, including exit codes on valid and invalid files.

### Fixed

- `cli.js` no longer runs a command (and prints the help) when it is required as a module.
- The local API now answers `400` (not `500`) on invalid input: missing source name or URL, unsupported connector, missing signal title, and a body that is not a JSON object. Syncing an unknown source answers `404`. Covered by two new tests in `tests/server.test.js` (24 to 26 tests).
- `radarline check` and `validateContract` now require the TRACE-1 classification block and the full score set (relevance, novelty, authority, corroboration, freshness, traceability, uncertainty, trace). A scores array, a missing file, or invalid JSON is reported as a structured validation error that names the file, instead of being accepted or thrown as a raw exception. Three new tests in `tests/cli.test.js` (26 to 29).
- A request with a malformed `Host` header (for example `Host: a b`) no longer crashes the local server: the request URL is now built from the configured host and port, not from the client-controlled header. Unexpected `500` errors answer a generic `Internal error.` and keep the details in the server log; client errors (`400`, `404`, `409`, `413`) keep their message. One new test in `tests/server.test.js` (29 to 30).

## [1.1.0] — 2026-11-10

### Added

- `launch-radarline.sh`: one-command macOS and Linux launcher, on par with the Windows `launch-radarline.ps1`. It starts the local server when needed, waits for `/api/health`, and opens the app (`RADARLINE_NO_BROWSER=1` skips the browser).
- Tested AI starter pack of ten public, credential-free sources (OpenAI, Google DeepMind, Hugging Face, arXiv, Ollama, llama.cpp, vLLM, Transformers, Hacker News and more), with a load-and-sync guide in `docs/STARTER-SOURCES.md`.

### Changed

- Portfolio hero image in the README (`docs/radarline-social-preview.png`).

## [1.0.0] — 2026-09-23

### Added

- Eight-screen Technology & AI Intelligence OS.
- Local SQLite evidence store with a clearly fictional demonstration workspace.
- RSS, Atom, JSON Feed, GitHub Releases, Hacker News, web-page and manual connectors.
- Deterministic TRACE scoring, uncertainty, confidence and hype-gap indicators.
- Optional Ollama analysis with schema-constrained output and deterministic fallback.
- Strategic Now / Next / Later radar.
- Daily and weekly Markdown intelligence briefs.
- TRACE-1 JSON Schema and portable evidence export.
- PWA shell, desktop launcher, responsive interface and full screenshot suite.
- Security boundary, methodology, architecture and connector documentation.
- Automated syntax, parser, scoring, API and protocol verification.

[1.1.0]: https://github.com/abbas-mistrah/radarline/releases/tag/v1.1.0
[1.0.0]: https://github.com/abbas-mistrah/radarline/releases/tag/v1.0.0
