'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_BYTES = 2_750_000;
const MAX_ITEMS = 30;
const USER_AGENT = 'RADARLINE/1.0 (+local technology intelligence workspace)';

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function stripMarkup(value) {
  return decodeEntities(String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

function excerpt(value, length = 620) {
  const clean = stripMarkup(value);
  return clean.length > length ? `${clean.slice(0, length - 1).trim()}…` : clean;
}

function tagValue(block, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(block || '').match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (match) return stripMarkup(match[1]);
  }
  return '';
}

function linkValue(block, baseUrl) {
  const rss = tagValue(block, ['link']);
  const atom = String(block || '').match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || '';
  const raw = rss || atom;
  if (!raw) return '';
  try { return new URL(raw, baseUrl).toString(); } catch { return raw; }
}

function isoDate(value) {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeItem(item, source) {
  const title = stripMarkup(item.title) || 'Untitled signal';
  const body = excerpt(item.excerpt || item.content || item.description || '');
  const canonicalUrl = item.canonical_url || item.url || '';
  const publishedAt = isoDate(item.published_at || item.date);
  const externalId = String(item.external_id || item.id || canonicalUrl || hash(`${title}|${publishedAt}`));
  return {
    external_id: externalId.slice(0, 500),
    canonical_url: canonicalUrl,
    title: title.slice(0, 500),
    author: stripMarkup(item.author || '').slice(0, 220),
    excerpt: body,
    published_at: publishedAt,
    content_hash: hash(`${title}\n${body}\n${canonicalUrl}`),
    source_name: source.name
  };
}

function parseXmlFeed(xml, source) {
  const items = [...String(xml).matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0, MAX_ITEMS);
  return items.map(([, , block]) => normalizeItem({
    title: tagValue(block, ['title']),
    canonical_url: linkValue(block, source.url),
    external_id: tagValue(block, ['guid', 'id']),
    author: tagValue(block, ['dc:creator', 'author', 'name']),
    excerpt: tagValue(block, ['content:encoded', 'summary', 'description', 'content']),
    published_at: tagValue(block, ['pubDate', 'published', 'updated', 'dc:date'])
  }, source)).filter(item => item.title && item.canonical_url);
}

function parseJsonFeed(payload, source) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const rows = Array.isArray(data) ? data : data.items || data.hits || [];
  return rows.slice(0, MAX_ITEMS).map(item => normalizeItem({
    title: item.title || item.name,
    canonical_url: item.url || item.external_url || item.html_url || item.home_page_url,
    external_id: item.id || item.objectID || item.node_id || item.url,
    author: item.author?.name || item.author || item.user || item.author_name,
    excerpt: item.summary || item.content_text || item.content_html || item.description || item.story_text || item.body,
    published_at: item.date_published || item.published_at || item.created_at || item.created_at_i && new Date(item.created_at_i * 1000).toISOString()
  }, source)).filter(item => item.title && item.canonical_url);
}

function isPrivateIp(hostname) {
  if (net.isIP(hostname) === 4) {
    const parts = hostname.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  }
  return net.isIP(hostname) === 6 && ['::1', 'fc', 'fd', 'fe80'].some(prefix => hostname.toLowerCase().startsWith(prefix));
}

function assertPublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) sources are supported.');
  if (url.username || url.password) throw new Error('Source URLs may not contain credentials.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || isPrivateIp(host)) throw new Error('Private network sources are blocked by default.');
  return url;
}

async function assertPublicResolution(hostname) {
  if (net.isIP(hostname)) return;
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
    throw new Error('Source hostname resolves to a private network address.');
  }
}

async function fetchPayload(url, accept = 'application/rss+xml, application/atom+xml, application/feed+json, application/json, text/html;q=0.8') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    let current = assertPublicUrl(url);
    for (let redirect = 0; redirect <= 5; redirect += 1) {
      await assertPublicResolution(current.hostname);
      const response = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, Accept: accept }
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        if (redirect === 5) throw new Error('Source redirected too many times.');
        current = assertPublicUrl(new URL(response.headers.get('location'), current).toString());
        continue;
      }
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
      const announced = Number(response.headers.get('content-length') || 0);
      if (announced > MAX_BYTES) throw new Error('Source payload is larger than the safety limit.');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_BYTES) throw new Error('Source payload is larger than the safety limit.');
      return { body: bytes.toString('utf8'), contentType: response.headers.get('content-type') || '', finalUrl: current.toString() };
    }
    throw new Error('Source redirect handling failed.');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Source request timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function githubApiUrl(value) {
  const url = new URL(value);
  if (url.hostname === 'api.github.com') return url.toString();
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname !== 'github.com' || parts.length < 2) throw new Error('GitHub connector expects a repository URL.');
  return `https://api.github.com/repos/${parts[0]}/${parts[1]}/releases?per_page=${MAX_ITEMS}`;
}

async function fetchGithub(source) {
  const payload = await fetchPayload(githubApiUrl(source.url), 'application/vnd.github+json');
  const releases = JSON.parse(payload.body);
  return releases.slice(0, MAX_ITEMS).map(release => normalizeItem({
    title: `${release.name || release.tag_name} — ${source.name}`,
    canonical_url: release.html_url,
    external_id: release.node_id || release.id,
    author: release.author?.login || '',
    excerpt: release.body || `Release ${release.tag_name}`,
    published_at: release.published_at || release.created_at
  }, source));
}

async function fetchHackerNews(source) {
  const payload = await fetchPayload(source.url, 'application/json');
  const data = JSON.parse(payload.body);
  return (data.hits || []).slice(0, MAX_ITEMS).map(item => normalizeItem({
    title: item.title || item.story_title,
    canonical_url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    external_id: item.objectID,
    author: item.author,
    excerpt: item.story_text || `${item.points || 0} points · ${item.num_comments || 0} comments`,
    published_at: item.created_at
  }, source)).filter(item => item.title);
}

async function fetchWebPage(source) {
  const payload = await fetchPayload(source.url, 'text/html,application/xhtml+xml');
  const title = stripMarkup(payload.body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || source.name);
  const description = decodeEntities(payload.body.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1] || '');
  return [normalizeItem({
    title,
    canonical_url: payload.finalUrl || source.url,
    external_id: hash(payload.body),
    excerpt: description || excerpt(payload.body),
    published_at: new Date().toISOString()
  }, source)];
}

async function fetchFeed(source) {
  const payload = await fetchPayload(source.url);
  if (/json/i.test(payload.contentType) || /^[\s\n]*[\[{]/.test(payload.body)) return parseJsonFeed(payload.body, source);
  return parseXmlFeed(payload.body, source);
}

async function fetchSource(source) {
  const connector = String(source.connector || 'rss').toLowerCase();
  if (connector === 'manual') return [];
  if (connector === 'github') return fetchGithub(source);
  if (connector === 'hackernews') return fetchHackerNews(source);
  if (connector === 'web') return fetchWebPage(source);
  if (connector === 'json') {
    const payload = await fetchPayload(source.url, 'application/json, application/feed+json');
    return parseJsonFeed(payload.body, source);
  }
  return fetchFeed(source);
}

module.exports = {
  MAX_ITEMS,
  hash,
  decodeEntities,
  stripMarkup,
  excerpt,
  isoDate,
  normalizeItem,
  parseXmlFeed,
  parseJsonFeed,
  assertPublicUrl,
  assertPublicResolution,
  githubApiUrl,
  fetchSource
};
