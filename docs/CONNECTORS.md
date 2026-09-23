# Connector guide

RADARLINE retrieves only sources that the operator explicitly registers and synchronises. Version 1.0 includes public, credential-free adapters.

## Supported connectors

| Connector | Expected URL | Behaviour |
|---|---|---|
| `rss` | RSS, Atom or JSON Feed URL | Parses up to 30 recent entries |
| `json` | JSON Feed URL | Parses version-compatible feed items |
| `github` | `https://github.com/owner/repo` | Reads public releases through GitHub’s public API |
| `hackernews` | HN Algolia API URL | Reads public stories matching the configured query |
| `web` | One public page | Captures title, description and a bounded excerpt |
| `manual` | URL optional | Stores a governed workflow for human capture |

## Built-in safety boundary

Before a source is processed, RADARLINE enforces:

- HTTP or HTTPS only;
- no credentials embedded in a URL;
- no localhost, `.local` or private IP target;
- DNS resolution may not point to a private address;
- every redirect target is checked again;
- five redirects maximum;
- 18-second request timeout;
- 2.75 MB payload limit;
- 30 normalised items per source run;
- no executable remote HTML in the product interface.

These controls reduce accidental server-side request forgery and oversized or hostile feed input. They do not make arbitrary internet content trustworthy.

## Social networks and creators

Many social platforms require official APIs, credentials and platform-specific terms. RADARLINE does not pretend that an unauthenticated scraper is a durable connector.

Use one of these paths:

1. publisher-provided RSS or JSON Feed;
2. official API exposed through an operator-controlled adapter;
3. manual capture of a public post with canonical URL, author and evidence excerpt;
4. newsletter or creator feed when redistribution terms permit it.

Manual capture is a first-class connector because provenance is more important than fake automation.

## Adding a source

Use **Source Network → Add source**, set its authority deliberately, then run **Sync active sources**. Errors are isolated by source and recorded in `sync_runs` plus the source health field.

For local development, a source can also be inserted through `POST /api/sources`. The API is bound to loopback by default and is not a public ingestion endpoint.

## Extending the system

A new connector should:

1. use the existing safe transport boundary;
2. return normalized items with title, canonical URL, external ID, excerpt, author and publication date;
3. cap output volume;
4. avoid secrets in logs or URLs;
5. add parser and failure tests;
6. document the source’s permitted access method.

Do not add bypasses for authentication walls, anti-bot controls or private network resources.
