# Changelog & Roadmap — AeroBridge (Bauhaus Media Studio)

## Changelog

### Version 2.6.0 (Aktuální verze — Fáze 1: Windows 11 UX & Virtualizace)
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
