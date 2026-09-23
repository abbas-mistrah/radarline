'use strict';

const SIGNAL_TYPES = [
  'MODEL_RELEASE', 'PRODUCT_LAUNCH', 'RESEARCH_BREAKTHROUGH', 'REGULATION', 'SECURITY',
  'BUSINESS_MOVE', 'CREATOR_INSIGHT', 'INFRASTRUCTURE', 'FUNDING', 'OTHER'
];

const typeRules = [
  ['MODEL_RELEASE', /\b(model|llm|multimodal|parameter|benchmark|inference|weights?)\b/i],
  ['PRODUCT_LAUNCH', /\b(launch|release|ships?|announc|generally available|preview)\b/i],
  ['RESEARCH_BREAKTHROUGH', /\b(research|paper|arxiv|study|benchmark|method|dataset)\b/i],
  ['REGULATION', /\b(regulation|regulatory|law|policy|act|compliance|standard|governance)\b/i],
  ['SECURITY', /\b(security|vulnerabilit|attack|exploit|privacy|breach|red team)\b/i],
  ['BUSINESS_MOVE', /\b(acqui|partnership|revenue|strategy|enterprise|pricing|market)\b/i],
  ['CREATOR_INSIGHT', /\b(interview|creator|podcast|opinion|field note|lesson)\b/i],
  ['INFRASTRUCTURE', /\b(gpu|chip|cloud|datacenter|infrastructure|latency|serving|runtime)\b/i],
  ['FUNDING', /\b(funding|raised|series [a-z]|investment|valuation)\b/i]
];

function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, Math.round(Number(value) || 0)));
}

function normalizeText(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(value) {
  return new Set(normalizeText(value).match(/[a-z0-9]{3,}/g) || []);
}

function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function freshnessScore(date, now = new Date()) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 20;
  const days = Math.max(0, (now.getTime() - parsed.getTime()) / 86_400_000);
  if (days <= 1) return 100;
  if (days <= 3) return 90;
  if (days <= 7) return 76;
  if (days <= 14) return 58;
  if (days <= 30) return 38;
  if (days <= 90) return 22;
  return 10;
}

function classifySignal(text) {
  const input = String(text || '');
  return typeRules.find(([, pattern]) => pattern.test(input))?.[0] || 'OTHER';
}

function inferHorizon(text) {
  const value = normalizeText(text);
  if (/\b(now|today|available|released|launch|ga|immediate)\b/.test(value)) return 'now';
  if (/\b(research|prototype|preview|roadmap|pilot|emerging)\b/.test(value)) return 'next';
  if (/\b(long.term|2030|future|frontier|fundamental)\b/.test(value)) return 'later';
  return 'next';
}

function keywordMatches(text, themes = []) {
  const haystack = normalizeText(text);
  return themes.map(theme => {
    const include = String(theme.include_keywords || '').split(',').map(item => normalizeText(item.trim())).filter(Boolean);
    const exclude = String(theme.exclude_keywords || '').split(',').map(item => normalizeText(item.trim())).filter(Boolean);
    const hits = include.filter(keyword => haystack.includes(keyword)).length;
    const blocked = exclude.filter(keyword => haystack.includes(keyword)).length;
    const score = clamp(25 + hits * 24 - blocked * 35);
    return { theme, hits, blocked, score };
  }).filter(item => item.hits > 0 && item.blocked === 0).sort((a, b) => b.score - a.score);
}

function uncertaintyScore(item) {
  let uncertainty = 8;
  if (!item.canonical_url) uncertainty += 24;
  if (!item.author) uncertainty += 8;
  if (!item.published_at) uncertainty += 18;
  if (!item.excerpt || item.excerpt.length < 80) uncertainty += 16;
  if (!item.content_hash) uncertainty += 18;
  return clamp(uncertainty);
}

function traceabilityScore(item) {
  let score = 15;
  if (item.canonical_url) score += 28;
  if (item.content_hash) score += 22;
  if (item.published_at) score += 14;
  if (item.source_name || item.source_id) score += 14;
  if (item.author) score += 7;
  return clamp(score);
}

function scoreSignal(input, context = {}) {
  const text = `${input.title || ''} ${input.excerpt || ''}`;
  const matches = keywordMatches(text, context.themes || []);
  const relevance = matches.length ? clamp(Math.max(...matches.map(item => item.score))) : 38;
  const freshness = freshnessScore(input.published_at, context.now || new Date());
  const authority = clamp(input.authority ?? context.sourceAuthority ?? 60);
  const novelty = clamp(input.novelty ?? 82);
  const corroboration = clamp(input.corroboration ?? 28);
  const traceability = traceabilityScore(input);
  const uncertainty = uncertaintyScore(input);
  const traceScore = clamp(
    relevance * 0.25 + novelty * 0.18 + authority * 0.18 + corroboration * 0.14 +
    freshness * 0.12 + traceability * 0.13 - uncertainty * 0.12
  );
  const hypeGap = clamp(((novelty + freshness + relevance) / 3) - ((authority + corroboration + traceability) / 3));
  const confidence = clamp(traceScore * 0.72 + (100 - uncertainty) * 0.28);
  let status = 'IGNORE';
  if (traceScore >= 78 && uncertainty <= 35) status = 'BRIEF';
  else if (traceScore >= 63) status = 'INVESTIGATE';
  else if (traceScore >= 43) status = 'WATCH';
  return {
    signal_type: SIGNAL_TYPES.includes(input.signal_type) ? input.signal_type : classifySignal(text),
    horizon: ['now', 'next', 'later'].includes(input.horizon) ? input.horizon : inferHorizon(text),
    relevance, novelty, authority, corroboration, freshness, traceability, uncertainty,
    trace_score: traceScore, hype_gap: hypeGap, confidence, status, matches
  };
}

module.exports = {
  SIGNAL_TYPES,
  clamp,
  normalizeText,
  tokens,
  similarity,
  freshnessScore,
  classifySignal,
  inferHorizon,
  keywordMatches,
  uncertaintyScore,
  traceabilityScore,
  scoreSignal
};
