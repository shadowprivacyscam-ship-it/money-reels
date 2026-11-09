// Angeleno Ledger: live data for the page. /api/quotes and /api/news; everything else is the static site.
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AngelenoLedger/1.0)', 'Accept': '*/*' };
const MEM = new Map();
async function cached(key, ttl, fn) {
  const hit = MEM.get(key);
  if (hit && Date.now() - hit.t < ttl * 1000) return hit.v;
  const v = await fn();
  MEM.set(key, { t: Date.now(), v });
  return v;
}
const thin = (a, n) => { if (a.length <= n) return a; const out = []; for (let i = 0; i < n; i++) out.push(a[Math.round(i * (a.length - 1) / (n - 1))]); return out; };

async function yahoo(sym) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m`;
  const r = await fetch(u, { headers: UA, cf: { cacheTtl: 30 } });
  if (!r.ok) throw new Error('yahoo ' + r.status);
  const j = await r.json(); const res = j.chart.result[0]; const m = res.meta;
  const closes = ((res.indicators.quote[0] || {}).close || []).filter(x => x != null);
  const price = m.regularMarketPrice, prev = m.chartPreviousClose ?? m.previousClose;
  return { price, prev, chg: prev ? (price - prev) / prev * 100 : null, spark: thin(closes, 72), time: m.regularMarketTime * 1000, src: 'Yahoo Finance' };
}
async function coinbase(pair) {
  const r = await fetch(`https://api.exchange.coinbase.com/products/${pair}/candles?granularity=900`, { headers: UA });
  if (!r.ok) throw new Error('coinbase ' + r.status);
  const c = (await r.json()).slice(0, 97).reverse(); // last 24h, oldest first
  const closes = c.map(x => x[4]); const price = closes[closes.length - 1], prev = closes[0];
  return { price, prev, chg: (price - prev) / prev * 100, spark: thin(closes, 72), time: c[c.length - 1][0] * 1000, src: 'Coinbase', h24: true };
}
const SYMS = { spx: '^GSPC', ndx: '^IXIC', dji: '^DJI', gold: 'GC=F', oil: 'BZ=F', tnx: '^TNX' };

async function quotes() {
  return cached('quotes', 45, async () => {
    const out = { updated: Date.now() };
    const jobs = Object.entries(SYMS).map(async ([k, s]) => { try { out[k] = await yahoo(s); } catch (e) { out[k] = { err: String(e.message) }; } });
    jobs.push((async () => { try { out.btc = await coinbase('BTC-USD'); } catch (e) { try { out.btc = await yahoo('BTC-USD'); } catch (e2) { out.btc = { err: 'btc' }; } } })());
    jobs.push((async () => { try { out.eth = await coinbase('ETH-USD'); } catch (e) { try { out.eth = await yahoo('ETH-USD'); } catch (e2) { out.eth = { err: 'eth' }; } } })());
    await Promise.all(jobs);
    return out;
  });
}

const unx = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '').trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? unx(m[1]) : ''; };
// Fixed feeds used when search feeds are unavailable; picked by keywords in the query.
const FEEDS = [
  [/tariff|customs|import|trade/i, ['https://www.cnbc.com/id/20910258/device/rss/rss.html', 'https://feeds.bbci.co.uk/news/business/rss.xml']],
  [/ukraine|iran|congress|world/i, ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://www.cnbc.com/id/100727362/device/rss/rss.html']],
  [/artificial|\bai\b|tech/i, ['https://www.cnbc.com/id/19854910/device/rss/rss.html', 'https://feeds.bbci.co.uk/news/technology/rss.xml']],
  [/california|los angeles/i, ['https://calmatters.org/feed/', 'https://www.cnbc.com/id/100003114/device/rss/rss.html']],
  [/./, ['https://www.cnbc.com/id/100003114/device/rss/rss.html', 'https://feeds.bbci.co.uk/news/business/rss.xml']],
];
function parseRSS(xml, fallbackSource) {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/g) || []).slice(0, 10).map(it => {
    const source = tag(it, 'source') || tag(it, 'News:Source') || fallbackSource || ''; let title = tag(it, 'title');
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    return { title, link: tag(it, 'link'), source, time: Date.parse(tag(it, 'pubDate')) || null };
  }).filter(x => x.title && x.link);
}
async function grab(u, src) {
  const r = await fetch(u, { headers: UA, cf: { cacheTtl: 300 } });
  if (!r.ok) throw new Error(src + ' ' + r.status);
  const items = parseRSS(await r.text(), src);
  if (!items.length) throw new Error(src + ' empty');
  return items;
}
async function news(q) {
  return cached('news:' + q, 300, async () => {
    const tries = [
      [`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:2d&hl=en-US&gl=US&ceid=US:en`, ''],
      [`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=en-US&cc=us`, ''],
    ];
    const names = { 'cnbc.com': 'CNBC', 'bbci.co.uk': 'BBC News', 'calmatters.org': 'CalMatters' };
    for (const u of FEEDS.find(([re]) => re.test(q))[1]) tries.push([u, Object.entries(names).find(([d]) => u.includes(d))[1]]);
    const errs = [];
    for (const [u, src] of tries) {
      try { const items = await grab(u, src || new URL(u).hostname); return { q, updated: Date.now(), via: new URL(u).hostname, items }; }
      catch (e) { errs.push(String(e.message)); }
    }
    throw new Error(errs.join('; '));
  });
}

// Each morning's edition lives in GitHub; the page is assembled from template + edition.
const GH = 'https://raw.githubusercontent.com/shadowprivacyscam-ship-it/money-reels/main/ledger/';
async function gh(path) {
  const r = await fetch(GH + path + '?t=' + Math.floor(Date.now() / 120000), { headers: UA });
  if (!r.ok) throw new Error('gh ' + r.status);
  return r.text();
}
async function edition() {
  return cached('edition', 120, async () => {
    const d = JSON.parse(await gh('edition.json'));
    if (!d.edition || !Array.isArray(d.stories) || !d.stories.length) throw new Error('bad edition');
    return d;
  });
}
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function page() {
  return cached('page', 120, async () => {
    const [tpl, d] = await Promise.all([gh('site/template.html'), edition()]);
    if (!tpl.includes('/*__DATA__*/null')) throw new Error('bad template');
    const data = JSON.stringify(d).replace(/</g, '\\u003c');
    return tpl.replace('/*__DATA__*/null', () => data).replace('__TITLE__', () => escH(d.edition.paper + ' · ' + d.edition.date_short));
  });
}

const json = (o, s = 200, age = 30) => new Response(JSON.stringify(o), { status: s, headers: {
  'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${age}`, 'access-control-allow-origin': '*' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/quotes') return json(await quotes(), 200, 30);
      if (url.pathname === '/api/edition') return json(await edition(), 200, 60);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        try { return new Response(await page(), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } }); }
        catch (e) { return env.ASSETS.fetch(request); }
      }
      if (url.pathname === '/api/news') return json(await news((url.searchParams.get('q') || 'business news').slice(0, 120)), 200, 120);
    } catch (e) { return json({ error: String(e.message || e) }, 502, 5); }
    return env.ASSETS.fetch(request);
  }
};
