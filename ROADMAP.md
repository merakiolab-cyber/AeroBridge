# AeroBridge Studio — Product Roadmap

**Vize:** Bleskový, open-source digitální asset manažer (DAM) a organizér fotografií/grafiky pro Windows 11 a web, který plnohodnotně nahrazuje těžkopádný a placený Adobe Bridge.

---

## 🧭 Aktuální stav: Verze 2.5.0 (Stabilní základ)
- [x] Základní architektura v React 19 + TypeScript + Vite 8 + Tailwind CSS v4
- [x] 4 pracovní režimy (Essentials, Filmstrip, Porovnání / Compare, Metadata Table)
- [x] Bauhaus vizuální styl (tmavý motiv, JetBrains Mono + Plus Jakarta Sans, jemné dělicí linie)
- [x] Pravý inspekční panel (zvětšený náhled 400px, EXIF data, IPTC, histogram)
- [x] Bezkontaktní výběr souborů (decentní 10% bílý závoj místo rušivého obrysu)
- [x] Resizovatelný levý postranní panel (180–500 px s pamětí v LocalStorage)
- [x] File System Access API + IndexedDB trvalé ukládání složek a sezení
- [x] Dávkové přejmenování souborů (Prefix, Datum, Číselná řada, Suffix, Find & Replace)
- [x] Dávková úprava IPTC metadat (Titulek, Popis, Autor, Copyright, Místo, Klíčová slova)
- [x] Rychlý export do ZIP s klientským přepočtem (WebP, JPEG, PNG, vodoznak, resize)
- [x] Klávesové zkratky (`Mezerník` pro QuickLook, `Ctrl+M` pro IPTC, `Ctrl+I` pro info, šipky pro navigaci)
- [x] Základní PWA (Manifest, Service Worker, offline cache)

---

## 🎯 Fáze 1: Windows 11 Desktop Připravenost & Git Portfolio (Nejbližší cíl)
- [ ] **Git Inicializace & Portfolio Příprava:**
  - [x] Vytvoření reprezentativního `README.md` se snímky obrazovky, odznaky (badges) a návodem k použití
  - [x] Přidání licence (MIT)
  - [x] Bezpečnostní audit: ověření že žádná citlivá data / klíče nejsou v repu, sanitizace názvů (Path Traversal / Zip Slip), prevence memory leaků
  - [ ] Inicializace git repozitáře a nastavení větve `main`
- [ ] **Lokální Windows 11 UX:**
  - Plná PWA instalace na Windows 11 plochu / do Start menu jako nativní okno
  - Lepší ošetření chybějících souborů při odpojení externího disku
  - Klávesová navigace ve Windows stylu (`F2` pro přejmenování, `Delete` pro smazání/koš, `Ctrl+A` označit vše)
- [ ] **Výkon s velkými složkami (10 000+ souborů):**
  - Virtualizace mřížky (DOM virtual scrolling) pro okamžité vykreslení tisíců fotografií bez zátěže paměti

---

## 🚀 Fáze 2: Pokročilá správa médií & Adobe Ekosystém
- [ ] **Nativní dekódování Adobe & RAW formátů:**
  - Hlubší podpora PSD (vrstvy, kompozity)
  - Podpora RAW formátů digitálních zrcadlovek (CR2, CR3, NEF, ARW, DNG) přes WebAssembly (libraw / dcraw)
  - Rychlé náhledy vektorů SVG / AI / EPS
- [ ] **Barevné štítky a hodnocení hvězdičkami (Rating & Labels):**
  - Rychlé hodnocení klávesami `1`–`5` (hvězdičky) a `6`–`9` (barevné štítky: červená, žlutá, zelená, modrá, fialová)
  - Filtrování podle hodnocení a barevných štítků v horní liště
- [ ] **Zápis metadat přímo do souborů (Writeback):**
  - Zápis upravených IPTC/XMP metadat přímo do JPEG/WebP/TIFF souborů přes File System Access API

---

## 💡 Fáze 3: AI Asistence & Chytré funkce (Google Gemini)
- [ ] **Automatické tagování a klíčová slova:**
  - Analýza vizuálního obsahu pomocí Gemini API (automatické rozpoznání objektů, nálady, barev, stylu)
- [ ] **Sémantické vyhledávání v češtině i angličtině:**
  - Hledání např. *"západ slunce u moře bez lidí"* nebo *"fotka s červeným autem v noci"*
- [ ] **AI generování popisků pro stock fotobanky:**
  - Automatické vygenerování SEO titulků a anotací pro Adobe Stock, Shutterstock atd.

---

## 🖥️ Fáze 4: Samostatná nativní desktopová aplikace (Tauri v2)
- [ ] **Přechod na Tauri v2 (Rust + WebView2):**
  - Minimální binární soubor (.exe instalační balíček pro Windows 11, velikost do 15 MB)
  - Přímý přístup k diskům bez nutnosti dotazování browser oprávnění
  - Integrace do kontextového menu Windows Průzkumníka (*„Otevřít v AeroBridge“*)
  - Hardwarově akcelerované generování náhledů na pozadí
