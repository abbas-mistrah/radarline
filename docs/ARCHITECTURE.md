# RADARLINE architecture

RADARLINE is designed around one boundary: evidence may enter from public sources, but storage, scoring, interpretation and briefing remain local by default.

## System shape

```text
Browser UI (PWA)
       │ same-origin JSON
       ▼
Node local service · 127.0.0.1:4335
       ├── source connectors ──► explicitly configured public URLs
       ├── deterministic scoring
       ├── brief generator
       ├── TRACE-1 exporter
       ├── Ollama adapter ─────► 127.0.0.1:11434 (optional)
       └── SQLite ─────────────► .data/radarline.sqlite
```

## Components

### Browser product

`public/` is a dependency-free, responsive interface. It contains eight operating views, modal capture workflows, downloads and a service worker. It makes same-origin requests only; the content security policy blocks arbitrary script and network origins.

### Local service

`server.js` serves static product files and a compact JSON API. The service binds to loopback unless the operator deliberately changes `RADARLINE_HOST`. Mutating endpoints are intended for the local single-user interface.

### Evidence store

`src/database.js` owns SQLite access and migrations. The checked-in demonstration database is copied on first run. Runtime records are written to `.data/`, which is ignored by Git.

Main entities:

- `sources` — connector, cadence, authority and health;
- `themes` — strategic questions and keyword boundaries;
- `signals` — evidence, classification, scoring and analysis;
- `signal_themes` — many-to-many relevance links;
- `briefs` — generated decision narratives;
- `sync_runs` and `audit_log` — operational accountability.

### Connectors

`src/connectors.js` normalises RSS, Atom, JSON Feed, GitHub Releases, Hacker News and bounded public pages. Input size, timeout, URL scheme, credentials, private addresses and redirect targets are constrained before content reaches the scoring layer.

### Scoring

`src/scoring.js` is intentionally deterministic. It contains no trained model and no hidden ranking service. Given the same signal, source attributes and clock, it produces the same result.

### Local AI

`src/ai.js` discovers Ollama locally and requests a schema-constrained JSON response. The model receives a bounded excerpt, not an unrestricted browsing capability. Source content is explicitly identified as untrusted. If inference is unavailable or malformed, a labelled deterministic fallback is stored.

### Brief generation

`src/brief.js` uses the triage queue and TRACE score to produce Markdown. A brief is a communication layer; it does not rewrite source evidence.

## Data flow and trust boundaries

1. The user explicitly starts synchronisation.
2. Each active automated source is fetched independently.
3. The connector constrains transport and normalises fields.
4. A SHA-256 content fingerprint is recorded.
5. The deterministic engine estimates relevance, novelty, authority, corroboration, freshness, traceability, uncertainty and hype gap.
6. Watch themes are linked to the signal.
7. Optional local AI adds analysis in separate columns.
8. A human routes the record to ignore, watch, investigate, brief or act.
9. Briefs and TRACE-1 exports preserve a path back to evidence.

## Deliberate constraints

- Single local operator in version 1.0.
- No cloud account, cloud database or telemetry.
- No authenticated scraping or bypass of platform controls.
- No secret store because built-in connectors use public endpoints.
- No automatic action on external systems.
- No model-generated authority or source provenance.

These constraints make the project inspectable and safe as a portfolio-grade foundation. A future team edition should add identity, encrypted secrets, role-based routing, retention controls and an auditable scheduler rather than weaken the local trust model.
