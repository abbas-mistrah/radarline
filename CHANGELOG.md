# Changelog

All notable changes to RADARLINE are documented here. The project follows semantic versioning.

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
