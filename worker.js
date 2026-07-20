// FSAHIN.COM V3 worker — static assets + honest API proxy-cache. No fabricated data.
// FAZ 0 curl results (2026-07-18): USGS 200 41KB | GIBS tile 200 | wheretheiss 200 |
// OpenSky 200 183KB | GDELT TIMEOUT >12s (HN fallback wired below) | Open-Meteo 200 |
// Open-Meteo AQ 200 | NOAA Kp 200 | EONET 200 | CoinGecko 200 | Frankfurter 200 | CARTO 200.

const UA = { "User-Agent": "fsahin.com-world-terminal/3.0" };

async function j(url, ms = 8000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return r.json();
}

const FEEDS = {
  quakes: {
    ttl: 120, source: "USGS",
    async get() {
      const d = await j("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
      return d.features.slice(0, 200).map((f) => ({
        m: f.properties.mag, place: f.properties.place, t: f.properties.time,
        url: f.properties.url, d: f.geometry.coordinates[2],
        c: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
      }));
    },
  },
  iss: {
    ttl: 10, source: "WHERETHEISS/OPEN-NOTIFY",
    async get() {
      try {
        const d = await j("https://api.wheretheiss.at/v1/satellites/25544", 6000);
        return { lat: d.latitude, lng: d.longitude, alt: d.altitude, vel: d.velocity, src: "WHERETHEISS" };
      } catch (e) {
        const d = await j("http://api.open-notify.org/iss-now.json", 9000);
        return { lat: +d.iss_position.latitude, lng: +d.iss_position.longitude, alt: null, vel: null, src: "OPEN-NOTIFY" };
      }
    },
  },
  flights: {
    ttl: 300, source: "ADS-B (AIRPLANES.LIVE/ADSB.LOL)",
    async get() {
      // 7-zone 250nm grid over Europe/TR/ME; two community mirrors per zone; dedupe by hex.
      const zones = [[51, 0], [48, 11], [40, -4], [42, 16], [52, 24], [39, 29], [38, 40]];
      async function zone(z) {
        for (const u of [`https://api.airplanes.live/v2/point/${z[0]}/${z[1]}/250`,
                         `https://api.adsb.lol/v2/point/${z[0]}/${z[1]}/250`]) {
          try { const r = await j(u, 8000); if (r && r.ac) return r.ac; } catch (e) {}
        }
        return [];
      }
      const all = (await Promise.all(zones.map(zone))).flat();
      const seen = new Map();
      for (const a of all) {
        if (a.lat == null || a.lon == null) continue;
        const k = a.hex || a.flight || `${a.lat.toFixed(2)},${a.lon.toFixed(2)}`;
        if (!seen.has(k)) seen.set(k, { cs: (a.flight || "").trim(), c: [a.lat, a.lon], trk: a.track || 0, v: a.gs || 0 });
      }
      if (!seen.size) throw new Error("no adsb source reachable");
      return [...seen.values()].slice(0, 400);
    },
  },
  aqi: {
    ttl: 600, source: "OPEN-METEO AQ",
    async get() {
      const C = [["İstanbul", 41.01, 28.98], ["Ankara", 39.93, 32.86], ["İzmir", 38.42, 27.14], ["Konya", 37.87, 32.49],
                 ["Bursa", 40.19, 29.06], ["Antalya", 36.90, 30.71], ["Adana", 37.00, 35.32], ["Gaziantep", 37.07, 37.38],
                 ["Kayseri", 38.72, 35.49], ["Trabzon", 41.00, 39.72], ["Diyarbakır", 37.91, 40.24], ["Erzurum", 39.90, 41.27],
                 ["Samsun", 41.29, 36.33], ["Van", 38.49, 43.38]];
      const d = await j(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${C.map(c => c[1]).join(",")}&longitude=${C.map(c => c[2]).join(",")}&current=us_aqi`);
      const arr = Array.isArray(d) ? d : [d];
      return C.map((c, i) => ({ n: c[0], aqi: arr[i] && arr[i].current ? arr[i].current.us_aqi : null }));
    },
  },
  mempool: {
    ttl: 120, source: "MEMPOOL.SPACE",
    async get() {
      const d = await j("https://mempool.space/api/v1/fees/recommended", 7000);
      return { fast: d.fastestFee, hour: d.hourFee };
    },
  },
  trwx: {
    ttl: 600, source: "OPEN-METEO",
    async get() {
      const C = [["İstanbul", 41.01, 28.98], ["Ankara", 39.93, 32.86], ["İzmir", 38.42, 27.14], ["Konya", 37.87, 32.49],
                 ["Bursa", 40.19, 29.06], ["Antalya", 36.90, 30.71], ["Adana", 37.00, 35.32], ["Gaziantep", 37.07, 37.38],
                 ["Kayseri", 38.72, 35.49], ["Trabzon", 41.00, 39.72], ["Diyarbakır", 37.91, 40.24], ["Erzurum", 39.90, 41.27],
                 ["Samsun", 41.29, 36.33], ["Van", 38.49, 43.38]];
      const d = await j(`https://api.open-meteo.com/v1/forecast?latitude=${C.map(c => c[1]).join(",")}&longitude=${C.map(c => c[2]).join(",")}&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`);
      const arr = Array.isArray(d) ? d : [d];
      return C.map((c, i) => ({
        n: c[0], c: [c[1], c[2]],
        t: arr[i] && arr[i].current ? arr[i].current.temperature_2m : null,
        w: arr[i] && arr[i].current ? arr[i].current.wind_speed_10m : null,
        wc: arr[i] && arr[i].current ? arr[i].current.weather_code : null,
      }));
    },
  },
  trnews: {
    ttl: 300, source: "TRT/AA RSS",
    async get() {
      const srcs = [["TRT", "https://www.trthaber.com/sondakika.rss"],
                    ["AA", "https://www.aa.com.tr/tr/rss/default?cat=guncel"],
                    ["HÜRRİYET", "https://www.hurriyet.com.tr/rss/anasayfa"],
                    ["CNN TÜRK", "https://www.cnnturk.com/feed/rss/all/news"]];
      const out = [];
      const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                  "Accept": "application/rss+xml, application/xml, text/xml, */*" };
      await Promise.all(srcs.map(async ([name, u]) => {
        try {
          const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(8000) });
          if (!r.ok) return;
          const xml = await r.text();
          for (const it of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8)) {
            const t = (it[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1];
            const l = (it[1].match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1];
            if (t && l) out.push({ t: t.trim(), u: l.trim(), s: name });
          }
        } catch (e) {}
      }));
      if (!out.length) throw new Error("no TR rss reachable");
      return out.slice(0, 16);
    },
  },
  news: {
    ttl: 300, source: "GDELT",
    async get() {
      try {
        const d = await j("https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:eng&mode=ArtList&maxrecords=18&timespan=2h&sort=DateDesc&format=json", 6000);
        if (!d.articles || !d.articles.length) throw new Error("gdelt empty");
        return { src: "GDELT", items: d.articles.map((a) => ({ title: a.title, url: a.url })) };
      } catch (e) {
        const d = await j("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=16", 6000);
        return { src: "HACKER NEWS", items: d.hits.map((h) => ({ title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}` })) };
      }
    },
  },
  weather: {
    ttl: 600, source: "OPEN-METEO",
    async get() {
      const [w, a] = await Promise.all([
        j("https://api.open-meteo.com/v1/forecast?latitude=37.8746&longitude=32.4932&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto"),
        j("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.8746&longitude=32.4932&current=us_aqi").catch(() => null),
      ]);
      return { temp: w.current.temperature_2m, wind: w.current.wind_speed_10m, code: w.current.weather_code, aqi: a && a.current ? a.current.us_aqi : null };
    },
  },
  space: {
    ttl: 600, source: "NOAA SWPC",
    async get() {
      const d = await j("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json");
      const rows = d.slice(-9);
      const last = rows[rows.length - 1];
      return { kp: last.Kp, t: last.time_tag, series: rows.map((r) => r.Kp) };
    },
  },
  events: {
    ttl: 600, source: "NASA EONET",
    async get() {
      const d = await j("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60");
      return d.events
        .map((e) => {
          const g = e.geometry && e.geometry[e.geometry.length - 1];
          if (!g || !g.coordinates || Array.isArray(g.coordinates[0])) return null;
          return { title: e.title, cat: (e.categories && e.categories[0] && e.categories[0].id) || "",
            u: (e.sources && e.sources[0] && e.sources[0].url) || null,
            c: [g.coordinates[1], g.coordinates[0]] };
        })
        .filter(Boolean);
    },
  },
  markets: {
    ttl: 60, source: "COINGECKO/KRAKEN + FRANKFURTER",
    async get() {
      // Crypto: CoinGecko rate-limits shared CF egress IPs — Kraken public is the reliable fallback.
      async function coinsCG() {
        const cg = await j("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd&include_24hr_change=true", 5000);
        return [
          { code: "BTC", usd: cg.bitcoin && cg.bitcoin.usd, chg: cg.bitcoin && cg.bitcoin.usd_24h_change },
          { code: "ETH", usd: cg.ethereum && cg.ethereum.usd, chg: cg.ethereum && cg.ethereum.usd_24h_change },
          { code: "PAXG", usd: cg["pax-gold"] && cg["pax-gold"].usd, chg: cg["pax-gold"] && cg["pax-gold"].usd_24h_change },
        ];
      }
      async function coinsKraken() {
        const d = await j("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,PAXGUSD", 6000);
        const r = d.result || {};
        const pick = (frag) => {
          const k = Object.keys(r).find((k) => k.includes(frag));
          if (!k) return { usd: null, chg: null };
          const last = +r[k].c[0], open = +r[k].o;
          return { usd: last, chg: open ? ((last / open) - 1) * 100 : null };
        };
        return [
          { code: "BTC", ...pick("XBT") },
          { code: "ETH", ...pick("ETH") },
          { code: "PAXG", ...pick("PAXG") },
        ];
      }
      async function fxGet() {
        try {
          const fx = await j("https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR", 5000);
          return { USDTRY: fx.rates.TRY, EURUSD: fx.rates.EUR ? +(1 / fx.rates.EUR).toFixed(4) : null, date: fx.date };
        } catch (e) {
          const d = await j("https://open.er-api.com/v6/latest/USD", 6000);
          return { USDTRY: d.rates && d.rates.TRY, EURUSD: d.rates && d.rates.EUR ? +(1 / d.rates.EUR).toFixed(4) : null, date: (d.time_last_update_utc || "").slice(5, 16) };
        }
      }
      const [coins, fx] = await Promise.all([
        coinsCG().catch(() => coinsKraken()),
        fxGet().catch(() => ({ USDTRY: null, EURUSD: null })),
      ]);
      return { coins, fx };
    },
  },
};

/* Real visitor counter — counts actual page hits in KV. No fabrication: starts at 0. */
async function statsHandler(env, isHit, isHeartbeat) {
  if (!env.STATS) return Response.json({ error: "stats disabled" }, { status: 503 });
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const s = (await env.STATS.get("stats", "json")) || { total: 0, days: {}, recent: [] };
  s.recent = (s.recent || []).filter((t) => now - t < 5 * 60000);
  if (isHit) {
    if (isHeartbeat) {
      s.recent.push(now); // presence only — total/today untouched, so counts stay honest
    } else {
      s.total++; s.days[day] = (s.days[day] || 0) + 1; s.recent.push(now);
      const keys = Object.keys(s.days).sort();
      while (keys.length > 60) delete s.days[keys.shift()];
    }
    await env.STATS.put("stats", JSON.stringify(s));
  }
  return Response.json(
    { source: "FSAHIN-KV", fetchedAt: new Date(now).toISOString(),
      data: { today: s.days[day] || 0, total: s.total, online: s.recent.length } },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/* Gerçek ziyaretçi duvarı — sohbet/öneri. KV'de saklanır; dakikada 1 mesaj/IP, günde 200 mesaj. */
async function wallHandler(req, env) {
  if (!env.STATS) return Response.json({ error: "wall disabled" }, { status: 503 });
  if (req.method === "POST") {
    const ip = req.headers.get("cf-connecting-ip") || "?";
    if (await env.STATS.get("rl:" + ip)) return Response.json({ error: "dakikada 1 mesaj — biraz bekle" }, { status: 429 });
    let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "bad body" }, { status: 400 }); }
    const name = String(b.name || "").slice(0, 24).trim() || "misafir";
    const msg = String(b.msg || "").slice(0, 240).trim();
    if (!msg) return Response.json({ error: "boş mesaj" }, { status: 400 });
    const w = (await env.STATS.get("wall", "json")) || { msgs: [], day: "", n: 0 };
    const today = new Date().toISOString().slice(0, 10);
    if (w.day !== today) { w.day = today; w.n = 0; }
    if (w.n >= 200) return Response.json({ error: "günlük mesaj limiti doldu" }, { status: 429 });
    w.n++; w.msgs.push({ n: name, m: msg, t: Date.now() });
    while (w.msgs.length > 100) w.msgs.shift();
    await env.STATS.put("wall", JSON.stringify(w));
    await env.STATS.put("rl:" + ip, "1", { expirationTtl: 60 });
    return Response.json({ ok: 1 });
  }
  const w = (await env.STATS.get("wall", "json")) || { msgs: [] };
  return Response.json(
    { source: "FSAHIN-KV", fetchedAt: new Date().toISOString(), data: w.msgs.slice(-60) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (!m) return env.ASSETS.fetch(req);
    if (m[1] === "hit") return statsHandler(env, true, url.searchParams.get("hb") === "1");
    if (m[1] === "stats") return statsHandler(env, false, false);
    if (m[1] === "wall") return wallHandler(req, env);
    const feed = FEEDS[m[1]];
    if (!feed) return Response.json({ error: "unknown feed" }, { status: 404 });

    const cache = caches.default;
    const key = new Request(url.origin + url.pathname);
    const hit = await cache.match(key);
    if (hit) return hit;

    try {
      const data = await feed.get();
      const res = Response.json(
        { source: feed.source, fetchedAt: new Date().toISOString(), data },
        { headers: { "Cache-Control": `public, s-maxage=${feed.ttl}, max-age=${feed.ttl}` } }
      );
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    } catch (e) {
      // Honest failure — no mock data, ever.
      return Response.json(
        { error: String((e && e.message) || e), source: feed.source, ts: new Date().toISOString() },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
  },
};
