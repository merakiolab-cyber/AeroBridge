# 🌉 AeroBridge Studio

<div align="center">

**Ultra-rychlý moderní digitální asset manažer (DAM) a organizér médií — lehká, blesková a bezplatná alternativa k Adobe Bridge.**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Windows 11](https://img.shields.io/badge/Platform-Windows_11_%2F_Web-0078D4?logo=windows-11&logoColor=white)](https://microsoft.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

<p align="center">
  <img src="docs/screenshot.png" alt="AeroBridge Studio – náhled aplikace" width="900">
</p>

---

## 📸 O projektu

**AeroBridge Studio** vznikl jako odpověď na těžkopádnost, pomalé načítání a licenční poplatky Adobe Bridge. Nabízí tvůrcům, fotografům, grafikům a video tvůrcům okamžitou odezvu, čistý Bauhaus vizuální design a pokročilé nástroje pro organizaci souborů.

Aplikace funguje **100% offline**, uchovává přístup k lokálním složkám přes standardní **File System Access API** a ukládá relace do **IndexedDB**.

---

## ✨ Klíčové funkce

### 1. 🎛️ 4 pracovní režimy (Workspaces)
- **Essentials:** Klasické studio s mřížkou náhledů a podrobným pravým inspektorem.
- **Filmstrip:** Velký náhled vybraného snímku nahoře s plynulým posuvným filmovým pásem dole (ideální pro culling fotografií).
- **Compare (Porovnání):** Srovnání dvou i více snímků vedle sebe pro výběr toho nejostřejšího.
- **Metadata Table:** Přehledná tabulka s technickými specifikacemi (rozměry, velikost, formát, datum, EXIF) s možností rychlého řazení.

### 2. ⚡ Výkon a podpora souborů
- **Okamžité náhledy:** Podpora JPEG, PNG, WebP, SVG, GIF i video souborů (MP4, WebM).
- **Adobe PSD náhledy:** Vlastní klientský parser pro extrakci náhledových miniatur přímo z hlaviček souborů Photoshopu (`.psd`).
- **Nativní přístup ke složkám:** Možnost připojit libovolné složky z disku (včetně externích SSD a NAS) s trvalým uložením v IndexedDB a obnovením jedním kliknutím.

### 3. 🏷️ Dávkové nástroje pro profesionály
- **Dávkové přejmenování (Batch Rename):**
  - Flexibilní šablony: Prefix, volitelné datum (YYYYMMDD / YYYY-MM-DD), automatická číselná řada s volitelným počtem cifer, suffix.
  - Hledání a nahrazování textu v názvech (`Find & Replace`).
  - Úprava velikosti písmen přípony (malá / velká písmena).
  - Živý náhled změn před aplikací.
- **Dávková úprava IPTC metadat (Batch IPTC Editor):**
  - Hromadný zápis: Titulek, Popis / Anotace (režim přepsat nebo připojit), Autor, Copyright, Místo / Lokalita.
  - Klíčová slova s volbou: připojit, nahradit nebo odebrat existující štítky.
  - Rychlé předpřipravené šablony pro ateliéry a fotografy.
- **Export do ZIP s klientským převodem (Batch Export):**
  - Převod do formátů WebP, JPEG nebo PNG s nastavitelnou kompresí / kvalitou.
  - Automatická změna velikosti (zachování poměru, max šířka, max výška).
  - Vložení decentního copyright vodoznaku přímo do obrazových dat.
  - Stažení celého balíčku v ZIP archivu bez odesílání dat na externí servery.

### 4. 🎨 Bauhaus & Flowty Design
- Tmavý profesionální motiv s barvou pozadí `#14161e`.
- Čisté rectilinear rozvržení s jemnými oddělovači (`border-white/10`).
- Vizuální styl: Písmo **JetBrains Mono** pro technická data a EXIF, **Plus Jakarta Sans** pro UI prvky.
- Resizovatelný postranní panel s ukládáním šířky do paměti.
- Žádný rušivý vizuální balast – decentní bílý 10% závoj pro označené soubory.

---

## ⌨️ Klávesové zkratky

| Klávesa | Akce |
|---|---|
| `Mezerník` | **QuickLook** — okamžitý velký náhled s pan & zoomem |
| `Ctrl + M` | Otevřít dialog **Dávková úprava IPTC** |
| `Ctrl + I` | Přepnout trvalé zobrazení informací na kartách |
| `Ctrl + A` | Vybrat všechny položky v aktuální složce |
| `Esc` | Zavřít aktivní modální okno / zrušit výběr |
| `Šipky (← → ↑ ↓)` | Pohyb mezi soubory |

---

## 🚀 Rychlý start (Vývoj & Spuštění)

### Požadavky
- [Node.js](https://nodejs.org/) v18+ (doporučeno v22+)
- npm nebo bun

### Instalace a spuštění

```bash
# 1. Klonování repozitáře
git clone https://github.com/your-username/aerobridge-studio.git
cd aerobridge-studio

# 2. Instalace závislostí
npm install

# 3. Spuštění vývojového serveru
npm run dev
```

Aplikace se otevře na adrese: `http://localhost:3000`

### Sestavení pro produkci

```bash
npm run build
npm run preview
```

---

## 🔒 Bezpečnost & Soukromí

- **100% Client-Side:** Vaše fotografie a videa nikdy neopouštějí váš počítač. Veškeré zpracování (IPTC, přejmenování, konverze, náhledy) probíhá lokálně v paměti vašeho prohlížeče.
- **Žádné sledovací prvky:** Aplikace neobsahuje žádné skryté analytické skripty ani telemetrii.
- **Bezpečné zacházení s disky:** Oprávnění k zápisu a čtení ze složek je plně pod kontrolou uživatele prostřednictvím standardních bezpečnostních dialogů systému Windows.

---

## 🗺️ Roadmapa vývoje

Podrobný plán dalšího vývoje a jednotlivých fází naleznete v souboru [ROADMAP.md](ROADMAP.md).
Záznam jednotlivých verzí a změn naleznete v [CHANGELOG.md](CHANGELOG.md).
Pravidla a instrukce pro Claude Code / AI asistenty jsou v [CLAUDE.md](CLAUDE.md).

---

## 📄 Licence

Tento projekt je licencován pod licencí MIT — podrobnosti viz soubor [LICENSE](LICENSE).
