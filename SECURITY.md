# Security policy

## Supported version

Security fixes are applied to the latest release on `main`.

## Reporting a vulnerability

Please use GitHub’s private vulnerability reporting or a private security advisory for this repository. Do not include sensitive source content, local database files, tokens or personal feeds in a public issue.

Include:

- affected version and operating system;
- minimal reproduction steps;
- expected versus observed boundary;
- potential impact;
- a redacted proof of concept when appropriate.

## Threat model

RADARLINE reads untrusted public content. The main risks are:

- prompt injection embedded in source material;
- server-side request forgery through a malicious source URL or redirect;
- oversized or malformed feed payloads;
- unsafe HTML rendered in the local interface;
- accidental publication of a personal runtime database;
- false confidence in model-generated analysis.

Controls include loopback binding, same-origin APIs, CSP headers, escaped interface output, payload and timeout limits, private-address checks, redirect validation, schema-constrained local inference, content fingerprints, explicit uncertainty and a Git-ignored runtime data directory.

## Operator responsibilities

- Keep `.data/` and exported intelligence files out of public commits.
- Do not expose the local port to an untrusted network without adding authentication and transport security.
- Review source terms before configuring automated collection.
- Verify material claims at the primary source before acting.
- Treat local-model output as analysis, never evidence.

## Non-goals in version 1.0

RADARLINE is not hardened as a multi-user internet service. It does not include identity, role-based access, encrypted secrets, a cloud scheduler or encrypted backups. Those controls are required before a team or hosted deployment.
