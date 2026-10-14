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

## 🎯 Fáze 1: Windows 11 Desktop Připravenost & Git Portfolio (DOKONČENO ✅)
- [x] **Git Inicializace & Portfolio Příprava:**
  - [x] Vytvoření reprezentativního `README.md` se snímky obrazovky, odznaky (badges) a návodem k použití
  - [x] Přidání licence (MIT)
  - [x] Bezpečnostní audit: ověření že žádná citlivá data / klíče nejsou v repu, sanitizace názvů (Path Traversal / Zip Slip), prevence memory leaků
  - [x] Inicializace git repozitáře a nastavení větve `main`
- [x] **Lokální Windows 11 UX:**
  - [x] Plná PWA instalace na Windows 11 plochu / do Start menu s `file_handlers` pro asociaci souborů
  - [x] Lepší ošetření chybějících souborů a oprávnění při odpojení externího disku
  - [x] Klávesová navigace ve Windows stylu (`F2` pro přejmenování, `Delete` pro smazání, `Escape` pro zrušení výběru, `Ctrl+A` označit vše)
- [x] **Výkon s velkými složkami (10 000+ souborů):**
  - [x] Virtualizace mřížky (DOM virtual scrolling) v `AssetGrid` pro okamžité vykreslení tisíců fotografií bez zátěže paměti a s auto-scrollem při navigaci klávesnicí

---

## 🚀 Fáze 2: Pokročilá správa médií & Adobe / RAW Ekosystém (DOKONČENO ✅)
- [x] **Nativní dekódování Adobe & RAW formátů:**
  - [x] **Adobe InDesign (`.indd`, `.idml`)**: nativní klientská extrakce náhledů z XMP packetů (`<xmpGImg:image>`) a binárního JPEG streamu
  - [x] **Camera RAW formáty**: rychlá extrakce náhledů pro Canon (`.cr2`, `.cr3`), Nikon (`.nef`), Sony (`.arw`), Adobe (`.dng`), Fuji (`.raf`) přes TIFF IFD tagy (`0x0201` / `0x0202`) a JPEG SOI sken
  - [x] **Adobe Illustrator & Vektory**: podpora `.ai`, `.eps` a nativní `.svg`
  - [x] **Bauhaus generátor grafických karet**: okamžitý generátor vysokorozlišovacích náhledů pro dokumenty bez vloženého náhledu
- [x] **Zápis metadat přímo do souborů (Writeback):**
  - [x] Přímý binární zápis Adobe XMP metadat do JPEG souborů přes File System Access API
  - [x] 100% zachování původních EXIF dat fotoaparátu (clona, čas, ISO, objektiv, datum)
  - [x] Přepínač přímého zápisu na disk integrován do modálního dialogu Dávkové úpravy IPTC

---

## 🖥️ Fáze 3: Samostatná nativní desktopová aplikace pro Windows 11 (Tauri v2) (PROBÍHÁ ⚙️)
- [x] **Přechod na Tauri v2 (Rust + WebView2):**
  - [x] Inicializace Tauri v2 architektury (`src-tauri`) a konfigurace nativního okna (1400×900, centrované, resizovatelné)
  - [x] Přidání desktopových npm skriptů (`npm run desktop:dev`, `npm run desktop:build`)
  - [ ] Nativní Windows okno se Snap Layouts podporou a přímým přístupem k diskům bez webových dialogů
  - [ ] Kompilace standalone .exe balíčku (velikost do 15 MB)
