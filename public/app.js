"use strict";
/* FSAHIN.COM V4 — Palantir surface. All data real; interpolation/dead-reckoning of real fixes is labeled. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const RM = matchMedia("(prefers-reduced-motion:reduce)").matches;
const pad = (n) => String(n).padStart(2, "0");
const tstr = () => { const d = new Date(Date.now() + 3 * 36e5); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };

/* ---------- CLOCK ---------- */
function tick() { $("#clock").textContent = tstr() + " UTC+3"; }
setInterval(tick, 1000); tick();

/* ---------- EVENT LOG (yalnızca gerçek güncellemeler) ---------- */
const sysBuf = []; /* sohbet paneline akan gerçek sistem olayları */
function logEvent(tag, text, cls) {
  const body = $("#elog-body");
  if (body) {
    const line = document.createElement("div");
    line.className = "el" + (cls ? " " + cls : "");
    const i = document.createElement("i"); i.textContent = tstr();
    const b = document.createElement("b"); b.textContent = tag;
    const s = document.createElement("span"); s.textContent = text;
    line.append(i, b, s);
    body.prepend(line);
    while (body.children.length > 40) body.lastChild.remove();
  }
  sysBuf.push({ t: Date.now(), tag, text });
  while (sysBuf.length > 25) sysBuf.shift();
  const chat = $("#chat");
  if (chat && chat.classList.contains("open")) renderWall(lastWall);
}

/* ---------- FEED STATUS ---------- */
const FEED_NAMES = { quakes: "QUAKES", events: "FIRES", iss: "ISS", flights: "FLIGHTS", news: "NEWS", trnews: "TR NEWS", trwx: "TR CITIES", aqi: "TR AQI", markets: "MARKETS", space: "SPACE WX", mempool: "MEMPOOL", wall: "SOHBET", pulse: "PULSE" };
const STATUS = {};
function setStatus(name, ok) {
  STATUS[name] = { ok, at: Date.now() };
  const tot = Object.keys(FEED_NAMES).length;
  const oks = Object.keys(FEED_NAMES).filter((k) => STATUS[k] && STATUS[k].ok).length;
  const el = $("#feedcount");
  el.textContent = `${oks}/${tot} FEEDS LIVE`;
  el.classList.toggle("bad", Object.keys(STATUS).some((k) => !STATUS[k].ok));
  $("#lostbar").innerHTML = Object.keys(FEED_NAMES)
    .filter((k) => STATUS[k] && !STATUS[k].ok)
    .map((k) => `<span class="lostchip">${FEED_NAMES[k]} · SIGNAL LOST</span>`).join("");
}
async function feed(name) {
  const r = await fetch("/api/" + name);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || r.status);
  setStatus(name, true);
  return j;
}

