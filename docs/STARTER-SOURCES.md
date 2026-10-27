# AI starter pack: a live radar in five minutes

The demo database shows how RADARLINE works with fictional signals. This pack replaces "imagine your sources" with ten real, public, credential-free AI sources, so a first `sync` returns live evidence.

| Source | Connector | Why it is in the pack | Default authority |
|---|---|---|---:|
| OpenAI News | `rss` | Frontier-model and product announcements | 75 |
| Google DeepMind Blog | `rss` | Research and model releases | 75 |
| Hugging Face Blog | `rss` | Open models, datasets and tooling | 70 |
| Simon Willison's Weblog | `rss` | Hands-on LLM practice, fast and well sourced | 65 |
| arXiv cs.AI (Atom API) | `rss` | Newest AI papers; the API stays populated on weekends, unlike the daily RSS | 60 |
| Ollama releases | `github` | Local AI runtime changes | 80 |
| llama.cpp releases | `github` | Local inference engine changes | 80 |
| vLLM releases | `github` | Production inference serving | 80 |
| Transformers releases | `github` | The reference open-model library | 80 |
| Hacker News · LLM | `hackernews` | Community pulse; low authority on purpose | 40 |

Authority is your judgement, not ours: a vendor blog is a primary source for its own announcements, not proof that a claim is true. Adjust the numbers in [`sources/ai-starter-pack.json`](../sources/ai-starter-pack.json) before you load it.

## Load the pack

Start RADARLINE (`npm start`), then in a second terminal:

```bash
node -e '
const pack = require("./sources/ai-starter-pack.json");
(async () => {
  for (const source of pack.sources) {
    const r = await fetch("http://127.0.0.1:4335/api/sources", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(source)
    });
    console.log(r.status, source.name);
  }
})();'
```

Each line should print `201`. The sources then appear in **Source Network**.

## First sync and brief

```bash
node cli.js sync          # fetches every active automated source
node cli.js brief daily   # writes a decision-ready Markdown brief
```

`sync` prints one result per source. A failure is isolated to that source and recorded in its health field; the others still complete.

## Tested

On 2026-10-24, and again on 2026-10-27, every source in the pack was fetched through RADARLINE's own `src/connectors.js` (safe transport boundary included): 10 of 10 returned items (30 per feed or release source, 20 for Hacker News).

Running the loader twice creates duplicate sources; delete extras in **Source Network**.
