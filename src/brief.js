'use strict';

function escapeMarkdown(value) {
  return String(value || '').replace(/([\\`*_{}[\]()#+.!|>])/g, '\\$1');
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

function signalLine(signal) {
  const summary = signal.ai_summary || signal.excerpt || 'Open the evidence to review this signal.';
  const link = signal.canonical_url ? `[source](${signal.canonical_url})` : 'source not attached';
  return `### ${escapeMarkdown(signal.title)}\n\n**${signal.status} · TRACE ${signal.trace_score}/100 · ${signal.horizon.toUpperCase()}** — ${link}\n\n${summary}\n\n**Why it matters:** ${signal.why_it_matters || 'Human interpretation required.'}`;
}

function buildBrief(signals, period = 'daily') {
  const selected = [...signals].filter(item => !item.archived && item.status !== 'IGNORE')
    .sort((a, b) => b.trace_score - a.trace_score).slice(0, 12);
  const top = selected.slice(0, 3);
  const highUncertainty = selected.filter(item => item.uncertainty >= 45 || item.hype_gap >= 25).slice(0, 4);
  const now = selected.filter(item => item.horizon === 'now');
  const next = selected.filter(item => item.horizon === 'next');
  const later = selected.filter(item => item.horizon === 'later');
  const label = period === 'weekly' ? 'Weekly Intelligence Brief' : 'Daily Intelligence Brief';
  const date = formatDate(new Date());
  const executive = top.length
    ? `${top.length} decision-ready signals lead this brief. ${now.length} require near-term attention; ${highUncertainty.length} carry material uncertainty or hype risk.`
    : 'No decision-ready signals are available yet. Run a source sync or capture a signal manually.';
  const section = (title, rows) => rows.length ? `## ${title}\n\n${rows.map(signalLine).join('\n\n---\n\n')}` : '';
  const body = `# RADARLINE — ${label}\n\n**Generated:** ${date}  \n**Signals reviewed:** ${selected.length}  \n**Protocol:** TRACE-1 v1.0\n\n> ${executive}\n\n## Executive read\n\n${top.map((item, index) => `${index + 1}. **${escapeMarkdown(item.title)}** — ${item.why_it_matters || item.ai_summary || item.excerpt}`).join('\n') || 'No prioritized signal.'}\n\n${section('NOW — operating impact', now)}\n\n${section('NEXT — investigate and prepare', next)}\n\n${section('LATER — preserve optionality', later)}\n\n${highUncertainty.length ? `## Verification queue\n\n${highUncertainty.map(item => `- **${escapeMarkdown(item.title)}** — uncertainty ${item.uncertainty}/100; hype gap ${item.hype_gap}/100.`).join('\n')}` : ''}\n\n## Decision discipline\n\n- Open the primary source before changing a roadmap.\n- Seek independent corroboration for high-impact claims.\n- Treat local AI synthesis as analysis, not evidence.\n- Record the decision and the evidence that changed it.\n\n---\n\nGenerated locally by RADARLINE. Source material remains subject to its original publisher's terms.\n`;
  return { title: `${label} · ${date}`, executive_summary: executive, body_md: body, signal_ids: selected.map(item => item.id), model: 'deterministic-trace-1' };
}

module.exports = { escapeMarkdown, formatDate, signalLine, buildBrief };
