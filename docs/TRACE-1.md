# TRACE-1 protocol

TRACE-1 is RADARLINE’s portable contract for source-grounded technology intelligence. Version 1.0 is defined by [`protocol/trace-1.schema.json`](../protocol/trace-1.schema.json).

## Design rule

> AI may interpret a signal; it may not replace its evidence.

The contract keeps four layers separate:

1. **signal identity** — title and timestamps;
2. **evidence** — source, URL, fingerprint and captured excerpt;
3. **classification and scores** — deterministic prioritisation;
4. **analysis** — optional machine interpretation with model identity.

## Acronym

| Letter | Dimension | Question |
|---|---|---|
| T | Traceability | Can another person find and verify the origin? |
| R | Relevance | Which explicit strategic question does this change? |
| A | Authority | How credible is this source in this context? |
| C | Corroboration | Is there genuinely independent support? |
| E | Expiry | How quickly does freshness or decision value decay? |

Novelty, uncertainty, confidence and hype gap are supporting fields because they change routing even though they are not letters in the acronym.

## Minimal lifecycle

```text
captured → scored → analysed (optional) → human-routed → briefed/exported
```

No stage is allowed to remove the source fields.

## Validation

Validate the committed example:

```bash
npm run validate:protocol
```

Export the complete current workspace:

```bash
node cli.js export radarline-trace-1-export.json
```

The workspace export contains an array of TRACE-compatible records plus the source and watch-theme registries. It is intended for audit, backup and interoperability — not as a claim that all exported content is verified.

## Versioning policy

- additive optional fields may appear in a minor release;
- required-field or semantic changes require a new major protocol version;
- exporters must include `trace1_version`;
- consumers should reject unsupported major versions rather than silently dropping evidence.

## Demo records

The example and seeded database are fictional and carry `demo: true`. Real sync and manual-capture records carry `demo: false`. Interfaces and downstream consumers must preserve that distinction.
