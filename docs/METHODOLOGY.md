# Intelligence methodology

RADARLINE is a decision filter, not a truth engine. It makes a signal easier to inspect and route; it never certifies that a claim is correct.

## 1. Start with a watch question

A theme is expressed as a question with inclusion and exclusion terms. This protects the workspace from collecting a broad topic simply because it is popular.

Example:

> Where can small or local models replace cloud dependence without losing decision quality?

## 2. Preserve the evidence record

A live signal should include:

- source identity and canonical URL;
- publication and observation timestamps;
- title, author and bounded excerpt;
- SHA-256 content fingerprint;
- source authority set by a human;
- explicit demo/live status.

Missing fields reduce traceability and increase uncertainty.

## 3. Score transparently

All dimensions use a 0–100 scale.

```text
TRACE = 0.25 × relevance
      + 0.18 × novelty
      + 0.18 × authority
      + 0.14 × corroboration
      + 0.12 × freshness
      + 0.13 × traceability
      − 0.12 × uncertainty
```

The public score is clamped to 0–100. Its purpose is prioritisation, not mathematical certainty.

### Relevance

Estimated from explicit watch-theme matches. A broad technology mention is less valuable than a signal that changes a named strategic assumption.

### Novelty

Estimated against recent titles through token-set similarity. It reduces duplicate attention; it is not a scientific semantic-deduplication claim.

### Authority

Assigned in the source registry. Authority belongs to the source and context, not the number of shares.

### Corroboration

Estimated from distinct sources carrying the same signal type in a recent window. A human should still verify whether those sources are genuinely independent.

### Freshness / expiry

Signals decay through explicit age bands. Freshness does not make a low-authority source reliable.

### Traceability

Rewards canonical URL, content fingerprint, publication time, source identity and author.

### Uncertainty

Penalises missing source, author, time, substantive excerpt or content fingerprint. Uncertainty remains visible even when a signal is highly relevant.

## 4. Separate confidence from hype

`confidence` combines evidence quality with the inverse of uncertainty. `hype_gap` compares attention proxies — novelty, freshness and relevance — with evidence strength — authority, corroboration and traceability.

A high hype gap means “verify next”, not “ignore automatically”. Emerging change often appears before consensus.

## 5. Route to a response

The initial automated status is only a suggestion:

| Status | Meaning |
|---|---|
| `IGNORE` | Not relevant enough for the current watch questions |
| `WATCH` | Preserve and monitor; no investigation yet |
| `INVESTIGATE` | Seek primary evidence or independent corroboration |
| `BRIEF` | Include in an executive intelligence narrative |
| `ACT` | Human decision requires an owned next step |

The time horizon is separate:

- `NOW` — operating impact in the current cycle;
- `NEXT` — investigate and prepare;
- `LATER` — preserve optionality and monitor weak signals.

## 6. Use local AI as an analyst, not a witness

The local model may summarise, classify and propose implications. It may not create a source, alter a content hash or claim that independent verification happened. The model and analysis time remain attached to its output.

## 7. Brief with decision discipline

Before changing a roadmap:

1. open the primary source;
2. seek independent corroboration for material claims;
3. identify which assumption changed;
4. record the owner and response horizon;
5. keep unresolved uncertainty in the brief.

That is the difference between consuming information and operating intelligence.
