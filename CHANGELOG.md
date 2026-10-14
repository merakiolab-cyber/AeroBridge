# Changelog & Roadmap — AeroBridge (Bauhaus Media Studio)

## Changelog

### Version 3.0.0 (Dokončení Fáze 3: Nativní Windows 11 IPC Můstek & Průzkumník)
- **Nativní IPC můstek v Rustu ([tauriBridge.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/tauriBridge.ts) & [lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - Implementován nativní Windows 11 dialog výběru složek (`rfd::FileDialog`) bez vyskakovacích webových bezpečnostních potvrzení.
  - Ultra-rychlé prohledávání disků a složek přímo v Rustu přes `std::fs::read_dir` (`scan_folder_native`).
  - Přímé binární čtení souborů (`read_file_binary`) a bezpaměťové zobrazování médií přes Tauri asset protokol (`convertFileSrc`).
- **Integrace s Průzkumníkem Windows:**
  - Přidán nativní IPC příkaz `reveal_in_explorer` volající `explorer.exe /select,"<cesta>"`.
  - V pravém inspekčním panelu [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx) přidáno tlačítko **„Složka / Průzkumník“**, které jedním kliknutím otevře složku a zvýrazní aktivní soubor v systému Windows.
  - Automatická detekce desktopového prostředí (`isDesktopApp()`) s plynulým fallbackem na webové API při běhu v prohlížeči.

---

### Version 2.9.1 (Vyřazení Typografie & OpenType ze záměru projektu)
- **Zpřesnění rozsahu a eliminace balastu:**
  - Sekce a modul pro **Typografii & OpenType** (font management / náhledy písem / glyfy) byl kompletně vyřazen ze specifikace a roadmapy jako zbytečný.
  - AeroBridge Studio se striktně soustředí na ultra-rychlou organizaci a dávkovou správu digitálních médií (fotografie, videa, Adobe formáty PSD/AI/INDD/AEP).
  - Aktualizována [ROADMAP.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/ROADMAP.md), [README.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/README.md) a [CLAUDE.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/CLAUDE.md) s explicitním pravidlem zákazu implementace font katalogu.

---

### Version 2.9.0 (Tauri v2 Windows 11 Desktop Integrace)
- **Implementace Tauri v2 (Rust + WebView2):**
  - Inicializována nativní desktopová architektura v adresáři [src-tauri/](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri).
  - Všechny Rust crate závislosti (Tauri 2.12, Windows API, WebView2) úspěšně zkompilovány bez chyb.
  - Nastaveno nativní Windows okno o rozměrech 1400×900 px, centrované s podporou Snap Layouts.
- **Nové npm skripty pro Windows desktop:**
  - `npm run desktop:dev` — spuštění aplikace jako plně nativního Windows desktop okna s live reloadem.
  - `npm run desktop:build` — kompilace standalone instalátoru (.exe / MSI) o velikosti ~15 MB.
- **Konfigurace a zabezpečení:**
  - [.gitignore](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/.gitignore) zabezpečen proti verzování Rust `target/` složky.
  - [CLAUDE.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/CLAUDE.md) a [ROADMAP.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/ROADMAP.md) aktualizovány pro desktop workflow.

---

### Version 2.8.0
- **Binární injektor Adobe XMP packetů ([metadataWriter.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/metadataWriter.ts)):**
  - Implementován modul pro generování validních XMP ISO 16684-1 XML packetů (Dublin Core a Photoshop jmenné prostory: titulek, popis, autor, copyright, lokalita, klíčová slova).
  - Přímý binární zápis do JPEG APP1 segmentu bez re-enkódování pixelů a bez ztráty obrazové kvality.
  - **100% zachování EXIF dat fotoaparátu:** Původní EXIF segmenty (čas expozice, clona, ISO, ohnisko, objektiv, datum pořízení) zůstávají nedotčeny.
- **Přímý fyzický zápis na disk přes File System Access API:**
  - Napojení `FileSystemFileHandle.createWritable()` do procesu dávkových IPTC úprav.
  - V [BatchIptcModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/BatchIptcModal.tsx) přidán volitelný přepínač *„Přímý zápis do souborů na disku (Writeback)“*.
  - Okamžitá synchronizace fyzického souboru na disku a IndexedDB cache s toastovým potvrzením.

---

### Version 2.7.0
- **Nativní podpora Adobe InDesign (`.indd`, `.idml`):**
  - Implementována klientská extrakce náhledů z InDesign dokumentů v [adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts).
  - Parsování XMP metadatových packetů (`<xmpGImg:image>` base64 JPEG) a vyhledávání embedded page streamů.
- **Podpora Camera RAW formátů:**
  - Přidána rychlá extrakce náhledů pro Canon (`.cr2`, `.cr3`), Nikon (`.nef`), Sony (`.arw`), Adobe DNG (`.dng`), Fuji (`.raf`), Olympus (`.orf`), Panasonic (`.rw2`).
  - Přímé O(1) čtení TIFF IFD tagů `0x0201` (`JPEGInterchangeFormat`) a `0x0202` (`JPEGInterchangeFormatLength`) s automatickým fallbackem na SOI skener.
- **Podpora vektorů a Adobe Illustrator:**
  - Extrakce náhledů pro `.ai` a `.eps` soubory.
  - Okamžité vykreslení vektorových SVG souborů s detekcí rozměrů.
- **Bauhaus generátor grafických karet:**
  - Automatické generování ostrých grafických karet v tmavém Bauhaus stylu s typografickým odznakem, barevným pruhem a názvem souboru pro dokumenty, které neobsahují vložený náhled.

---

### Version 2.6.0
- **Virtualizace mřížky (High-Performance DOM Virtual Scrolling):**
  - Implementován lehký virtuální scroll v [AssetGrid.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/AssetGrid.tsx).
  - Vykresluje pouze viditelnou část mřížky (+ 2 řádky overscan buffer).
  - Bleskové procházení složek s 10 000+ fotografiemi při 60–120 FPS bez zahlcení paměti RAM.
  - Plynulý auto-scroll do viditelné oblasti při navigaci šipkami na klávesnici.
- **Klávesové zkratky Windows 11 stylu:**
  - `F2`: Otevření dialogu hromadného přejmenování pro vybrané položky.
  - `Delete`: Bezpečné odebrání označených položek ze zobrazení (včetně uvolnění blob URL paměti a toastové notifikace).
  - `Escape`: Zrušení aktivního výběru.
  - `Ctrl + A`: Výběr všech položek v aktuální složce.
- **Vylepšená Windows 11 PWA asociace:**
  - Rozšířen [manifest.json](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/public/manifest.json) o Windows `file_handlers` pro asociaci souborů obrázků, videí a Adobe projektů (`.psd`, `.ai`, `.pdf`).
  - Přidány PWA Windows zástupce (shortcuts) pro přímé otevření složky nebo oblíbených položek.
- **Git inicializace repozitáře:**
  - Repozitář inicializován s výchozí větví `main` a prvním čistým commitem.

---

### Version 2.5.1
- **Bezpečnostní audit závislostí:**
  - 0 zranitelností (`npm audit`), odstraněna peer kolize esbuild u Vite 8.
- **Sanitizace souborových cest (Prevence Path Traversal & Zip Slip):**
  - Implementována funkce `sanitizeFilename()` v [localFileSystem.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/localFileSystem.ts), která odstraňuje nebezpečné sekvence `../`, `..\`, null bajty a neplatné Windows znaky (`\ / : * ? " < > |`).
  - Aplikována na dávkové přejmenování v [BatchRenameModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/BatchRenameModal.tsx) i na generování ZIP balíčků.
- **Ochrana paměti (Prevence Memory Leaků):**
  - Ošetřeno uvolňování objektových URL (`URL.revokeObjectURL`) po vygenerování náhledů videí a ZIP archivů.
  - Přidána mezní kontrola délky bufferu u PSD extraktoru (`byteLength >= 4`).
- **Neprůstřelný `.gitignore`:**
  - Zabezpečení proti nechtěnému commitu `.env`, `.env.local`, dočasných exportních archivů, systémových a IDE souborů.
- **Portfolio & Open-Source příprava:**
  - Vytvořena MIT [LICENSE](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/LICENSE), reprezentativní [README.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/README.md), [CLAUDE.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/CLAUDE.md) a detailní [ROADMAP.md](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/ROADMAP.md).

---

### Version 2.5.0
- **Zvětšený náhled v pravém inspektoru:**
  - Šířka pravého panelu zvětšena o 25 % (ze 320 px na 400 px).
  - Náhledový plátno zvětšeno z 220–300 px na 280–400 px s maximální výškou obrázku 370 px pro výrazně lepší přehled detailů.
- **Nový styl výběru fotek (bez rámečku):**
  - Odstraněna rušivá linka / ring rámeček u označených fotografií.
  - Výběr je nyní indikován elegantním jemným přebarvením 10% bílé vrstvy (`bg-white/10`) přímo přes fotku v čistém Bauhaus pojetí.
- **Dynamicky nastavitelná šířka levého menu:**
  - Šířku bočního panelu lze nyní plynule rozšiřovat a zužovat tahem myši (rozsah 180 px – 500 px).
  - Nastavená šířka se automaticky ukládá do paměti prohlížeče.
- **Vyhlazené přechody bez skubání:**
  - Odstraněno skákání prvků (layout delta jumps) při přepínání mezi složkami.
  - Čisté a plynulé zobrazení položek s okamžitou odezvou.
- **Dávková úprava IPTC popisků a metadat:**
  - Kompletní modální dialog pro hromadnou úpravu IPTC: Titulek, Popis/Anotace (nahradit / připojit), Autor, Copyright, Místo/Lokalita a Klíčová slova (přidat / přepsat / odebrat).
  - Rychlé šablony pro studio, fotografie a copyright.
  - Spuštění z třítečkového menu (...), z pravého panelu inspektoru nebo klávesovou zkratkou `Ctrl + M`.
- **Trvalé offline úložiště (IndexedDB):**
  - Trvalé ukládání importovaných souborů, sezení a oblíbených složek v IndexedDB.
  - Možnost připojení a trvalého uložení složek z místních disků (s podporou opakované synchronizace a obnovení jedním kliknutím).
- **Rychlý export do ZIP s vodoznakem a resize:**
  - Plně funkční klientský převod formátů (WebP, JPEG, PNG), změna rozlišení a vložení volitelného copyright vodoznaku přímo do ZIP archivu.
- **Příprava pro spuštění jako desktopová aplikace (PWA) & Git:**
  - Web App Manifest a offline Service Worker pro instalaci na plochu přímo jako samostatná aplikace.
  - Čistý `.gitignore` a příprava na git push.

---

### Version 2.4.0
- **Konsolidované menu akcí (...):** Přejmenování, ZIP export a otevření složky sjednoceny do přehledného třítečkového menu.
- **Oblíbené složky a Drag & Drop:** Označení libovolné složky hvězdičkou a přetahování souborů myší do složek.
- **Zobrazení informací (Ctrl + I):** Možnost přepínat zobrazení informací buď pouze po najetí myši, nebo trvale pro všechny soubory.