/* ---------- MAP — zoom-deep: uydudan sokak seviyesine ---------- */
const map = L.map("map", {
  zoomControl: false, attributionControl: false, worldCopyJump: true,
  minZoom: 3, maxZoom: 17, zoomSnap: 0.5, wheelPxPerZoomLevel: 90,
}).setView([39, 33], 4.4);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 17, subdomains: "abcd" }).addTo(map);
const night = L.tileLayer("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
  { maxZoom: 17, maxNativeZoom: 8, opacity: 0.88, bounds: [[-85, -180], [85, 180]] }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", { maxZoom: 17, subdomains: "abcd", opacity: 0.75 }).addTo(map);

const quakeL = L.layerGroup().addTo(map);
const fireL = L.layerGroup().addTo(map);
const issL = L.layerGroup().addTo(map);
const flightL = L.layerGroup().addTo(map);

let zoomBucket = 0;
const zScale = () => [1, 1.3, 1.7][zoomBucket];
map.on("zoomend", () => {
  const z = map.getZoom();
  night.setOpacity(z <= 8 ? 0.88 : Math.max(0, 0.88 - (z - 8) * 0.3)); /* şehir zoomunda sokaklar öne çıkar */
  const zb = z < 6 ? 0 : z < 9 ? 1 : 2;
  if (zb !== zoomBucket) { zoomBucket = zb; renderQuakes(); renderFlights(); }
});

/* idle drift — any input pauses */
let lastUser = Date.now();
["pointerdown", "wheel", "touchstart", "keydown"].forEach((ev) =>
  addEventListener(ev, () => { lastUser = Date.now(); const h = $("#hint"); if (h) h.classList.add("gone"); }, { passive: true }));
(function drift() {
  if (Date.now() - lastUser > 9000 && !document.hidden && map.getZoom() < 6) map.panBy([0.4, 0], { animate: false });
  requestAnimationFrame(drift);
})();

const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m}dk` : `${Math.round(m / 60)}sa`; };
const inTR = (c) => c[0] > 35.5 && c[0] < 42.3 && c[1] > 25.5 && c[1] < 45.0;
function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
const newsSearch = (q) => `<a class="plink sec" href="https://news.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">HABER ARA ↗</a>`;

/* ---------- GLYPHS ---------- */
const PLANE_PATH = "M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z";
const FIRE_PATH = "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z";
function quakeIcon(m, hot) {
  const col = hot ? "#ff3355" : "#ffb000";
  const s = Math.round((15 + (m || 0) * 3) * zScale());
  return L.divIcon({ className: "", iconSize: [s, s], iconAnchor: [s / 2, s / 2],
    html: `<svg class="qk ${hot ? "hot" : ""}" viewBox="0 0 24 24" width="${s}" height="${s}"><circle cx="12" cy="12" r="3.2" fill="${col}"/><circle cx="12" cy="12" r="7" fill="none" stroke="${col}" stroke-width="1.4" opacity=".55"/><circle cx="12" cy="12" r="10.4" fill="none" stroke="${col}" stroke-width="1" opacity=".28"/></svg>` });
}
function fireIcon(isFire) {
  return L.divIcon({ className: "", iconSize: [15, 15], iconAnchor: [7, 7],
    html: isFire
      ? `<svg class="fireG" viewBox="0 0 24 24" width="15" height="15"><path d="${FIRE_PATH}" fill="#ff7a00"/></svg>`
      : `<svg class="stormG" viewBox="0 0 24 24" width="14" height="14"><rect x="8" y="8" width="8" height="8" fill="none" stroke="#7cd5ff" stroke-width="1.6" transform="rotate(45 12 12)"/></svg>` });
}
function planeIcon(trk) {
  const s = Math.round(13 * zScale());
  return L.divIcon({ className: "", iconSize: [s, s], iconAnchor: [s / 2, s / 2],
    html: `<div class="planeW" style="transform:rotate(${trk || 0}deg)"><svg viewBox="0 0 24 24" width="${s}" height="${s}"><path d="${PLANE_PATH}" fill="#7cd5ff"/></svg></div>` });
}

/* ---------- QUAKES (USGS M2.5+, 24h) ---------- */
let lastQuakes = [], lastQuakeT = 0;
function renderQuakes() {
  quakeL.clearLayers();
  lastQuakes.forEach((q) => {
    const m = q.m || 0, hot = m >= 5;
    const links =
      (q.url ? `<a class="plink" href="${encodeURI(q.url)}" target="_blank" rel="noopener">USGS RAPORU ↗</a> ` : "") +
      (inTR(q.c) ? `<a class="plink" href="https://deprem.afad.gov.tr/last-earthquakes.html" target="_blank" rel="noopener">AFAD ↗</a> ` : "") +
      newsSearch("earthquake " + (q.place || ""));
    L.marker(q.c, { icon: quakeIcon(m, hot) })
      .bindPopup(`<b>M${m.toFixed(1)}</b> ${esc(q.place || "")}<br><span class="pmeta">${q.d != null ? q.d.toFixed(0) + " km derinlik · " : ""}${ago(q.t)} önce · USGS</span><br>${links}`)
      .addTo(quakeL);
    if (hot && Date.now() - q.t < 6 * 36e5)
      L.marker(q.c, { icon: L.divIcon({ className: "", html: '<div class="qpulse" style="width:30px;height:30px"></div>', iconSize: [30, 30], iconAnchor: [15, 15] }), interactive: false }).addTo(quakeL);
  });
}
async function quakes() {
  try {
    const { data } = await feed("quakes");
    lastQuakes = data;
    renderQuakes();
    const newest = data.reduce((a, b) => (b.t > a.t ? b : a), data[0] || { t: 0 });
    if (newest.t > lastQuakeT) { lastQuakeT = newest.t; logEvent("QUAKE", `M${(newest.m || 0).toFixed(1)} ${newest.place || ""}`, "q"); }
  } catch (e) { setStatus("quakes", false); quakeL.clearLayers(); }
}
quakes(); setInterval(quakes, 120000);

/* ---------- FIRES / EVENTS (NASA EONET) ---------- */
async function fires() {
  try {
    const { data } = await feed("events");
    fireL.clearLayers();
    data.forEach((ev) => {
      const fire = ev.cat === "wildfires";
      const links =
        (ev.u ? `<a class="plink" href="${encodeURI(ev.u)}" target="_blank" rel="noopener">KAYNAK ↗</a> ` : "") + newsSearch(ev.title);
      L.marker(ev.c, { icon: fireIcon(fire) })
        .bindPopup(`<b>${esc(ev.title)}</b><br><span class="pmeta">NASA EONET · ${ev.cat}</span><br>${links}`).addTo(fireL);
    });
    logEvent("EONET", `${data.length} aktif doğa olayı`, "f");
    /* YANGIN GÖZÜ — TR ve yakın çevresinde aktif yangın taraması (EONET gerçek verisi) */
    const near = data.filter((ev) => ev.cat === "wildfires" && ev.c[0] > 34 && ev.c[0] < 43.5 && ev.c[1] > 23 && ev.c[1] < 47);
    const fw = $("#firewatch");
    if (fw) {
      fw.className = "firewatch " + (near.length ? "alert" : "clear");
      fw.textContent = near.length ? `YANGIN GÖZÜ · TR ÇEVRESİ ${near.length} ODAK` : "YANGIN GÖZÜ · TEMİZ";
      if (near.length) logEvent("YANGIN", `TR çevresinde ${near.length} aktif odak — ${near[0].title}`, "q");
    }
  } catch (e) { setStatus("events", false); fireL.clearLayers(); }
}
fires(); setInterval(fires, 600000);

/* ---------- ISS (gerçek fix + ara değerleme ile akıcı yörünge) ---------- */
let issM = null, issFix = null, issPrev = null, issN = 0;
const trail = [];
const issTrail = L.polyline([], { color: "#7cd5ff", weight: 1.5, opacity: 0.55, dashArray: "2 5" }).addTo(issL);
const issIcon = L.divIcon({ className: "", html: '<div class="iss-ico">◈ ISS</div>', iconSize: [52, 16], iconAnchor: [8, 8] });
async function iss() {
  try {
    const { data: d } = await feed("iss");
    issPrev = issFix; issFix = { lat: d.lat, lng: d.lng, t: Date.now() };
    const ll = [d.lat, d.lng];
    if (!issM) issM = L.marker(ll, { icon: issIcon }).addTo(issL);
    trail.push(ll); if (trail.length > 90) trail.shift();
    issTrail.setLatLngs(trail);
    $("#iss-hud").innerHTML = d.vel
      ? `ISS · <span class="cyan">${d.vel.toFixed(0)} km/h</span> · ${d.alt.toFixed(0)} km`
      : 'ISS · <span class="cyan">LIVE</span>';
    if (++issN % 3 === 0) logEvent("ISS", `${d.lat.toFixed(1)}, ${d.lng.toFixed(1)}${d.vel ? " · " + d.vel.toFixed(0) + " km/h" : ""}`, "i");
  } catch (e) { setStatus("iss", false); $("#iss-hud").innerHTML = 'ISS · <span class="red">SIGNAL LOST</span>'; }
}
iss(); setInterval(iss, 10000);
(function issAnim() {
  if (issM && issFix && issPrev) {
    const dt = issFix.t - issPrev.t, age = Date.now() - issFix.t;
    if (dt > 0 && age < 30000) {
      const k = age / dt;
      issM.setLatLng([issFix.lat + (issFix.lat - issPrev.lat) * k, issFix.lng + (issFix.lng - issPrev.lng) * k]);
    }
  }
  requestAnimationFrame(issAnim);
})();

/* ---------- FLIGHTS (ADS-B grid; gerçek hız+rota ile dead-reckoning) ---------- */
let lastFlights = [], flightMs = [];
function renderFlights() {
  flightL.clearLayers(); flightMs = [];
  lastFlights.forEach((f) => {
    const m = L.marker([f.lat, f.lng], { icon: planeIcon(f.trk) });
    if (f.cs) m.bindTooltip(`${f.cs} · ${f.v ? f.v.toFixed(0) + " kt · " : ""}dead-reckoned`, { className: "ftip", direction: "top" });
    m.addTo(flightL);
    flightMs.push({ m, f });
  });
}
async function flights() {
  try {
    const { data } = await feed("flights");
    lastFlights = data.map((f) => ({ cs: f.cs, lat: f.c[0], lng: f.c[1], trk: f.trk || 0, v: f.v || 0 }));
    renderFlights();
    logEvent("ADS-B", `${data.length} uçak izleniyor`, "p");
  } catch (e) { setStatus("flights", false); flightL.clearLayers(); flightMs = []; }
}
flights(); setInterval(flights, 300000);
setInterval(() => {
  if (document.hidden) return;
  flightMs.forEach((o) => {
    if (!o.f.v) return;
    const km = o.f.v * 1.852 / 3600; /* gerçek yer hızı, 1 sn ilerletme */
    const rad = (o.f.trk || 0) * Math.PI / 180;
    o.f.lat += (km / 111) * Math.cos(rad);
    o.f.lng += (km / (111 * Math.cos(o.f.lat * Math.PI / 180))) * Math.sin(rad);
    o.m.setLatLng([o.f.lat, o.f.lng]);
  });
}, 1000);

/* ---------- 24H QUAKE REPLAY (gerçek olayların yeniden oynatımı — etiketli) ---------- */
let rp = 0;
setInterval(() => {
  if (!lastQuakes.length || document.hidden) return;
  const q = lastQuakes[rp++ % lastQuakes.length];
  const mk = L.marker(q.c, { icon: L.divIcon({ className: "", html: '<div class="qpulse" style="width:22px;height:22px"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(map);
  setTimeout(() => map.removeLayer(mk), 1900);
}, 4000);

/* ---------- TÜRKİYE ŞEHİRLERİ (Open-Meteo canlı hava — tıklanabilir gerçek noktalar) ---------- */
const trL = L.layerGroup().addTo(map);
const WCODE = { 0: "açık", 1: "az bulutlu", 2: "parçalı bulutlu", 3: "kapalı", 45: "sisli", 48: "sisli", 51: "çiseleme", 61: "yağmurlu", 63: "yağmurlu", 65: "sağanak", 71: "karlı", 73: "karlı", 75: "yoğun kar", 80: "sağanak", 95: "fırtınalı" };
async function trcities() {
  let aq = {};
  try {
    const a = await feed("aqi");
    a.data.forEach((x) => { aq[x.n] = x.aqi; });
  } catch (e) { setStatus("aqi", false); }
  try {
    const { data } = await feed("trwx");
    trL.clearLayers();
    data.forEach((c) => {
      const aqi = aq[c.n];
      L.marker(c.c, { icon: L.divIcon({ className: "", iconSize: [12, 12], iconAnchor: [6, 6], html: '<div class="trdot"></div>' }) })
        .bindPopup(`<b>${esc(c.n)}</b><br><span class="pmeta">${c.t != null ? c.t.toFixed(1) + "°C · " : ""}${c.w != null ? "rüzgar " + c.w.toFixed(0) + " km/h · " : ""}${WCODE[c.wc] || ""}${aqi != null ? " · AQI " + Math.round(aqi) : ""} · OPEN-METEO CANLI</span><br>${newsSearch(c.n + " son dakika")}`)
        .addTo(trL);
    });
    logEvent("TRWX", `${data.length} şehirde canlı hava — ${data[0].n} ${data[0].t != null ? data[0].t.toFixed(0) + "°C" : ""}`, "f");
  } catch (e) { setStatus("trwx", false); trL.clearLayers(); }
}
trcities(); setInterval(trcities, 600000);

/* ---------- SPACE WX (NOAA Kp) + MEMPOOL (BTC ağ ücreti) — topbar ---------- */
async function space() {
  try {
    const { data } = await feed("space");
    const kp = +data.kp;
    $("#mk-kp").innerHTML = `<i>KP</i><span class="${kp >= 5 ? "red" : "cyan"}">${kp.toFixed(1)}</span>`;
    if (kp >= 5) logEvent("SPACE", `Jeomanyetik fırtına — Kp ${kp.toFixed(1)}`, "q");
  } catch (e) { setStatus("space", false); $("#mk-kp").innerHTML = ""; }
}
space(); setInterval(space, 600000);
async function mempool() {
  try {
    const { data } = await feed("mempool");
    $("#mk-fee").innerHTML = `<i>BTC FEE</i>${data.fast} <i>sat/vB</i>`;
  } catch (e) { setStatus("mempool", false); $("#mk-fee").innerHTML = ""; }
}
mempool(); setInterval(mempool, 120000);

/* ---------- SOHBET DUVARI (gerçek ziyaretçi mesajları — KV) ---------- */
let lastWall = [];
const hhmm = (t) => new Date(t + 3 * 36e5).toISOString().slice(11, 16);
function renderWall(msgs) {
  lastWall = msgs;
  const items = [
    ...msgs.map((x) => ({ t: x.t, h: `<div class="cm"><i>${hhmm(x.t)}</i><b>${esc(x.n)}</b>${esc(x.m)}</div>` })),
    ...sysBuf.map((s) => ({ t: s.t, h: `<div class="cm sys"><i>${hhmm(s.t)}</i><b>${esc(s.tag)}</b>${esc(s.text)}</div>` })),
  ].sort((a, b) => a.t - b.t);
  const body = $("#chat-body");
  body.innerHTML =
    '<div class="cm pin">FIRAT GROUP canlı terminal sohbeti — istek ve önerini yaz, Baran okuyor. Gri satırlar sistemin gerçek veri akışıdır; dakikada 1 mesaj hakkın var.</div>' +
    items.map((i) => i.h).join("");
  body.scrollTop = body.scrollHeight;
}
async function wallPoll() {
  try { const { data } = await feed("wall"); renderWall(data); }
  catch (e) { setStatus("wall", false); }
}
wallPoll();
setInterval(() => { if ($("#chat").classList.contains("open")) wallPoll(); }, 5000);
$("#chat-btn").addEventListener("click", () => { $("#chat").classList.toggle("open"); wallPoll(); });
$("#chat-close").addEventListener("click", () => $("#chat").classList.remove("open"));
$("#chat-name").value = localStorage.getItem("bfs-name") || "";
async function wallSend() {
  const name = $("#chat-name").value.trim(), msg = $("#chat-msg").value.trim();
  if (!msg) return;
  localStorage.setItem("bfs-name", name);
  const r = await fetch("/api/wall", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, msg }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { $("#chat-err").textContent = j.error || "gönderilemedi"; setTimeout(() => { $("#chat-err").textContent = ""; }, 4000); return; }
  $("#chat-msg").value = "";
  wallPoll();
}
$("#chat-send").addEventListener("click", wallSend);
$("#chat-msg").addEventListener("keydown", (e) => { if (e.key === "Enter") wallSend(); });

/* ---------- MARKETS (topbar) ---------- */
let lastBTC = null;
async function markets() {
  try {
    const { data } = await feed("markets");
    const fmt = (v, d = 0) => v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d });
    const coin = data.coins.map((c) => {
      const up = (c.chg || 0) >= 0;
      return `<span class="mk"><i>${c.code}</i>${fmt(c.usd)}<em class="${up ? "up" : "down"}">${up ? "▲" : "▼"}${Math.abs(c.chg || 0).toFixed(1)}%</em></span>`;
    }).join("");
    $("#mkts").innerHTML = coin +
      `<span class="mk"><i>USDTRY</i>${data.fx.USDTRY ? data.fx.USDTRY.toFixed(3) : "—"}</span>` +
      `<span class="mk"><i>EURUSD</i>${data.fx.EURUSD ? data.fx.EURUSD.toFixed(4) : "—"}</span>`;
    const btc = data.coins[0] && data.coins[0].usd;
    if (btc && btc !== lastBTC) { lastBTC = btc; logEvent("MKT", `BTC ${fmt(btc)} · USDTRY ${data.fx.USDTRY ? data.fx.USDTRY.toFixed(3) : "—"}`, "m"); }
  } catch (e) { setStatus("markets", false); $("#mkts").innerHTML = '<span class="mk red">MARKETS · SIGNAL LOST</span>'; }
}
markets(); setInterval(markets, 60000);

/* ---------- NEWS TICKER (TR + dünya, çift segment) ---------- */
async function news() {
  const [tr, world] = await Promise.all([
    feed("trnews").catch(() => { setStatus("trnews", false); return null; }),
    feed("news").catch(() => { setStatus("news", false); return null; }),
  ]);
  const items = [];
  if (tr) tr.data.forEach((n) => items.push({ ...n, tr: true }));
  if (world) world.data.items.forEach((n) => items.push({ t: n.title, u: n.url, s: "", tr: false }));
  if (!items.length) {
    $("#newsline").innerHTML = '<span class="ni"><b class="red">SIGNAL LOST</b></span>';
    $("#news-dot").className = "src-dot err";
    return;
  }
  const html = items.map((n) => {
    let host = ""; try { host = new URL(n.u).hostname.replace("www.", ""); } catch (e) {}
    return `<a class="ni" href="${encodeURI(n.u)}" target="_blank" rel="noopener">${n.tr ? '<span class="trtag">TR</span>' : ""}<b>${esc(n.t)}</b><span class="host">${n.s || host}</span></a>`;
  }).join("");
  $("#newsline").innerHTML = html + html;
  /* okunur hız: süre içerik uzunluğuna göre — insanlar okuyabilsin */
  $("#newsline").style.animationDuration = Math.max(150, items.length * 10) + "s";
  $("#news-dot").className = "src-dot ok";
  if (tr && tr.data[0]) logEvent("TR", tr.data[0].t.slice(0, 70), "n");
  else if (world && world.data.items[0]) logEvent("NEWS", world.data.items[0].title.slice(0, 70), "n");
}
news(); setInterval(news, 300000);

/* ---------- GLOBAL PULSE (Wikimedia EventStreams — saniyede yüzlerce gerçek olay) ---------- */
(function pulse() {
  const el = $("#pulse");
  if (!el || typeof EventSource === "undefined") return;
  let total = 0, win = [];
  try {
    const es = new EventSource("https://stream.wikimedia.org/v2/stream/recentchange");
    es.onmessage = () => { if (!total) setStatus("pulse", true); total++; win.push(Date.now()); };
    es.onerror = () => { if (!total) setStatus("pulse", false); };
    setInterval(() => {
      const now = Date.now();
      win = win.filter((t) => now - t < 1000);
      if (total > 0) el.textContent = `PULSE ${win.length}/s · ${total.toLocaleString("en-US")}`;
    }, 1000);
  } catch (e) { el.textContent = ""; setStatus("pulse", false); }
})();

/* ---------- VISITORS (gerçek KV sayacı — asla şişirilmez) ---------- */
let lastOnline = null;
async function stats(first) {
  try {
    const r = await fetch(first ? "/api/hit" : "/api/stats");
    const j = await r.json();
    if (!r.ok || j.error) throw 0;
    const d = j.data;
    $("#visitors").textContent = `BUGÜN ${d.today} · ONLINE ${Math.max(1, d.online)} · TOPLAM ${d.total}`;
    const co = $("#chat-online"); if (co) co.textContent = ` · ONLINE ${Math.max(1, d.online)}`;
    if (d.online !== lastOnline) { lastOnline = d.online; logEvent("VISITOR", `${Math.max(1, d.online)} online · bugün ${d.today}`, "v"); }
  } catch (e) { $("#visitors").textContent = ""; }
}
stats(true);
setInterval(() => stats(false), 30000);
setInterval(() => fetch("/api/hit?hb=1").catch(() => {}), 120000);

/* ---------- LIVE TV ---------- */
const TV = [
  ["DW", "UCknLrEdhRCp1aegoMqRaCZg"],
  ["FRANCE 24", "UCQfwfsi5VrQ8yKZ-UWmAEFg"],
  ["AL JAZEERA", "UCNye-wNBqNL5ZzHSJj3l8Bg"],
  ["TRT WORLD", "UC7fWeaHhqgM4Ry-RMpM2YYw"],
  ["EURONEWS", "UCSrZ3UV4jOidv8ppoVuvW9Q"],
  ["BLOOMBERG", "UCIALMKvObZNtJ6AmdCLP7Lg"],
  ["SKY NEWS", "UCoMdktPbSTixAyNGwb-UYkQ"],
];
function tvGo(i) {
  $("#tv-frame").src = `https://www.youtube.com/embed/live_stream?channel=${TV[i][1]}&autoplay=1`;
  $$(".tv-ch").forEach((b, k) => b.classList.toggle("on", k === i));
}
$("#tv-btn").addEventListener("click", () => {
  const w = $("#tv");
  if (w.classList.toggle("open")) { if (!$("#tv-frame").src) tvGo(0); }
  else $("#tv-frame").src = "";
});
$("#tv-close").addEventListener("click", () => { $("#tv").classList.remove("open"); $("#tv-frame").src = ""; });
$$(".tv-ch").forEach((b, i) => b.addEventListener("click", () => tvGo(i)));

/* ---------- IDENTITY OVERLAY ---------- */
$("#id-btn").addEventListener("click", () => { $("#idov").classList.add("open"); $("#idov-close").focus(); });
$("#idov-close").addEventListener("click", closeId);
function closeId() { $("#idov").classList.remove("open"); $("#id-btn").focus(); }
addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeId(); $("#tv").classList.remove("open"); $("#tv-frame").src = ""; }
});
