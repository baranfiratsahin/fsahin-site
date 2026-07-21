<div align="center">

# fsahin.com — World Terminal

**Tam ekran, canlı veri dünya terminali · Fullscreen live-data command surface**

[![live](https://img.shields.io/badge/CANLI-fsahin.com-39ff88?style=for-the-badge&labelColor=0b0e14)](https://fsahin.com)
![stack](https://img.shields.io/badge/vanilla_JS-·_no_framework-ffb000?style=for-the-badge&labelColor=0b0e14)
![edge](https://img.shields.io/badge/Cloudflare-Worker_+_KV-7cd5ff?style=for-the-badge&labelColor=0b0e14)

</div>

Dünyayı tek bir komuta ekranından izleyen, **yalnızca gerçek veriyle** çalışan canlı terminal. Çerçevesiz vanilla JS, tek bir Cloudflare Worker ve KV üzerinde. Sahte veri yok — bir kaynak düşerse ekran uydurmaz, dürüstçe `SIGNAL LOST` yazar.

> A live command surface for the whole planet, driven by **real feeds only** — no framework, one edge Worker, honest failure states.

### ⬢ 13 Canlı Veri Akışı
`Depremler (USGS/AFAD)` · `Uçuşlar (ADS-B)` · `ISS` · `Yangın & doğa olayları (NASA EONET)` · `Piyasalar (kripto + döviz)` · `Uzay havası (NOAA Kp)` · `Türkiye şehir hava durumu` · `Hava kalitesi` · `Haber akışı (TR + dünya)` · `Ziyaretçi sohbeti` · `Global nabız (Wikimedia)`

### ⬢ Mimari
```
Tarayıcı (Leaflet + vanilla JS)
        │  yalnızca kendi origin'i
        ▼
Cloudflare Worker  ──►  /api/* : gerçek kaynaklara proxy + edge cache + dürüst 502
        │
        └─ KV : ziyaretçi sayacı · sohbet duvarı
```

**Tasarım ilkesi:** her sayı canlı bir kaynağa iner; hiçbir piksel uydurma değildir.

<div align="center">

**[▸ fsahin.com](https://fsahin.com)**

</div>
