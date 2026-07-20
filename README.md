<div align="center">

# fsahin.com — WORLD TERMINAL

**A fullscreen live-data world map. No frameworks, no fake data, one Cloudflare Worker.**

[![Live](https://img.shields.io/website?url=https%3A%2F%2Ffsahin.com&label=fsahin.com&up_message=LIVE&down_message=SIGNAL%20LOST&style=flat-square)](https://fsahin.com)
![JavaScript](https://img.shields.io/badge/vanilla_JS-zero_deps-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20KV-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-vendored-199900?style=flat-square&logo=leaflet&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-333?style=flat-square)

[**► OPEN THE TERMINAL**](https://fsahin.com)

<img src="docs/fsahin-live.png" alt="fsahin.com live world terminal" width="100%" />

</div>

---

## What it is

The entire site is a map. No scroll, no pages — a dark command-terminal view of Earth
streaming **13 real data feeds**, rendered with vanilla JS and vendored Leaflet,
served by a single Cloudflare Worker.

*Türkçe: Sitenin tamamı canlı bir dünya haritası — 13 gerçek veri akışı, sıfır framework, tek Worker.*

## Live feeds — all real, no fallbacks faked

| Feed | Source |
|---|---|
| Earthquakes (M2.5+, 24h) | USGS |
| ISS position + track | wheretheiss.at |
| Live aircraft | airplanes.live · adsb.lol |
| Wildfire watch (TR region alarm) | NASA EONET |
| Space weather (planetary Kp) | NOAA SWPC |
| Weather + TR air quality (14 cities) | Open-Meteo |
| BTC mempool fees | mempool.space |
| Crypto prices | CoinGecko · Kraken |
| FX rates | Frankfurter · ER-API |
| Türkiye news ticker | TRT · AA · Hürriyet · CNN Türk RSS |
| Global news | GDELT (Hacker News fallback) |
| Visitor counter + chat wall | Workers KV — every count and message is a real visitor |

**SIGNAL LOST design:** when an upstream dies, the UI says `SIGNAL LOST` instead of
rendering stale or invented data. The identity panel's "no fabricated data" promise is
enforced in code — the chat wall launched empty and only ever shows real messages
(1 msg/min per IP via KV TTL, daily cap, fully escaped rendering).

## Architecture

```mermaid
flowchart LR
    V[Visitor] --> W["Cloudflare Worker « b »"]
    W -->|static| A["ASSETS<br/>public/ — index.html · app.js · surface.css · vendored Leaflet"]
    W -->|"/api/*"| P["Feed proxies + cache"]
    P --> U["USGS · ISS · ADS-B · EONET · NOAA · Open-Meteo · mempool<br/>CoinGecko · Kraken · FX · TR RSS · GDELT/HN"]
    W <-->|counter · chat wall · rate limit| K[("Workers KV<br/>STATS")]
```

One Worker does everything: serves the static shell, proxies and caches the upstream
feeds (browser never hits third parties directly), and owns a KV namespace for the
visitor counter and chat wall.

## Run it yourself

```bash
npm install
npx wrangler kv namespace create STATS   # paste the id into wrangler.jsonc
npm run dev                              # http://localhost:8787
npm run deploy
```

## License

MIT © Baran Fırat Şahin — [fsahin.com](https://fsahin.com)
