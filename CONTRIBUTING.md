# Contributing to RADARLINE

Contributions should strengthen evidence quality, local control or decision usefulness without turning the product into an indiscriminate feed.

## Local workflow

```bash
npm install
npm run check
npm test
npm run validate:protocol
npm start
```

Use Node.js 22.5 or newer. Ollama is optional and tests must not require a downloaded model or an internet connection.

## Principles

- Preserve provenance across every transformation.
- Keep demo data clearly fictional.
- Escape remote content before rendering it.
- Add network connectors only through public, permitted access paths.
- Prefer deterministic, inspectable logic for scoring and routing.
- Keep local AI optional and label fallbacks.
- Never commit `.data/`, exported private databases, tokens or personal feeds.

## Pull requests

A focused pull request should include:

1. the problem and intended decision outcome;
2. tests for scoring, parsing or API behaviour;
3. documentation for new fields or connectors;
4. screenshots for material interface changes;
5. a protocol migration note if TRACE-1 semantics change.

Run the full quality workflow before requesting review. Security issues should follow [SECURITY.md](SECURITY.md), not a public issue.
