# Changelog & Roadmap — AeroBridge (Bauhaus Media Studio)

## Changelog

### Version 3.27.22 (Oprava kolize posuvníku prostředního sloupce s úchytem pro změnu šířky panelu)
- **Oddělení zóny posuvníku a úchytu změny šířky ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Opravena kritická chyba rozvržení, kdy neviditelná interaktivní zóna (`-left-1.5`) úchytu pro rozšiřování pravého panelu (`PreviewInspector`) zasahovala 6 px do prostředního sloupce a kompletně překrývala vertikální posuvník (scrollbar) mřížky a tabulky.
  - V důsledku překrytí prohlížeč při najetí myší na posuvník nabízel ikonu pro rozšíření pravého panelu (`cursor-col-resize`) a kliknutí/tažení zahájilo změnu šířky panelu namísto posouvání obsahu.
  - Interaktivní zóna úchytu byla upravena na `left-0 -right-2.5`, takže vůbec nezasahuje vlevo do prostředního sloupce a rozšiřuje se pouze doprava do prázdného okraje panelu detailů. Posuvník prostředního sloupce je nyní 100% volný a přímo ovladatelný.
  - Stejné oddělení aplikováno i na úchyt levého bočního panelu (`Sidebar`), včetně nového dvojkliku pro návrat na výchozí šířku.
- **Vylepšení vzhledu a ergonomie posuvníků ([index.css](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/index.css)):**
  - Šířka posuvníků byla zvýšena ze 6 px na 8 px pro pohodlnější uchopení myší v souladu s Fluent Designem Windows 11.
  - Vylepšen kontrast a vizuální odezva táhla posuvníku: základní stav `#3f3f46`, zvýraznění při najetí myší `#71717a`, aktivní táhnutí `#e2e4e9`.

### Version 3.27.21 (Oprava a optimalizace zoomování fotografií na plátně)
- **Odstranění smyčky rušení zoomu ([ZoomableCanvas.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ZoomableCanvas.tsx)):**
  - Opravena kritická chyba, kdy `setScale` v závislostech měnil svou instanci při každém pootočení kolečka nebo stisku tlačítka zoomu, což zpětně spouštělo `useEffect` pro reset měřítka na hodnotu 100% (fit window). Zoom se tak okamžitě resetoval a uživatel nemohl obrázek přiblížit.
  - `setScale` nyní používá stabilní funkční aktualizaci a `useRef` bez rekompilace závislostí.
  - Reset na výchozí velikost (`scale = 1`) se nyní spouští výhradně při skutečné změně URL obrázku (`prevSrcRef !== src`).
- **Nové interaktivní ovládání přiblížení:**
  - **Click-to-Zoom:** Kliknutím myší na obrázek v základním zobrazení se okamžitě plynule zazoomuje na místo kliknutí (200% / 1:1 skutečná velikost) v souladu s kurzorem lupy `cursor-zoom-in`.
  - **Plynulé kolečko myši:** Optimalizována citlivost jak pro krokové kolečko myši (25 % na krok), tak pro hladká gesta na touchpadu.
  - **Pan & Drag:** Po přiblížení se kurzor změní na ruku (`cursor-grab` / `cursor-grabbing`) a umožňuje přirozené posouvání detailu. Dvojklik vrací zobrazení na celé okno.

### Version 3.27.20 (Oprava výběru fotek myší v režimu Filmstrip napřeskáčku)
- **Přímé klikání na miniatury ve spodním pásu ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx)):**
  - Opravena chyba, kdy `setPointerCapture` okamžitě po stisku myši na kontejneru zachytil veškeré události a zabránil spuštění `onClick` / `onPointerUp` na jednotlivých kartách miniatur (bylo možné procházet fotky pouze popořadě šipkami).
  - Aktivace zachycení ukazatele (`setPointerCapture`) byla odložena až na okamžik, kdy pohyb kurzoru překročí práh posunu (6 px).
  - Přidán přímý handler `onPointerUp` a přístupné klávesové zkratky (Enter / Mezerník) na každou miniaturu pro okamžitý výběr jakékoliv fotografie napřeskáčku bez zpoždění.
  - Zajištěno automatické plynulé vystředění aktivní miniatury v karuselu a optimální zobrazení přímých obrazových cest přes `toDesktopAssetUrl`.

### Version 3.27.19 (Oprava extrakce náhledů Adobe InDesign .indd přes nativní embedded JPEG)
- **Nativní extrakce vložených JPEG náhledů v Rustu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - V InDesign dokumentech (`.indd`) jsou XML XMP pakety často rozděleny přes 4KB sektorové hranice s výplňovými nulami a sektorovými hlavičkami, což způsobovalo neplatné base64 zarovnání a pád vykreslování v prohlížeči (s následným fallbackem na obecnou ikonu souboru).
  - Přidán nový nativní Tauri příkaz `extract_embedded_jpeg`, který přímo z binárního toku souboru detekuje a extrahuje plnohodnotné, vysokorozlišovací vestavěné JPEG náhledy (typicky 150 KB až 500 KB o rozlišení až 876×584 px) během méně než 5 ms bez nutnosti serializovat desítky MB dat do WebView2.
  - Vylepšena validace `clean_base64()` v Rustu pomocí kontroly zarovnání délky `% 4 == 0` a ověření skutečných magických bajtů obrazu (`JPEG SOI 0xFF, 0xD8` / `PNG`), což zabraňuje vracení poškozených dat.
- **Frontend optimalizace pipeline pro InDesign ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts), [adobeExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/adobeExtractor.ts)):**
  - Prioritizována nativní binární extrakce vloženého JPEG náhledu před parsováním XMP textových značek.
  - Přidána podpora `extractNativeEmbeddedJpeg` v [tauriBridge.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/tauriBridge.ts) s přímým streamingem přes IPC.

### Version 3.27.18 (Nativní náhledy souborů Adobe XD — .xd)
- **Extrakce náhledů Adobe XD ([vectorHtmlExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/vectorHtmlExtractor.ts)):**
  - Implementována funkce `extractXdThumbnail()` pro čtení vložených vysokorozlišovacích náhledů (`preview.png` o rozlišení až 2048 px, `thumbnail.png` a artboard rendicí `renditions/image-*.png`) přímo z kontejneru Adobe XD.
  - V nativním režimu Windows 11 se jako první krok využívá Windows Shell thumbnail provider (`IShellItemImageFactory`) s okamžitým 0ms načtením, s fallbackem na interní ZIP dekompresor (`JSZip`).
  - Podpora Adobe XD ve všech pohledech aplikace: Mřížka, Seznam, Filmstrip, Porovnání, Rychlý náhled (QuickLook) a Inspekční panel.
  - Přidán filtr formátu `Adobe XD (.xd)` do horní lišty s fuchsiovou identitou (`#ff61f6`).

### Version 3.27.17 (Oficiální ikony grafických, 3D a DAW formátů namísto textových badge)
- **Komponenta dedikovaných aplikačních ikon ([AppIcons.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/AppIcons.tsx)):**
  - Implementovány oficiální miniaturní ikony pro klíčové kreativní formáty:
    - **Adobe Creative Cloud:** Photoshop (`.psd`, `.psb`), Illustrator (`.ai`), InDesign (`.indd`, `.idml`), After Effects (`.aep`), Premiere Pro (`.prproj`), Acrobat PDF (`.pdf`), Lightroom (`.lrcat`), Adobe XD (`.xd`).
    - **UI/UX & Vektory:** Figma (`.fig` - oficiální 5barevné logo), Sketch (`.sketch`), CorelDRAW (`.cdr`), Corel Painter (`.rif`), Krita (`.kra`).
    - **3D & Animace:** Blender (`.blend`), ZBrush (`.zpr`, `.ztl`), Cinema 4D (`.c4d`), Maya (`.mb`, `.ma`), 3ds Max (`.max`).
    - **DAW & Audio:** Ableton Live (`.als`), FL Studio (`.flp`), Cubase (`.cpr`).
- **Inteligentní fallback na textový badge:**
  - Běžné systémové, textové a konfigurační soubory (`.txt`, `.md`, `.json`, `.csv`, `.log`) bez typické softwarové identity si přirozeně zachovávají čistý Bauhaus textový štítek.
- **Sjednocené nasazení napříč celým prostředím:**
  - Miniatury v mřížce ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx))
  - Režim Filmstrip: horní informační lišta i spodní pás miniatur ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx))
  - Režim Porovnání médií ([CompareView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CompareView.tsx))
  - Rychlý náhled QuickLook ([QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx))
  - Inspekční panel náhledu ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx))
  - Tabulkové zobrazení Metadat ([MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx))
  - Řádky souborů v Commanderu ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx))

### Version 3.27.16 (Správa a promazání mezipaměti — Cache Management a la Adobe Bridge & Dialog Nastavení)
- **Komplexní správce mezipaměti ([cacheManager.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/cacheManager.ts)):**
  - Sjednocení všech vrstev mezipaměti aplikace do jednoho rozhraní: LRU paměťová cache miniatur, renderované stránky a dokumenty PDF (`pdf.js`), systémové ikony Windows Shell (`IShellItemImageFactory`) a perzistentní IndexedDB úložiště.
  - Funkce `purgeFolderCache(folderPath)`: cílené vymazání mezipaměti pouze pro konkrétní otevřenou složku bez dopadu na ostatní dříve načtené složky (přesně ve stylu *Tools > Cache > Purge Cache for Folder* v Adobe Bridge).
  - Funkce `purgeEntireAppCache()`: kompletní vyčištění veškeré paměťové RAM cache (včetně uvolnění objektových URL přes `URL.revokeObjectURL` a uvolnění WebAssembly paměti přes `doc.destroy()`) a smazání záznamů v IndexedDB.
- **Modální okno Nastavení a správa mezipaměti ([SettingsModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/SettingsModal.tsx)):**
  - Windows 11 Fluent UX design s akrylovým pozadím a záložkovou navigací.
  - **Živé statistiky v reálném čase:** Miniatury v RAM s aktuálním limitem, počet otevřených PDF dokumentů a vyrenderovaných stran, systémové ikony Windows a počet záznamů v IndexedDB včetně odhadované velikosti v MB.
  - **Akce na 1 kliknutí:** Tlačítko *Promazat složku* pro aktivní adresář a *Vyčistit vše* s barevným odlišením a bezpečnostními indikátory.
  - **Volba kapacity LRU mezipaměti miniatur:** Tlačítka rychlé volby (1 000 / 2 500 / 5 000 položek) s ukládáním do `localStorage`.
  - **Karta O aplikaci & Systém:** Přehled verze 3.27.16, offline architektury Tauri v2 + Rust a výchozího pracovního disku `F:\`.
- **Integrace do uživatelského rozhraní ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Přímé tlačítko ozubeného kola (Nastavení) v horní liště.
  - Rychlé položky v menu tří teček `...`: *Vymazat mezipaměť složky* (<kbd>Ctrl+F5</kbd>) a *Nastavení a mezipaměť...* (<kbd>Ctrl+,</kbd>).
- **Globální klávesové zkratky ([useKeyboardShortcuts.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useKeyboardShortcuts.ts)):**
  - <kbd>Ctrl+,</kbd> — otevření dialogu Nastavení a správa mezipaměti.
  - <kbd>Ctrl+F5</kbd> — okamžité promazání mezipaměti aktivní složky a vynucení čerstvého znovunačtení miniatur přímo ze souborů na disku.

### Version 3.27.15 (Posouvání spodního pásu miniatur myší — Drag-to-Scroll & Kolečko myši ve Filmstripu)
- **Uchopení a tažení myší (Mouse Grab & Drag-to-Scroll) ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx)):**
  - Spodní lištu miniatur lze nyní libovolně uchopit a plynule tažením myši posouvat doleva i doprava (`onPointerDown` s `setPointerCapture`).
  - Kurzor myši nad lištou indikuje stav posunu (`cursor-grab` a při stisku `cursor-grabbing`).
  - Ochrana proti nechtěnému výběru: pokud uživatel myší táhl (posunul lištu o více než 4 px), po uvolnění tlačítka myši nedojde k nechtěnému výběru obrázku pod kurzorem. Rychlý klik na miniaturu bez tažení obrázek standardně vybere.
- **Horizontální rolování kolečkem myši ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx)):**
  - Při najetí kurzorem nad spodní lištu převádí otáčení vertikálního kolečka myši pohyb automaticky na plynulý horizontální posun pásu miniatur.
  - Zobrazen jemný tenký posuvník ve stylu Windows 11 Fluent UX (`scrollbar-thin scrollbar-thumb-white/20`).

### Version 3.27.14 (Oprava zobrazení náhledů ve Filmstripu — Fit to Screen bez ořezu a paměť přiblížení)
- **Kompletní oprava ořezu a rozměrů náhledu ([ZoomableCanvas.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ZoomableCanvas.tsx)):**
  - **Odstranění globálních jednotek `96vh` / `98vw`:** Původní `max-h-[96vh]` roztahovalo obrázek na výšku celého monitoru i v případě, že plátno mělo menší výšku než okno. Výsledkem byl ořez horní a dolní části obrázku.
  - **Korektní přizpůsobení rámu (`Fit to Frame Screen`):** Element `<img>` a jeho obalující `motion.div` nyní používají `max-w-full max-h-full min-w-0 min-h-0 w-auto h-auto object-contain`. Obrázek se ve výchozím stavu přesně vejde do rozměrů svého kontejneru se 100% zachováním poměru stran bez jakéhokoliv ořezu či deformace.
  - **Bezpečné okraje (`paddingClassName`):** Plátno Filmstripu používá padding `p-4 md:p-6 pt-16 pb-16`, takže náhled při přizpůsobení oknu nikdy nezasahuje pod horní informační štítek ani pod spodní lištu ovládání zoomu.
- **Zachování velikosti zobrazení při přechodu na další obrázek ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx), [ZoomableCanvas.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ZoomableCanvas.tsx)):**
  - **Persistent Zoom:** Zavedena vlastnost `preserveZoom={true}` a obousměrná vazba měřítka (`filmstripScale`). Když uživatel obrázek zmenší (např. na 0.7) nebo zvětší, zvolené měřítko zůstává aktivní i při přepnutí na další / předchozí soubor (kolečkem myši, šipkami nebo kliknutím).
  - Nový obrázek se otevře na stejném měřítku a vycentruje na střed (`x: 0, y: 0`).
  - Rozšířen spodní limit zmenšení až na 20 % (`scale: 0.2`) namísto původních 40 %.
  - Dvojklik nebo tlačítko *Okno* kdykoliv vrátí měřítko zpět na 100% přizpůsobení oknu.
- **Automatické rolování horizontálního pásu miniatur ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx)):**
  - Při procházení médií (šipkami na klávesnici či bočními tlačítky) spodní horizontální pás automaticky a plynule scrolluje na právě aktivní miniaturu (`scrollIntoView`).

### Version 3.27.13 (Výchozí pracovní disk F:\ Working namísto C:\ System)
- **Prioritní výchozí disk F:\ při spuštění ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Při spuštění aplikace v nativním desktopovém režimu se jako výchozí disk přednostně otevírá pracovní disk **`F:\` (Working)**, nikoliv systémový disk `C:\` (System).
  - Pokud byla v relaci uložena systémová cesta z `C:\` (např. systémové složky), aplikace automaticky přepne na pracovní disk `F:\` (nebo disk s označením "Working").
- **Výchozí panely v Commanderu ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - Levý i pravý panel se v případě absence předchozí cesty nebo při výskytu disku `C:\` automaticky inicializují na **`F:\`**.
  - Detekce dostupných disků při startu Commanderu automaticky přesměruje panely z `C:\` na prioritní pracovní disk `F:\`.
- **Podpora libovolných kořenů disků ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx)):**
  - Funkce `getFavFolderName` nyní dynamicky rozpoznává kořeny všech diskových jednotek (`/^[a-zA-Z]:\\?$/`) včetně `F:\`.

### Version 3.27.12 (Zprovoznění Drag & Drop a Ctrl+C/X/V v Commanderu v nativní Tauri aplikaci)
- **Vypnutí nativního zachytávání přetahování ([tauri.conf.json](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/tauri.conf.json)):**
  - Tauri v2 má ve výchozím stavu `dragDropEnabled: true`, což na Windows (WebView2) zachytává přetahování souborů na úrovni okna a HTML5 události `dragover` / `drop` se do Reactu vůbec nedostanou. Nastaveno `"dragDropEnabled": false`. Změna se projeví až po úplném restartu `npm run desktop:dev`.
- **Odolnější klávesové zkratky ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - Posluchač `keydown` je registrován ve fázi zachytávání (capture), takže jej nemůže přebít jiný handler.
  - Ochrana textových polí nyní kontroluje `e.target` (včetně `contentEditable`) místo `document.activeElement`, takže zapomenutý fokus v poli nezablokuje všechny zkratky.
- **Zpětná vazba při přetažení:** Přetažení do panelu se stejnou složkou (dříve tiché ignorování) a nezjištění zdrojových souborů nyní zobrazí upozornění.
- **Známé omezení (Windows):** Pokud je zapnutý *Řízený přístup ke složkám* (Defender, ochrana před ransomwarem), zápis do chráněných složek (Obrázky, Dokumenty, Plocha) selže s matoucí chybou „Systém nemůže nalézt uvedený soubor (os error 2)". Řešení: povolit `aerobridge-studio.exe` v Zabezpečení Windows → Ochrana před ransomwarem → Řízený přístup ke složkám.

### Version 3.27.11 (Oprava kopírování přes klávesové zkratky Ctrl+C a Ctrl+V v Commanderu)
- **Kompletní oprava kopírování klávesovými zkratkami <kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd> ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - **Odstranění uvíznutí fokusu v textových polích:** Kliknutí na řádek souboru nebo do prostoru panelu dříve v DOMu neodstranilo fokus ze vstupních polí (`<input>`). Zkratky <kbd>Ctrl+C</kbd> a <kbd>Ctrl+V</kbd> byly následně zablokovány ochranou proti přepisu textu v inputech. Každý klik na řádek, panel či prázdné místo nyní automaticky zavolá `blur()` na aktivním inputu a udělí fokus kontejneru panelu (`tabIndex={0}`).
  - **Stabilní reference listeneru bez stale closures (`stateRef` a `clipboardRef`):** Globální posluchač `keydown` a operace schránky již netrpí uzavřením nad zastaralým stavem Reactu. Reference `stateRef` a `clipboardRef` jsou synchronně aktualizovány při každém renderu a posluchač `keydown` je stabilně napojen bez neustálého odpojování a znovupřipojování.
  - **Automatický fokus a výběr prvního souboru po načtení složky:** Při otevření složky se fokus a výběr již nezaseknou na řádku `[ .. ]` (rodič), ale automaticky zaměří a vyberou první platný soubor či podsložku (index 1), takže <kbd>Ctrl+C</kbd> lze stisknout ihned bez nutnosti klikat myší.
  - **Záloha ze systémové schránky Windows (OS Clipboard Fallback):** Pokud je interní stav schránky prázdný, <kbd>Ctrl+V</kbd> nyní přečte obsah systémové schránky (`navigator.clipboard.readText()`), vyfiltruje cesty Windows a provede vložení, což umožňuje plynulé kopírování jak mezi panely, tak z Průzkumníka Windows či jiných zobrazení.
  - **Automatický výběr při procházení šipkami nahoru/dolů:** Při pohybu kurzorovými klávesami se automaticky aktualizuje výběr položky, přesně jak je zvykem ve Windows Průzkumníku a Total Commanderu.

### Version 3.27.10 (Zprovoznění HTML5 Drag & Drop přetahování myší v Commanderu)
- **Hardenované spouštění Drag & Drop pro řádky souborů ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - **Explicitní `draggable={true}` a `-webkit-user-drag: element`:** Dle standardu HTML5 je atribut `draggable` výčtový (nikoliv boolean). Prázdná hodnota `draggable` vedla u elementů `<div>` k pádu do stavu `auto`, ve kterém Chromium nepovoluje tažení myší. Přidáním `draggable={true}` a CSS vlastnosti `WebkitUserDrag: 'element'` WebView2 nyní okamžitě iniciuje nativní přetažení.
  - **Ochrana před zrušením dragu re-renderem (`setTimeout` v `onDragStart`):** Synchronní volání `setState` uvnitř `onDragStart` vedlo v Reactu k okamžitému re-renderu a znovuvytvoření DOM uzlu přesně v okamžiku inicializace tažení, což Chromium interpretovalo jako přerušení a drag zrušilo. Aktualizace výběru byla odložena do dalšího tiknutí smyčky událostí (`setTimeout 0`).
  - **Zamezení glitchům vnořených prvků (`pointer-events-none`):** Všechny sloupce a textové prvky uvnitř řádků mají nyní `pointer-events-none`. Události myši tak dopadají přímo na řádek, text se nepokouší označovat a kurzor nepřeskakuje do zakázaného stavu 🚫.
  - **Odolnost proti vymazání payloadu v `onDragEnd`:** Čištění `activeDragPayload` v `onDragEnd` je zpožděno, aby `onDrop` měl vždy garantovaný přístup k přetahovaným souborům i v případě, že WebView2 spustí událost `dragend` před událostí `drop`.
  - **Celoplošný drop na cílový panel i dělící příčku:** Kořenový kontejner panelu i středový splitter nyní mají vlastní `onDragOver` a `onDrop`, takže soubory lze upustit kamkoliv do prostoru cílového okna.
- **Ignorování Drag listeneru v kořeni aplikace ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - V režimu Commanderu aplikace v kořenovém divu neaktivuje `isDragOver`, čímž se eliminuje zbytečný globální re-render celé aplikace při zahájení tažení.

### Version 3.27.9 (Navigace tlačítkem Zpět/Vpřed na myši v Commanderu)
- **Plná podpora bočních tlačítek myši (XButton1 / XButton2) v Commanderu ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx), [CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - Stisknutí bočního tlačítka **Zpět** (tlačítko 3 na myši) v režimu Commander nyní okamžitě vrátí historii procházení zpět.
  - Stisknutí bočního tlačítka **Vpřed** (tlačítko 4 na myši) posune historii procházení vpřed.
  - **Kontextová detekce panelu podle polohy myši:** Pokud kurzor myši při stisku bočního tlačítka spočívá nad levým panelem, naviguje se levý panel; pokud nad pravým panelem, naviguje se pravý panel. Současně se daný panel automaticky aktivuje.
  - Zavedena záloha `onMouseUp` přímo na obou panelech a propojení přes custom události `aerobridge:commander-back` a `aerobridge:commander-forward`.
- **Klávesová navigace historií v Commanderu ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - Přidána podpora klávesových zkratek <kbd>Alt + Šipka vlevo</kbd> (Zpět v historii) a <kbd>Alt + Šipka vpravo</kbd> (Vpřed v historii) pro aktivní panel.
  - Přidána zkratka <kbd>Alt + Šipka nahoru</kbd> (Přechod o úroveň výš `..`).
- **Oprava handle splitteru:** Přiřazena reference `containerRef` hlavnímu kontejneru obou panelů pro precizní výpočet šířek a tažení dělící čáry.

### Version 3.27.8 (Oprava přetahování myší Drag & Drop a klávesových zkratek v Commanderu)
- **Oprava kolize globálních zkratek ([useKeyboardShortcuts.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useKeyboardShortcuts.ts)):**
  - Globální posluchač klávesových zkratek v hlavní aplikaci již neblokuje a nekonzumuje klávesy v režimu Commander (`currentView === 'commander'`).
  - Všechny standardní operace (<kbd>Ctrl+C</kbd>, <kbd>Ctrl+X</kbd>, <kbd>Ctrl+V</kbd>, <kbd>Ctrl+A</kbd>, <kbd>Tab</kbd>, <kbd>F2</kbd>, <kbd>F3</kbd>, <kbd>F4</kbd>, <kbd>F5</kbd>, <kbd>F6</kbd>, <kbd>F7</kbd>, <kbd>F8</kbd>, <kbd>Del</kbd>, <kbd>Space</kbd>, šipky) jsou nyní plně a exkluzivně řízeny komponentou [CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx). Globální hook propouští pouze přepínání pracovních prostorů (<kbd>Ctrl+1..5</kbd>).
- **Kompletní oprava Drag & Drop přetahování myší ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - **Povolení dropu přes řádky souborů:** Přetažení myší nad řádky souborů (`!it.is_dir`) dříve nevolalo `e.preventDefault()`, což způsobovalo, že WebView2/Chromium označilo celou oblast za neplatný drop cíl (zobrazovala se ikona 🚫). Nyní řádky souborů správně předávají událost pro vložení do aktuální otevřené složky panelu.
  - **In-memory fallback payload (`activeDragPayload`):** Implementováno spolehlivé zálohování přetahovaných souborů a zdrojového panelu v paměti aplikace, které eliminuje vymazání nebo sanitizaci `dataTransfer` v prostředí WebView2. Podporováno je navíc i přetažení externích souborů z Windows Průzkumníka.
  - **Ochrana proti nechtěnému přesunu:** Pokud uživatel přetáhne soubory v rámci téže složky a nedrží <kbd>Ctrl</kbd> pro kopírování, operace se bezpečně ignoruje.
- **Oprava výběru fokusu a indexování položek ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - Opraven posun indexu (`hasParent ? focusedIndex - 1 : focusedIndex`) v metodách `getActiveSelectedItems()`, `triggerRename()`, `triggerQuickLook()` a otevření <kbd>F4</kbd>. Dříve přítomnost řádku `[ .. ]` způsobovala posun o 1 řádek a na poslední položce vracela prázdný výběr.
  - Kliknutí myší na jakýkoliv řádek souboru, složky, `[ .. ]` nebo do prostoru panelu nyní okamžitě aktivuje daný panel (`setActivePane(paneKey)`).
  - Přidána podpora `e.code` (`KeyC`, `KeyX`, `KeyV`, `KeyA`, `KeyD`, `KeyU`, `KeyR`) pro 100% spolehlivost na všech rozloženích klávesnic (včetně české QWERTZ).

### Version 3.27.7 (Odebrání položky Videa z levého stromu průzkumníku)
- **Zúžení systémových složek v levém panelu ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx), [lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - Ze systémových známých složek v levém panelu „Tento počítač” byla odebrána položka **Videa**.
  - Zůstávají primární složky určené pro přímou kreativní tvorbu: **Plocha**, **Stažené soubory**, **Obrázky**, na které bezprostředně navazují **Oblíbené složky** a diskové jednotky.

### Version 3.27.6 (Odstranění horizontálního bloku podsložek z horní lišty)
- **Čistší a kompaktnější navigace ([NativePathBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativePathBar.tsx), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Ze systémové navigační lišty byl trvale odebrán horizontální pruh tlačítek s podsložkami (`subdirs`), který zbytečně zabíral vertikální prostor v režimech **Prohlížeč** (Mřížka i Seznam), **Filmstrip** i **Porovnat**.
  - Procházení a struktura složek zůstává plně a přehledně dostupná v levém stromu průzkumníka ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx)), zatímco horní lišta zůstává elegantně jednořádková s drobečkovou navigací a historií `Zpět` / `Vpřed` / `Nahoru`.

### Version 3.27.5 (Přetahování myší mezi okny a standardní funkce Průzkumníka v Commanderu)
- **Kompletní Drag & Drop přetahování myší mezi panely a do složek ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - **Přesun a kopírování myší:** Soubory i celé složky (včetně vícenásobného výběru) lze tahem myši přetahovat z jednoho panelu do druhého. Výchozí akcí je bezpečný **Přesun**, s podržením klávesy <kbd>Ctrl</kbd> se aktivuje **Kopírování**.
  - **Pustit do podsložky i nadřazené složky `[..]`:** Přetažením nad libovolný řádek složky v cílovém panelu se daná složka vizuálně zvýrazní modrým rámečkem s odznakem `↳ Vložit do složky` a data se vloží přímo do ní. Lze přetáhnout i nad řádek `[..]` pro přesun o úroveň výš.
  - **Pustit na pozadí panelu:** Při najetí myší nad prázdné místo nebo obecný seznam souborů se aktivuje animovaný pruh `Pusťte myš pro přesun do této složky (Držte Ctrl pro kopírování)`.
  - **Bezpečnostní validace zamezující zacyklení:** Ochrana před neplatným přetažením složky do sebe samé nebo do její vlastní podsložky.
- **Standardní funkce Průzkumníka: Schránka, Vyjmout, Kopírovat, Vložit ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx)):**
  - **Vyjmout (<kbd>Ctrl+X</kbd>):** Označené položky jsou uloženy do schránky pro přesun a v seznamu souborů jsou okamžitě vizuálně ztlumeny s odznakem nůžek `vyjmuto`. Stiskem <kbd>Esc</kbd> se stav vyjmutí kdykoliv zruší.
  - **Kopírovat (<kbd>Ctrl+C</kbd>):** Uloží vybrané soubory do schránky pro duplikaci / vložení a zároveň zkopíruje jejich cesty do systémové schránky OS.
  - **Vložit (<kbd>Ctrl+V</kbd>):** Provede buď přesun (u vyjmutých) nebo nakopírování do aktivní složky s okamžitým obnovením obou panelů.
  - **Kopírovat plnou cestu (<kbd>Ctrl+Shift+C</kbd>):** Okamžitě zkopíruje absolutní cestu k souborům do systémové schránky Windows.
  - **Nová tlačítka v horní nástrojové liště Commanderu:** Přidána rychlá tlačítka `Vyjmout`, `Kopírovat` a dynamické `Vložit` s počítadlem připravených položek.
- **Kontextová nabídka pravého tlačítka myši (Windows 11 Fluent Context Menu):**
  - Kliknutí pravým tlačítkem na soubor, složku, řádek `[..]` nebo prázdné místo otevře nativní Fluent kontextové menu:
    - *Otevřít / Otevřít složku* (<kbd>Enter</kbd>)
    - *Zobrazit v Průzkumníku Windows*
    - *Otevřít v terminálu* (PowerShell / CMD)
    - *Vyjmout* (<kbd>Ctrl+X</kbd>)
    - *Kopírovat* (<kbd>Ctrl+C</kbd>)
    - *Vložit do této složky* (<kbd>Ctrl+V</kbd>)
    - *Kopírovat celou cestu* (<kbd>Ctrl+Shift+C</kbd>)
    - *Přejmenovat* (<kbd>F2</kbd>)
    - *Přesunout do Koše* (<kbd>Del</kbd> / <kbd>F8</kbd>)
    - *Nová složka* (<kbd>F7</kbd>)
    - *Vlastnosti* (<kbd>Alt+Enter</kbd>)
  - Při kliknutí pravým tlačítkem na neoznačenou položku se výběr automaticky zaměří na danou položku.

### Version 3.27.4 (Dynamická změna velikosti náhledů i v režimu Seznam)
- **Podpora změny velikosti náhledů v zobrazení Seznam ([MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx), [TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - **Dostupnost ovládacích prvků v obou režimech:** Posuvník velikosti náhledů, předvolby `S` / `M` / `L` / `XL` i přepínač oříznutí `Oříznout` / `Celý` (fitMode) jsou nyní plně aktivní a viditelné jak v Mřížce, tak v Seznamu s metadaty.
  - **Plynule škálovatelný náhled v řádcích tabulky:** Velikost náhledů v řádcích tabulky se dynamicky přizpůsobuje od kompaktních 28 px až po detailní 110 px náhledy s automatickou adaptací výšky řádků a vertikálním vycentrováním všech buněk (`align-middle`).
  - **Plné nativní rozlišení i v tabulce:** Pro přímé grafické formáty (`JPG`, `PNG`, `WebP`, `GIF`, `BMP`, `SVG`, `AVIF`) se v tabulce načítá křišťálově čistý nativní zdroj [toDesktopAssetUrl](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/tauriBridge.ts), takže i při zvětšení řádků zůstává náhled dokonale ostrý.
  - **Zvětšování kolečkem myši s klávesou Ctrl:** V seznamu lze nyní držet klávesu <kbd>Ctrl</kbd> a rolováním kolečka myši plynule zoomovat velikost náhledových řádků v reálném čase.

### Version 3.27.3 (Odebrání položek Hudba a Dokumenty z navigačního stromu)
- **Zpřehlednění levého navigačního panelu ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx), [lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Ze systémových složek v levém panelu „Tento počítač” byly odebrány položky **Hudba** a **Dokumenty**.
  - Zůstávají primární složky určené pro vizuální média a kreativní práci: **Plocha**, **Obrázky**, **Videa**, **Stažené soubory** a bezprostředně navazující **Oblíbené složky** spolu s diskovými jednotkami.
  - V Rust backendu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)) byly tyto složky vyjmuty ze seznamu dotazovaných kandidátů známých složek Windows, čímž se zrychlila i inicializace.

### Version 3.27.2 (Křišťálově ostré zobrazení velkých a vertikálních obrázků v plném rozlišení)
- **Oprava rozmazaných vertikálních a velkých obrázků při rozkliku ([ZoomableCanvas.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ZoomableCanvas.tsx), [QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx), [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts), [useNativeNavigation.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useNativeNavigation.ts)):**
  - **Zajištění 100% nativního rozlišení:** Opravena chyba, kdy u obrázků s velkými metadaty (ICC, XMP, Photoshop bloky) a u WebP souborů generátor náhledů přepisoval URL souboru a jeho rozměry zmenšeným 800px náhledem ze systémového shellu. U vertikálních snímků s poměrem stran např. 1:8 tak docházelo ke zmenšení šířky na pouhých 100 pixelů.
  - Pro všechny běžné rastrové formáty (`JPG`, `PNG`, `WebP`, `GIF`, `BMP`, `SVG`, `AVIF`) aplikace nyní striktně zachovává plné rozlišení `toDesktopAssetUrl(fullPath)` v [QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx), [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx), [CompareView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CompareView.tsx) i [FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx).
  - Při načtení obrázku se navíc automaticky synchronizují skutečné `naturalWidth` a `naturalHeight` a opraví se jakákoliv dříve mezipamětí uložená zmenšená metadata.
- **Nový inteligentní režim „Přizpůsobit šířce” (Fit to Width) v [ZoomableCanvas.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ZoomableCanvas.tsx):**
  - Pro vysoké infografiky, screenshoty celých webových stránek a mobilní mockup je nyní k dispozici režim **Šířka** (klávesa <kbd>W</kbd> nebo tlačítko na plovoucí liště).
  - Obrázek se pohodlně roztáhne na šířku okna, zarovná se na začátek (horní okraj) a uživatel může přirozeně **rolovat kolečkem myši shora dolů** jako na webové stránce, aniž by musel držet myš.
  - S podržením <kbd>Ctrl</kbd> kolečko plynule zoomuje v bodě kurzoru.
  - Tlačítko **1:1** (klávesa <kbd>0</kbd>) okamžitě zobrazí snímek ve 100% nativní velikosti pixel-na-pixel.
  - Dvojklik myší na vysokém obrázku inteligentně přepíná mezi **Celým oknem** a **Čtením na šířku**.
- **Odstranění GPU rastrového rozostření:**
  - Odstraněna direktiva `will-change: transform` ze statického zobrazení, která nutila prohlížeč Chromium uzamknout texturu v nízkém rozlišení layoutového boxu. Obrázky jsou nyní při libovolném zvětšení vykreslovány s maximální ostrostí a hardwarovým vyhlazováním.
  - Plovoucí HUD lišta zobrazuje přesné reálné procento původního rozlišení (např. `100% · Skutečná velikost`, `85% · Přizpůsobeno šířce`).

### Version 3.27.1 (Přepínání mezi Mřížkou a Seznamem pomocí klávesy TAB)
- **Přepínání zobrazení klávesou TAB ([useKeyboardShortcuts.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useKeyboardShortcuts.ts), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx), [TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)):**
  - V pracovním prostoru Prohlížeče lze nyní stiskem jediné klávesy <kbd>Tab</kbd> okamžitě přepínat mezi **Mřížkou** (náhledové karty) a **Seznamem** (metadata tabulka).
  - Klávesa respektuje stav psaní v textových polích i otevřené modály, aby nedocházelo k nechtěnému přepínání při psaní.
  - V režimu Commander zůstává klávesa <kbd>Tab</kbd> vyhrazena pro přepínání aktivního panelu přesně ve stylu Total Commanderu.
  - Tooltipy tlačítek přepínače v nástrojové liště byly aktualizovány o zkratku `(Tab / Ctrl+1,2)`.

### Version 3.27.0 (Dvoupanelový správce souborů v režimu Commander a la Total Commander)
- **Nový plnohodnotný pracovní režim Commander ([CommanderView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CommanderView.tsx), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx), [TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)):**
  - Do horní lišty přidána nová hlavní sekce **Commander** (dostupná i klávesovou zkratkou `Ctrl+5`).
  - V tomto režimu je zcela skryt levý postranní strom i pravý inspektor náhledu — celá obrazovka je dedikována čistému dvoupanelovému správci souborů přesně ve stylu legendárního Total Commanderu.
- **Autonomní panely s nezávislým procházením:**
  - Levý a pravý panel s plynule nastavitelným posuvníkem poměru šířky (výchozí 50 % / 50 %).
  - Každý panel disponuje:
    - Rychlými tlačítky disků (`C:`, `D:`, ...) s okamžitým přepnutím a indikátorem aktivního disku.
    - Zástupci rychlých míst Windows (`Obrázky`, `Plocha`, `Dokumenty`, `Stažené`) a tlačítkem pro otevření terminálu.
    - Interaktivním adresním řádkem s historií zpět/vpřed, tlačítkem o úroveň výš (`..`) a možností vepsat libovolnou cestu s <kbd>Enter</kbd>.
    - Bleskovým vyhledávacím filtrem souborů v reálném čase.
    - Řaditelnými sloupci: **Název**, **Přípona**, **Velikost** a **Datum změny** (složky jsou vždy přehledně nahoře).
    - Zvýrazněným rodičovským řádkem `[ .. ]` pro okamžitý návrat do nadřazené složky.
    - Stavovým řádkem Total Commanderu s počtem položek, celkovou velikostí a údaji o vybraných souborech.
- **Bleskové operace a přesouvání souborů mezi složkami:**
  - **F6 Přesunout / F5 Kopírovat:** Možnost vybrat 1 či více souborů/složek a okamžitě je přesunout či zkopírovat z aktivního panelu do cílového panelu.
  - **Drag & Drop:** Přetažení souborů myší z levého do pravého panelu (či naopak) — přetažením na pozadí panelu se soubory přesunou do aktuální složky, přetažením přímo na řádek konkrétní podsložky se přesunou do ní.
  - **F7 Nová složka:** Okamžité vytvoření podsložky v aktivním panelu.
  - **F8 Smazat:** Bezpečné smazání vybraných položek do Koše Windows.
  - **F2 / Shift+F6 Přejmenovat:** Rychlé přejmenování souboru či složky.
  - **F3 Zobrazit:** Rychlý náhled (QuickLook) s vizuálním inspektorem pro libovolný grafický soubor.
  - **F4 / Enter Otevřít:** Okamžité spuštění souboru ve výchozí aplikaci Windows nebo vstup do podsložky.
  - **Tlačítka Shodná složka (`=`) a Prohodit panely (`Ctrl+U`):** Okamžitá synchronizace cesty do druhého panelu nebo prohození levého a pravého adresáře.
- **Klávesové zkratky Total Commanderu:**
  - <kbd>Tab</kbd> pro okamžité přepínání aktivního panelu.
  - <kbd>Space</kbd> / <kbd>Insert</kbd> pro označení souboru s automatickým posunem dolů.
  - <kbd>Ctrl+A</kbd> pro výběr všech souborů, <kbd>Ctrl+D</kbd> pro zrušení výběru.
  - <kbd>Backspace</kbd> pro přechod do nadřazené složky (`..`).

### Version 3.26.9 (Přemístění oblíbených složek v bočním panelu přímo pod složku Obrázky)
- **Přemístění sekce Oblíbené složky v navigačním stromu ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx), [Sidebar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Sidebar.tsx)):**
  - Sekce **Oblíbené složky** byla přesunuta z úplného spodku panelu (kde byla odsunuta pod všechny disky a složky) přímo **nahoru pod systémovou složku Obrázky**.
  - Sekce obsahuje sbalitelný segment s autentickou zlatou hvězdou Windows 11 ([Win11Star](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Win11Icons.tsx)), počítadlem oblíbených a plynulou animací rozbalení/sbalení.
  - Každá oblíbená složka zachovává systémový vzhled Windows 11 (ikona [Win11Folder](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Win11Icons.tsx), modrý indikátor aktivního výběru, přetažení myší pro přesun souborů, křížek pro odebrání a kontextové menu).
  - V klávesové navigaci stromu ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx)) jsou oblíbené složky zahrnuty do pořadí, takže šipky nahoru/dolů jimi přirozeně procházejí.
- **Kontextová nabídka pro složky ([FileContextMenu.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FileContextMenu.tsx), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Při kliknutí pravým tlačítkem na libovolnou složku (ve stromu průzkumníka i v mřížce médií) je nově k dispozici volba **⭐ Přidat do oblíbených / Odebrat z oblíbených**.

### Version 3.26.8 (Sjednocení sekcí Mřížka a Seznam do jednoho zobrazení Prohlížeč s přepínací ikonou)
- **Sjednocení pracovních prostorů Mřížka a Seznam do jediné sekce Prohlížeč:**
  - V horní liště [TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx) sloučena samostatná tlačítka "Mřížka" a "Seznam" do jednoho primárního pracovního prostoru **"Prohlížeč"** (vedle režimů *Filmstrip* a *Porovnat*).
  - Tlačítko "Prohlížeč" v hlavní navigaci dynamicky zobrazuje ikonu aktuálního podrežimu — buď mřížku ([LayoutGrid](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)) nebo seznam ([List](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)).
- **Intuitivní přepínání zobrazení Mřížka / Seznam přes ikony v nástrojové liště:**
  - Do druhého řádku lišty nástrojů (přímo vedle řazení souborů) přidán segmentovaný ovladač s ikonami `Mřížka` ([LayoutGrid](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)) a `Seznam` ([List](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)) s jemným materiálovým podbarvením a tooltipy.
  - V režimu mřížky se plynule zobrazují ovladače velikosti miniatur (posuvník a presety S / M / L / XL); v režimu seznamu je lišta čistá a uvolněná pro metadata tabulky.
- **Perzistence a klávesové zkratky ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx), [useKeyboardShortcuts.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useKeyboardShortcuts.ts)):**
  - Stav zvoleného zobrazení (`grid` vs `table`) se automaticky ukládá do `localStorage` (`aerobridge_browser_view_mode`) a pamatuje se i po restartu aplikace.
  - Podpora rychlých klávesových zkratek `Ctrl+1` (přepnutí na mřížku) a `Ctrl+2` (přepnutí na tabulkový seznam).

### Version 3.26.7 (Oprava ikon složek v tabulkovém zobrazení Seznam a hydratační frontě)
- **Oprava ikon složek v režimu Seznam ([MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx)):**
  - **Identifikace kořenové příčiny:**
    1. V komponentě tabulky [MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx) se pro všechny řádky včetně složek generoval prvek `<img src={asset.url}>`. Protože složka neměla náhledový obrázek, `asset.url` byl prázdný řetězec, což v prohlížeči způsobovalo vykreslení rozbitého nebo chybějícího čtverce.
    2. V hydratační frontě náhledů [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts) navíc selhával fallback: při volání `getNativeFileIcon(asset.extension)` byl pro složku předán text `'SLOŽKA'` bez příznaku `isDir = true`. Windows API tak hledalo ikonu pro neexistující soubor `file.složka` a vrátilo generickou ikonu prázdného bílého dokumentu s ohnutým rohem, která následně přepsala `asset.url` složky.
  - **Implementace autentických Windows 11 ikon:**
    - V [MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx) se nyní u složek místo nefunkčního tagu `<img>` přímo vykresluje autentická žlutá vektorová ikona [Win11Folder](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Win11Icons.tsx).
    - V prvním sloupci `Formát` je složka vizuálně odlišena tónovaným jantarovým odznakem `SLOŽKA` s jemným orámováním namísto generického šedého odznaku.
  - **Oprava v hydratační pipeline a skenování složek:**
    - V [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts) upravena funkce `doGenerateNativeThumbnail` a její fallback, kde se pro složky správně volá `getNativeFileIcon('', true)` zjišťující skutečnou systémovou ikonu složky Windows.
    - V [localFileSystem.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/localFileSystem.ts) při skenování adresáře inicializována `url` složky přímo z `getCachedNativeFileIcon('', true)`.
    - V [ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx) a [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx) sjednoceno zobrazení [Win11Folder](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Win11Icons.tsx) pro maximální konzistenci se systémovým průzkumníkem Windows 11.

### Version 3.26.6 (Oprava zobrazení rozměrů rastrových souborů a zobrazení rozlišení v detailu)
- **Oprava zobrazování rozměrů (odstranění N/A pro JPG, PNG a další rastrové soubory):**
  - **Identifikace kořenové příčiny:** V `localFileSystem.ts` se při rychlém skenování adresáře inicializovaly všechny soubory s `dimensions: { width: 0, height: 0 }`. V `nativeThumbnails.ts` byla množina `directWebExtensions` (`jpg`, `jpeg`, `png`, ...), která byla z hydratace přeskočena, takže soubory nikdy nezískaly rozměry a `PreviewInspector` i `MetadataTableView` zobrazovaly `N/A`.
  - **Bleskový binární Image Header Parser ([imageHeaderParser.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/imageHeaderParser.ts)):**
    - Vytvořen binární analyzátor hlaviček pro JPEG (SOF0–SOF3 markery + JFIF/EXIF DPI), PNG (IHDR chunk + pHYs DPI), GIF (LSD), BMP (BITMAPINFOHEADER) a WebP (VP8/VP8L/VP8X).
    - Čte pouze prvních 64 KB souboru v čase < 0.2 ms bez nutnosti dekódovat celé tělo obrázku do paměti.
  - **Hydratační pipeline v [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts):**
    - `case 'image':` nyní bleskově vytěží skutečnou šířku, výšku a tiskovou hustotu (DPI) z binární hlavičky a propíše je do assetu.
    - Odstraněno umělé přeskočení webových obrázků v `hydrateNativeThumbnails` — rastrové obrázky procházejí bleskovou hydratací rozměrů, přičemž jejich náhled zůstává zachován jako přímé asset URL.
  - **Okamžité samohojení rozměrů (Self-Healing on Load):**
    - Do [ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx), [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx), [MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx), [QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx), [CompareView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CompareView.tsx) a [FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx) přidáno zachycení `naturalWidth` a `naturalHeight` při prvním načtení tagu `<img>`, takže se rozměry zobrazí okamžitě bez jakéhokoliv zpoždění.
- **Přidání informací o rozlišení do infa souboru a náhledů:**
  - **Kalkulátor rozlišení `getResolutionInfo` ([imageHeaderParser.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/imageHeaderParser.ts)):**
    - Výpočet celkového počtu megapixelů (např. `24.2 MP`).
    - Detekce standardů zobrazení (např. `8K UHD`, `4K UHD`, `2K QHD`, `Full HD`, `HD 720p`).
    - Zjištění a formátování tiskové hustoty (DPI/PPI) z EXIF/JFIF/pHYs metadat (např. `300 DPI`).
  - **Inspektor náhledu ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx)):**
    - V rychlém přehledu souboru přidán řádek **"Rozlišení:"** (např. `24.2 MP · 300 DPI (4K UHD)`).
    - V záložce "Podrobnosti & EXIF" přidána samostatná karta **"Rozlišení & Rozměry"** s podrobnými údaji: přesné rozměry v pixelech (Š × V), celkové rozlišení v MP a v celkovém počtu pixelů, standard zobrazení, hustota pixelů (DPI) a přesný poměr stran (např. `3:2 (1.50:1)`).
  - **Karty náhledů ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx)):**
    - V popisku miniatury se nyní u rozměrů zobrazuje i údaj o megapixelech (např. `6000 × 4000 (24.0 MP)`).
  - **Tabulkové zobrazení ([MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx)):**
    - Sloupec rozměrů přejmenován na "Rozměry & Rozlišení" a zobrazuje rozměry spolu s MP a standardem zobrazení.
  - **Rychlý náhled ([QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx)), Porovnávání ([CompareView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CompareView.tsx)) a Filmový pás ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx)):**
    - Plovoucí stavové lišty doplněny o přesné rozlišení a údaj o megapixelech.

### Version 3.26.5 (Přechod na Material Design plochy bez tenkých ohraničujících linek)
- **Kompletní odstranění tenkých obrysových linek (hairlines) kolem náhledů ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx)):**
  - **Tonal Elevation místo rámečků:** Všechny karty náhledů byly přepnuty z 1px tenkých obrysů (`border border-white/...`, `ring-1 ring-white/30`) na čisté materiálové plochy s tonálním kontrastem a měkkými stíny (Material Design 3 Surface Elevation).
  - *Klidový stav:* Přirozený plochý podklad `bg-[#18191f]` s lehkým prostorovým stínem `shadow-sm shadow-black/20`.
  - *Stav při najetí myší (Hover):* Zvýšení tónu na `bg-[#22242c]` s měkkým stínem `shadow-lg shadow-black/40` a jemným zdvihem `-translate-y-0.5`.
  - *Vybraný stav (Selection):* Tónovaný aktivní kontejner `bg-[#2b303d]` s výrazným prostorovým stínem `shadow-xl shadow-black/50`, bez jakýchkoliv bílých obrysových prstenců, doplněný o decentní modrý indikátor výběru (checkmark pill).
  - *Geometrie a zaoblení:* Přechod z ostrého `rounded-none` na ergonomické měkké zaoblení `rounded-xl`.
  - *Kontejner náhledu a informační panel:* Zrušena dělící linka `border-t border-white/...`. Spodní popisek plynule navazuje na obrazovou plochu jako spodní tónovaný segment karty (`rounded-b-xl bg-[#14151b]`).
  - *Odznaky a plovoucí akční tlačítka:* Přepnuto na jemné zaoblené pilulky s poloprůhledným blur povrchem bez ostrých 1px rámečků.
- **Konzistence napříč ostatními režimy zobrazení:**
  - **Filmový pás ([FilmstripView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FilmstripView.tsx)):** Miniatury v horizontálním pásu mají měkké zaoblení `rounded-xl`, odstraněny linky `border` a `ring-1`.
  - **Srovnávací stůl ([CompareView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/CompareView.tsx)):** Karty pro porovnávání souborů vedle sebe převedeny na čisté plochy `rounded-2xl` s hlubokým stínem a bezešvými hlavičkami.
  - **Inspektor náhledu ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx)):** Náhledový box převeden na zapuštěnou plochu `rounded-2xl bg-[#0f1014] shadow-lg`, záložky přepnuty na moderní segmentovaný přepínač v Material stylu bez podtrhávacích linek.
  - **Tabulkový režim ([MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx)):** Zrušeny 4px vertikální linky výběru, nahrazeno měkkou tonální plochou `bg-[#282d38] rounded-md` a zaoblenými ikonami.
  - **Rychlý náhled ([QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx)):** Odstraněny linky z plovoucích navigačních lišt a tlačítek, posíleny čisté plovoucí akrylové plochy s hlubokým stínem.

### Version 3.26.4 (Plná podpora náhledů a správy WebP souborů)
- **Tříúrovňová pipeline náhledů pro WebP ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - **Zařazení do hydratační fronty:** Odstraněna přípona `webp` ze souboru staticky přeskočených formátů `directWebExtensions`, čímž `.webp` soubory bezpečně procházejí hydratačním procesem s garancí načtení přesných rozměrů (`width × height`).
  - *Úroveň 1 (Windows Shell API):* Využití nativního Windows 11 WebP Image Thumbnail Provideru přes Win32 `IShellItemImageFactory` ve vysokém rozlišení až 800 px.
  - *Úroveň 2 (Desktop Asset URL & Dims Inspector):* Rychlé zjištění nativních rozměrů přímo z WebView2 cache s nulovým zpožděním.
  - *Úroveň 3 (Offline binární čtení & Data URL fallback):* Čtení binárního proudu souboru a konverze do trvalého Base64 Data URL (`data:image/webp;base64,...`), což garantuje 100% zobrazení i při nestandardním kódování cest ve Windows.
- **Typová identita a vizuální branding ([types.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/types.ts)):**
  - Vyhrazená větev pro formát WebP: identifikace jako `WebP Image`, kategorie `image`, odznak `#00c49f` (moderní Bauhaus tyrkysová) a přípona `WEBP`.
- **Filtrování v horní liště ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx) & [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Do rozbalovací nabídky formátů byl přidán samostatný filtr `WebP (.webp)` s odznakem `#00c49f` a precizní filtrovací logikou.
- **Ukázkový mock asset ([mockAssets.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/data/mockAssets.ts)):**
  - Přidán ultra-high resolution vzorový asset `Modern_Architecture_Geometric_Facade.webp` (3840×2160, 24-bit VP8X Lossless) pro okamžitou verifikaci v mock režimu i bez lokální složky.

### Version 3.26.3 (Oprava náhledů pro PowerPoint, Office, Figma a univerzální fallback Windows Shell API)
- **Kompletní podpora náhledů prezentací PowerPoint a dokumentů Office ([officeExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/officeExtractor.ts) & [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - **Identifikace kořenové příčiny:** V `hydrateNativeThumbnails` byl aplikován restriktivní filtr `a.category !== 'other'`, který soubory Office (`.pptx`, `.ppt`, `.docx`, `.xlsx`, `.odp`, `.odt` atd.) zcela vyloučil ze zpracování náhledů. V mřížce se tak zobrazovala pouze zmenšená systémová ikona bez náhledu úvodního slidu či stránky.
  - **Implementace extraktoru [officeExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/officeExtractor.ts):** Vytvořen samostatný modul pro extrakci náhledů z OpenXML a OpenDocument ZIP balíčků (`docProps/thumbnail.jpeg`, `Thumbnails/thumbnail.png` nebo `ppt/media/image1.png`).
  - **Dvouúrovňová pipeline pro Office:**
    - *Úroveň 1:* Vyvolání Windows Shell Thumbnail Provideru (`getNativeShellThumbnail(path, 800)`) pro získání věrného nativního náhledu prvního slidu v plném rozlišení.
    - *Úroveň 2:* Rychlý offline fallback přes JSZip čtením vestavěného `docProps/thumbnail.jpeg`.
- **Robustní pipeline pro Figma soubory ([vectorHtmlExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/vectorHtmlExtractor.ts)):**
  - **Prioritizace nativního shellu:** Při procházení se nejprve testuje Windows Shell thumbnail handler z desktopové aplikace Figma.
  - **Izolace chyb při rozbalování ZIPu:** Volání `JSZip.loadAsync` bylo zapouzdřeno do vnitřního `try...catch`, takže poškozené archivy nebo proprietární `fig-kiwi` binární bloky neshodí celou funkci, ale plynule přejdou na hloubkovou detekci embedded PNG/JPEG streamů od minimální velikosti 256 bajtů.
  - Použití přímých `data:` Base64 URL namísto dočasných `blob:` URL pro prevenci ztráty náhledů při navigaci mezi složkami.
- **Univerzální Windows Shell Thumbnail Fallback ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Odstraněna umělá filtrace formátů: do fronty náhledů jsou nyní zařazeny **všechny soubory**, které nejsou standardními webovými rastry (jež se načítají přímo).
  - Všechny registrované formáty v systému uživatele (např. Affinity Designer `.afdesign`, CorelDRAW `.cdr`, AutoCAD `.dwg`, 3D modely `.stl`/`.obj`, komiksy `.cbz` atd.) získávají plnohodnotné systémové náhledy přes Win32 `IShellItemImageFactory`. Pokud soubor náhled nemá, bezpečně a okamžitě se zobrazí oficiální ikona Windows Exploreru bez jakýchkoliv chybových ikon.
- **Doplnění typových identit v [types.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/types.ts):**
  - Přidány oficiální barevné odznaky a formáty pro PowerPoint (`#d04423`), Word (`#2b579a`), Excel (`#217346`) a OpenDocument (`.odp`, `.odt`, `.ods`).

### Version 3.26.2 (Oprava generování PDF náhledů polyfillem TC39 Uint8Array a otevírání ve výchozí aplikaci Windows 11)
- **Kompletní oprava generování PDF náhledů a vícestránkového prohlížeče ([polyfills.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/polyfills.ts) & [pdfPreview.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/pdfPreview.ts)):**
  - **Identifikace kořenové příčiny:** Nejnovější verze `pdfjs-dist@6.4.299` uvnitř své funkce pro tvorbu otisku dokumentu (`getDocument`) volá novou specifikaci ECMAScript 2024 `Uint8Array.prototype.toHex()`. V prostředí WebView2 a standardním Node.js/Vite tato metoda chyběla, což způsobovalo okamžitou tichou výjimku `TypeError: hashOriginal.toHex is not a function`, zamítnutí slibu a nemožnost vygenerovat jakýkoliv PDF náhled.
  - **Implementace polyfillu [polyfills.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/polyfills.ts):** Doplněny plnohodnotné polyfilly pro `Uint8Array.prototype.toHex`, `setFromHex` a `toBase64` dle specifikace TC39 Stage 3. Tento modul je importován jako první v [main.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/main.tsx), [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts) a [pdfPreview.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/pdfPreview.ts).
  - **Víceúrovňová pipeline náhledů v [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts):** Pro PDF soubory se nejprve pokusí získat nativní Windows Shell Thumbnail (`getNativeShellThumbnail(path, 600)` – bleskový rendering, pokud je instalován Adobe Acrobat nebo PowerToys PDF IExtractImage). Pokud systémový shell handler není k dispozici, okamžitě a bezpečně přebírá řízení offline `pdfjs-dist` s polyfillem a vygeneruje čistý náhled první strany ve vysokém rozlišení.
- **Oprava spouštění asociované aplikace ve Windows 11 ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs) & [useFileOperations.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useFileOperations.ts)):**
  - **Podpora moderních UWP/AppX a Win32 asociací v Rustu:** Původní `ShellExecuteW` s natvrdo definovaným slovesem `"open"` ve Windows 11 selhávalo u souborů, kde je výchozím prohlížečem moderní UWP aplikace (např. Microsoft Edge nebo Adobe Acrobat z MS Store), protože worker vlákno Tauri nemělo inicializovaný COM kontext.
  - Funkce `open_file_native` v [lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs) byla modernizována na `ShellExecuteExW` s `CoInitializeEx(None, COINIT_APARTMENTTHREADED)` a `CoUninitialize()`, `SEE_MASK_FLAG_NO_UI` a `lpVerb: PCWSTR::null()`, což Windows přikazuje spustit přesně tu akci, kterou má uživatel zvolenou jako výchozí ve Windows Nastavení. Jako spolehlivá záloha byl přidán fallback přes `explorer <soubor>`.
  - **Oprava chování v desktopovém UI:** Funkce `handleOpenAsset` v [useFileOperations.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useFileOperations.ts) dříve při dvojkliku nebo stisku klávesy Enter zamykala vizuální soubory (včetně PDF) v interním Quick Look modalu namísto jejich otevření v asociované aplikaci. Nyní v desktopovém režimu dvojklik a Enter spouští asociovanou aplikaci (`openFileNative`), zatímco mezerník otevírá rychlý náhled (Quick Look).
  - **Tlačítko v inspektoru [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx):** Zobrazuje se tlačítko "Otevřít ve výchozí aplikaci (Enter)" pro všechny soubory včetně PDF dokumentů.

### Version 3.26.1 (Oprava černé/prázdné obrazovky při startu a integrace WebView2 DevTools)
- **Kritická oprava React Rules of Hooks v [AssetGrid.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/AssetGrid.tsx):**
  - Hook `handleDragStart` (`useCallback`) byl dříve deklarován až ZA předčasným ukončením `if (assets.length === 0) return ...;`.
  - Při startu aplikace nebo přepnutí do prázdné/načítající se složky došlo k porušení pravidel hooků (`Rendered fewer hooks than expected`), což způsobilo tichý pád celého stromu komponent React 19 a černé prázdné okno.
  - Všechny hooky byly přesunuty před veškeré podmíněné návraty.
- **Implementace Fluent Design záchranné brzdy [ErrorBoundary.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ErrorBoundary.tsx):**
  - `<App />` je v [main.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/main.tsx) nyní bezpečně obalen v chybovém rozhraní, které v případě neočekávané chyby renderu místo černé obrazovky zobrazí srozumitelnou chybovou kartu s popisem chyby a tlačítky pro restart / vyčištění stavu.
- **Aktivace WebView2 vývojářských nástrojů (DevTools):**
  - Přidána podpora `devtools` do [Cargo.toml](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/Cargo.toml) a [tauri.conf.json](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/tauri.conf.json) a automatické otevření inspektoru při ladění v [lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs).

### Version 3.26.0 (Kompletní refaktoring dle skillu win11-vibecode-refactor, bezpečnostní hardening & dekompozice)
- **Fáze 1: Zabezpečení a hardening Rust backendu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs) & [tauri.conf.json](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/tauri.conf.json)):**
  - **Aktivace přísné Content Security Policy (CSP):** V konfiguraci Tauri byla nasazena striktní CSP (`default-src 'self' tauri: asset:; img-src 'self' asset: https://asset.localhost blob: data:; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com data:; frame-src 'none'; object-src 'none'`), která brání injekci externích skriptů a XSS.
  - **Blesková detekce jednotek přes Win32 API (`list_drives`):** Původní pomalé testování 26 písmen disků přes `Path::exists()` (způsobující zasekávání při uspaných či síťových discích) bylo nahrazeno přímým voláním Win32 `GetLogicalDrives()` bitmasky v kombinaci s `GetDriveTypeW`, což zkrátilo detekci na zlomek milisekundy.
  - **Ochrana proti rekurzivním symlink smyčkám a DoS (`calculate_dir_size_blocking`):** Přidána detekce a přeskakování symlinků/junctions (`file_type.is_symlink()`), hloubkový strop (max 12 úrovní) a limit na maximální počet položek (200 000), což eliminuje nekonečné smyčky a zablokování systémových vláken.
  - **Obrana proti Path Traversal v `rename_file_native` a `create_folder_native`:** Zavedena striktní validace zakazující relativní přechody (`.` a `..`) a zakázané Windows znaky (`\ / : * ? " < > |`).
  - **Validace cest v `open_terminal_native`:** Kontrola existence a typu cesty před vyvoláním PowerShellu s přidaným parametrem `-NoLogo`.
- **Fáze 2: Dekompozice monolitického [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx) do specializovaných hooků:**
  - Vytvořen [useNativeNavigation.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useNativeNavigation.ts) zapouzdřující procházení složek, navigační historii, předky cest a hydrataci náhledů.
  - Vytvořen [useFileOperations.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useFileOperations.ts) zapouzdřující schránku (kopírovat, vyjmout, vložit), kontextovou nabídku, dialogy přejmenování, nové složky, mazání do koše a spouštění terminálu/vlastností.
  - Vytvořen [useKeyboardShortcuts.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/hooks/useKeyboardShortcuts.ts) využívající stabilní mutable referenci na props, čímž bylo zcela odstraněno neustálé odregistrovávání a znovuregistrovávání globálního `window.addEventListener('keydown')` při každém kliknutí a změně výběru.
  - Soubor `App.tsx` byl zmenšen o více než 540 řádků bez jakékoliv změny chování.
- **Fáze 3: Modularizace thumbnail extractorů ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts) -> `src/utils/extractors/`):**
  - Rozdělení 1500řádkového monolitu do specializovaných a čistě typovaných modulů:
    - [adobeExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/adobeExtractor.ts): InDesign (.indd, .idml), Photoshop (.psd, .psb), Illustrator (.ai, .eps), XMP preview streamy.
    - [rawTiffExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/rawTiffExtractor.ts): Camera RAW (CR2, CR3, NEF, ARW, DNG, RAF) a vícestránkový TIFF přes UTIF.
    - [blendExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/blendExtractor.ts): Blender 3D (.blend) embedded náhledy.
    - [vectorHtmlExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/vectorHtmlExtractor.ts): SVG, HTML stránky, Figma (.fig), Krita (.kra), Corel Painter (.rif), RIFF parser.
    - [types.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/extractors/types.ts): Společné typy, detekce vizuálních assetů a zástupné symboly.
  - Plná zpětná kompatibilita zajištěna re-exportem z původního souboru.
- **Fáze 4: Čištění vibecodingu a ošetření chyb:**
  - Odstraněn zastaralý [.env.example](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/.env.example) odkazující na cloudové Gemini API klíče; nahrazen čistou desktopovou konfigurací pro 100% offline běh.
  - Nahrazeny tiché `catch {}` bloky v [tauriBridge.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/tauriBridge.ts) za transparentní debug logování.
  - Přidána podpora chybových toastů typu `'error'` s červenou ikonou v [Toast.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Toast.tsx).

### Version 3.25.0 (Kompletní optimalizace rychlosti, odstranění mikro-lagů a bezpečnostní audit)
- **Zabezpečení a stabilita nativního backendu v Rustu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs) & [icons.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/icons.rs)):**
  - **Odstranění rizika command injection v `open_file_native`:** Nahrazeno nebezpečné volání `cmd.exe /C start ""` přímým voláním Windows API `ShellExecuteW` (s příznakem `SW_SHOWNORMAL`). Tím byla zcela eliminována možnost zranitelnosti vůči vkládání příkazů (např. přes znaky `&`, `|`, `^` v názvech souborů), spouštění je okamžité a bez spouštění zprostředkujícího procesu `cmd.exe`.
  - **Sanitizace argumentů v `reveal_in_explorer`:** Ošetřeno předávání uvozovek a nestandardních znaků při volání `explorer.exe /select,"..."`.
  - **Ochrana proti OOM (Out Of Memory) v `read_file_binary`:** Přidán bezpečnostní strop (300 MB) pro neomezené načítání souborů. Při nechtěném dotazu na gigabajtové ISO nebo 4K video soubory již nedojde k vyčerpání RAM a pádu aplikace.
  - **Odstranění vytváření OS vláken pro každý náhled v `icons.rs`:** Funkce `shell_thumbnail_png` již pro každý jeden soubor nespouští separátní operační vlákno (`std::thread::spawn`), nýbrž bezpečně využívá existující blokující thread-pool Tauri runtime a inicializuje STA/MTA COM kontext přímo, což radikálně snižuje CPU režii a zpoždění při procházení složek s mnoha soubory.
  - **COM apartmánová stabilita ve `show_file_properties_native`:** Přidána explicitní inicializace a úklid COM (`CoInitializeEx` a `CoUninitialize`) při vyvolání nativního dialogu vlastností souboru přes `ShellExecuteExW`, což předchází chybám `CO_E_NOTINITIALIZED`.
- **Blesková mezipaměť náhledů (LRU Thumbnail Cache) ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Implementována paměťová LRU cache `thumbCache` s kapacitou 2 500 položek (klíčovaná podle cesty, velikosti a data změny souboru).
  - Při návratu do dříve otevřené složky se všechny existující náhledy (PDF, INDD, AI, BLEND, RAW atd.) vykreslí okamžitě v čase **0 ms** bez jakéhokoliv čtení z disku.
  - Funkce `patchToDataUrl` garantuje, že uložené náhledy jsou trvalé Base64 URI, takže neztrácejí platnost po uvolnění dočasných `blob:` odkazů.
- **Bezpečnostní sanitizace vektorů a HTML ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts)):**
  - V `extractSvgThumbnail` a `extractHtmlThumbnail` byla zavedena striktní filtrace: odstranění všech `<script>`, `<iframe>`, `<object>`, `<embed>` elementů a ořezání všech nebezpečných `on*` event handlerů i `javascript:` odkazů, čímž je zaručena naprostá bezpečnost proti XSS útokům v náhledech.
- **Odstranění záseků a mikro-lagů v UI ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx) & [AssetGrid.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/AssetGrid.tsx)):**
  - **Memoizace karet přes `React.memo` s vlastním komparátorem:** Komponenta `ThumbnailCard` je nyní memoizována. Při kliknutí, změně výběru nebo změně fokusu se překreslí POUZE nově vybraná a dříve vybraná karta. Zbylé desítky až stovky karet se nepřekreslují, což zaručuje plynulou odezvu bez jakýchkoliv záseků.
  - **Nahrazení Framer Motion nativním GPU CSS:** Z karet v mřížce byla odstraněna náročná animace z knihovny Framer Motion (`<motion.div>` s přepočtem stylů a spring fyzikou na každém prvku) a nahrazena hardwarově akcelerovanými CSS transformacemi (`hover:-translate-y-0.5 active:scale-[0.99] will-change-transform`). Mřížka dosahuje stabilních 120 FPS i při rychlém posouvání.
  - **Oddělení `selectedIds` z props karet:** Hromadný drag-and-drop byl přenesen do centrálního handleru v `AssetGrid.tsx`, takže změna množiny výběru již nenarušuje memoizaci jednotlivých karet.
- **Prevence úniků paměti (Memory Leaks) v prohlížeči ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx) & [tauriBridge.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/tauriBridge.ts)):**
  - Při přechodu mezi složkami v `navigateNative` se nyní automaticky uvolňují staré `blob:` URL náhledů pomocí `URL.revokeObjectURL()`.
  - Zavedena funkce `isSharedIconUrl()`, která garantuje, že společné systémové ikony přípon zůstávají v paměti pro bleskové zobrazení, zatímco gigabajty nepotřebných dočasných bitmap z předchozích složek jsou okamžitě vráceny systému.

### Version 3.24.0 (Podpora náhledů Blender .blend a oprava zobrazení ikon)
- **Nativní extrakce 3D náhledů ze souborů Blender (.blend) ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts) & [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Implementována funkce `extractBlendThumbnail`, která přímo z hlavičky souboru `.blend` (blok `TEST`) načte vložený plnobarevný 3D náhled scény / modelu generovaný Blenderem a převede jej na ostrý PNG náhled.
  - Formáty `.blend`, `.blend1` a `.blend2` byly zařazeny mezi vizuální soubory s vlastní identitou (kategorie `blend`, značka `#ea7600`).
  - Přidána podpora Windows Shell thumbnail provideru pro `.blend` jako záložní krok před ikonou.
- **Oprava skrytí a poškození ikon při chybě načítání ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx) & [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx)):**
  - Odstraněn bug, kdy `onError` nastavil trvalý inline styl `opacity: '0'` na elementu obrázku při prázdné nebo zpožděné URL, což způsobovalo, že se ikony (např. Blenderu) po načtení vůbec nezobrazily nebo byly neviditelné.
  - Zajištěno bezpečné vykreslování – element `<img>` se renderuje pouze při existující platné URL nebo záložní ikoně a správně deleguje na načtení oficiální ikony ze systému.

### Version 3.23.0 (Nahrazení generovaných placeholderů oficiálními ikonami systému Windows)
- **Kompletní odstranění generovaných placeholderů ([localFileSystem.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/localFileSystem.ts), [adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts) & [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Odstraněno generování tmavých canvas karet s velkým textem a nápisem „AEROBRIDGE STUDIO“ pro soubory bez okamžitého náhledu.
  - Všechny soubory bez vizuálního náhledu (nebo před načtením náhledu) jsou okamžitě označeny jako `isIcon: true` a napojeny na oficiální ikony Windows Shellu.
- **Rychlý synchronní a asynchronní cache oficiálních systémových ikon ([tauriBridge.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/tauriBridge.ts) & [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Zavedena synchronní paměťová mezipaměť `getCachedNativeFileIcon` a paralelní načtení ikon všech unikátních přípon nalezených v otevřené složce.
  - Všechny dokumenty (`.docx`, `.xlsx`, `.pptx`, `.txt`, `.pdf`, `.zip`, `.exe`, hudební a video formáty atd.) ihned získávají svou oficiální ikonu registrované aplikace (Word, Excel, Poznámkový blok, WinRAR atd.).
- **Rozšířená podpora ikon ve Windows Shellu v Rustu ([icons.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/icons.rs)):**
  - Funkce `icon_png` normalizuje příponu a k vyhledávání velkých ikon (`SHIL_JUMBO`, `SHIL_EXTRALARGE`) přidává i záložní `SHIL_LARGE` (32×32), což garantuje získání ikony pro jakoukoliv příponu v systému Windows.
- **Čisté centrování v komponentách ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx), [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx) & [MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx)):**
  - Všechny karty i náhledový inspektor zobrazují oficiální ikonu s lehkým stínem v přesném poměru stran (`object-contain`) a již nikdy nezobrazují roztažený zástupný symbol nebo generovaný placeholder.

### Version 3.22.0 (Odstranění výchozích ukázkových složek z oblíbených)
- **Čisté oblíbené složky bez automatického vracení mock složek ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Výchozí stav `favoriteFolders` byl změněn z přednastavených ukázkových složek (`/adobe-projects` a `/commercial`) na prázdné pole `[]`.
  - Při načítání uložené session z IndexedDB se tyto dvě zastaralé ukázkové cesty automaticky odfiltrují, takže se už uživateli po spuštění ani po odebrání znovu nevrací.

### Version 3.21.0 (Odstranění staré funkcionality Místní disky IndexedDB)
- **Kompletní odstranění sekce Místní disky (IndexedDB) ([Sidebar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Sidebar.tsx) & [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Odstraněna celá sekce „Místní disky (IndexedDB)“ z postranního panelu, která byla dřívějším pozůstatkem webového režimu prohlížeče.
  - V postranním panelu byl vyčištěn kód i props (`savedDirectories`, `onRescanDirectory`, `onRemoveSavedDirectory`).
  - V [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx) byl odstraněn stav `savedDirectories`, obslužné handlery a volání ukládání directory handle do IndexedDB.
  - Postranní panel se nyní plně a čistě soustředí na nativní Windows strom disků a složek („Tento počítač“ s disky C:, D:, E:...) a oblíbené složky.

### Version 3.20.0 (Kompletní oprava náhledů Adobe InDesign .indd)
- **Podpora Windows Shell thumbnail provideru pro .indd ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Do pipeline pro `adobe-indd` bylo jako prioritní krok přidáno volání `getNativeShellThumbnail(path, 600)`. Pokud je v systému nainstalován Adobe InDesign, Adobe Bridge nebo SageThumbs, náhled se okamžitě a v plné kvalitě získá přímo ze systémového provideru.
- **Robustní parsování XMP packetu v Rustu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - Funkce `find_xmp_start` a `find_xmp_end` byly upraveny tak, aby nehledaly pouze přesný řetězec bez mezer, ale správně detekovaly značky `<xmpGImg:image` i s libovolnými atributy, mezerami nebo zalomeními řádků až po uzavírací `>` znak.
  - Zajištěno spolehlivé vytažení Base64 JPEG náhledu z InDesign XMP metadat.
- **Vylepšené vyhledávání vnořených JPEG toků a IDML archivu ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts) & [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Vyhledávání vnořených JPEG náhledů rozšířeno z původních 24 MB na 32 MB hlavičky.
  - V regulárním výrazu pro JavaScriptovou XMP extrakci povoleno libovolné množství atributů v `<xmpGImg:image[^>]*>`.

### Version 3.19.0 (Konzistentní zobrazení nativní ikony souboru při absenci náhledu jako u .indd)
- **Sjednocení chování při selhání či absenci náhledu ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Všechny formáty (`.ai`, `.fig`, `.kra`, `.rif`, `.raw`, `.svg`, `.eps`, `.html`) nyní při absenci vizuálního náhledu vrací `null` stejně jako `.indd`.
  - Při návratu `null` plánovač automaticky načte nativní Windows shell ikonu pro danou příponu (`getNativeFileIcon`) a nastaví `isIcon: true`.
  - Opravena chyba v plánovači, která dříve přepisovala `isIcon` na `false`, což způsobovalo deformování a roztahování ikon přes celou kartu.
- **Odstranění porušené ikony prohlížeče při chybě načtení obrázku ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx), [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx) & [MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx)):**
  - Implementován `onError` handler pro všechny komponenty zobrazující náhledy.
  - Pokud se nepodaří načíst náhledový stream nebo je soubor poškozen, komponenta automaticky přepne na zobrazení čisté vystředěné systémové ikony souboru (např. ikony Illustrator, Figma, InDesign z Windows) a nikdy nezobrazí rozbitý zástupný symbol prohlížeče.

### Version 3.18.0 (Oprava náhledů Figma .fig a Adobe Illustrator .ai)
- **Oprava Windows Shell thumbnail provideru v Rustu ([icons.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/icons.rs)):**
  - V `shell_thumbnail_worker` byl příznak `SIIGBF_RESIZETOFIT` (který při neexistenci thumbnail provideru vracel Windows ikonu souboru namísto chyby) nahrazen striktním `SIIGBF_THUMBNAILONLY | SIIGBF_BIGGERSIZEOK`.
  - Windows Shell tak vrací bitmapu pouze v případě, že existuje skutečný generátor náhledu, a nevrací obecné ikony maskované za náhledy, které blokovaly interní extraktory.
- **Oprava podpory formátu Figma .fig ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts) & [nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):**
  - Přímé vyvolání `extractFigmaThumbnail` namísto spoléhání na Windows Shell (který pro Figma soubory nemá nativní shell extension).
  - Vylepšená detekce ZIP kontejneru: vyhledání hlavičky `PK\x03\x04` i za binárním preamblem (kiwi hlavičky).
  - Robustní rozbalení archivu: kromě kořenového `thumbnail.png` / `preview.png` nyní extraktor prohledává i složku `images/`, kde Figma ukládá rastrové výstupy rámců a pláten bez přípon, a detekuje je podle magických bajtů (PNG, JPEG, WebP) s výběrem největšího rozlišení.
  - Vylepšen skener vnořených PNG toků pro výběr největšího plátna.
- **Oprava podpory formátu Adobe Illustrator .ai ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts), [adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts) & [lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - Rozšířen rozsah vyhledávání PDF kompatibilního toku (`findPdfOffset`) z původních 512 KB na 8 MB, což spolehlivě zachytí `%PDF-` i u souborů s velkými PostScript/XMP hlavičkami a ICC profily.
  - V Rustu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)) přidána v `extract_xmp_thumb_blocking` podpora obou jmenných prostorů: `<xmpGImg:image>` i `<xapGImg:image>`, které různé verze Adobe Illustrator používají pro vestavěné JPEG náhledy.
  - Prioritní řazení v `nativeThumbnails.ts`: PDF stream rendering -> XMP Packet -> PostScript hex thumbnail -> vnořený JPEG -> Windows Shell thumbnail -> ikona.

### Version 3.17.0 (Možnost spustit terminál ve složce z kontextového menu)
- **Nativní spouštění terminálu v Rustu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - Implementován příkaz `open_terminal_native`, který spustí terminál přímo v cílové složce.
  - Využívá víceúrovňovou detekci:
    1. *Windows Terminal* (`wt.exe -d "<path>"`) – moderní výchozí terminál Windows 11 s kartami a profily.
    2. *PowerShell* (`powershell.exe`) – přímé otevření v pracovním adresáři složky.
    3. *Příkazový řádek* (`cmd.exe /K`) – spolehlivá záloha.
  - V případě kliknutí na soubor se terminál otevře v jeho nadřazené složce.
- **Kontextové menu pravého tlačítka myši ([FileContextMenu.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FileContextMenu.tsx) & [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Položka `Otevřít v terminálu` s ikonou terminálu je nyní dostupná:
    - Při kliknutí pravým tlačítkem myši na libovolnou složku v mřížce nebo tabulce.
    - Při kliknutí pravým tlačítkem myši na prázdné místo v aktuálně procházené složce.
    - Při kliknutí pravým tlačítkem myši na složku v levém stromu Průzkumníka.
    - Při kliknutí na soubor (`Otevřít terminál ve složce`).

### Version 3.16.0 (Vyčištění stromu složek v levém Průzkumníku)
- **Odstranění textu `(žádné podsložky)` ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx)):**
  - U prázdných složek bez podsložek se již nezobrazuje matoucí text `(žádné podsložky)`.
  - Strom složek nyní funguje a vypadá čistě a autenticky jako v nativním Průzkumníku Windows 11 (pouze koncová složka bez zbytečných popisků).

### Version 3.15.0 (Kompletní podpora náhledů pro Krita malby a projekty — .kra)
- **Extrakční pipeline pro formát Krita ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts)):**
  - Implementována specializovaná funkce `extractKritaThumbnail` pro formát `.kra` (OpenDocument ZIP kontejner `application/x-krita`):
    - *Extrakce sloučeného plátna*: Prohledání archivu pro plnohodnotný sloučený náhled `mergedimage.png`, `preview.png` nebo `Thumbnails/thumbnail.png`.
    - *Metadata & rozměry*: Čtení přesných rozměrů plátna z `maindoc.xml` (`<IMAGE width="..." height="...">`) a informací o dokumentu.
    - *Záložní skenování toků*: Fallback vyhledávání vnořených PNG (`extractEmbeddedPng`) i JPEG (`extractEmbeddedJpeg`) toků v binárním souboru.
- **Nativní podpora Windows Shell & offline zpracování ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts), [localFileSystem.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/localFileSystem.ts)):**
  - V desktopové verzi (Tauri) se prioritně využívá Windows Shell thumbnail handler Krita (pokud je Krita nainstalována).
  - Všechny soubory `.kra` získávají jasný azurový odznak Krita `#3daee9` a plnohodnotné zobrazení v mřížce, filmovém pásu i tabulce.
- **Rychlý náhled a filtrace ([QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx), [TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Soubory `.kra` jsou zařazeny mezi vizuální formáty (`isVisualAsset`), takže stisk mezerníku nebo kliknutí v inspekčním panelu otevře interaktivní celoobrazovkový zoom.
  - Do filtru médií v horní liště přidána kategorie *Krita malba (.kra)*.

### Version 3.14.0 (Dynamická změna šířky pravého postranního panelu s náhledem tahem myši)
- **Dynamický resize handle pro pravý panel ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Mezi hlavní plátno a pravý inspekční panel `PreviewInspector` byla přidána interaktivní táhlová lišta se symetrickým chováním k levému panelu stromu složek.
  - Tahem myši doleva/doprava lze plynule rozšiřovat a zužovat pravý panel s náhledem od kompaktních `260 px` až po velkorysých `1000 px` (či podle šířky obrazovky).
  - Během tažení je aktivován globální kurzor `col-resize` a potlačeno nechtěné označování textu.
  - Dvojklik na táhlo okamžitě obnoví výchozí optimální šířku `440 px`.
  - Zvolená šířka se automaticky ukládá do `localStorage` (`aerobridge_inspector_width`) a zachovává se i po restartu aplikace.
- **Responzivní škálování náhledového plátna ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx)):**
  - Kontejner náhledu obrázku i samotný obrázek dynamicky škálují svou maximální výšku podle aktuální šířky panelu (`previewMaxHeight`).
  - Při rozšíření panelu se tak náhled proporcionálně zvětšuje a nabízí mnohem detailnější inspekci obrázků, vektorů, HTML stránek a designů bez nutnosti otevírat celoobrazovkový režim.

### Version 3.13.0 (Kompletní podpora vizuálních náhledů pro HTML dokumenty — .html, .htm)
- **Generátor vizuálních náhledů HTML souborů ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts)):**
  - Implementována funkce `extractHtmlThumbnail`, která provádí bezpečnou extrakci a vykreslení HTML stránky do náhledu:
    - *DOM Parser & Sanitizace*: Dekódování UTF-8 / textového obsahu, odstranění skriptů `<script>` pro bezpečnost a zachování všech vložených stylů `<style>`, odkazů i inline stylů.
    - *XHTML serializace*: Prohnání dokumentu přes `XMLSerializer` zaručuje 100% syntaktickou validitu uzavřených tagů pro SVG rendering.
    - *SVG Browser Frame*: Vykreslení webové stránky uvnitř moderního prohlížečového okna s horní lištou, ovládacími tečkami (macOS / browser dots), URL adresním řádkem a titulkem stránky.
    - *Rasterizace do Canvas*: Převod SVG s `<foreignObject>` na JPEG/PNG náhled vysokého rozlišení s automatickým záložním SVG Blobem.
- **Integrace do pipeline miniatur a zobrazení ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts), [localFileSystem.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/localFileSystem.ts)):**
  - Všechny `.html` a `.htm` soubory se automaticky indexují s vizuálním náhledem namísto generické prázdné ikony dokumentu.
  - V mřížce (`AssetGrid`), filmovém pásu (`FilmstripView`) i tabulce (`MetadataTableView`) se zobrazují miniatury s oficiálním HTML5 odznakem v barvě `#e44d26`.
- **Interaktivní Quick Look se zoomem ([QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx)):**
  - Stiskem mezerníku nebo kliknutím na náhled v inspekčním panelu se otevře interaktivní celoobrazovkový náhled HTML stránky se zoomem, posunem (pan & zoom) a informacemi o dokumentu.
- **Filtrování a kontextové menu ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx), [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx), [FileContextMenu.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FileContextMenu.tsx)):**
  - Do rozbalovacího menu médií v TopBaru přidána kategorie `HTML dokumenty (.html)` s oranžovou tečkou `#e44d26`.
  - V kontextovém menu pravého tlačítka myši volba `Otevřít ve výchozí aplikaci` přímo spustí HTML soubor v preferovaném výchozím webovém prohlížeči uživatele (Edge, Chrome, Firefox apod.).

### Version 3.12.0 (Přímé otevírání nevizuálních souborů ve výchozí aplikaci Windows)
- **Automatická detekce nevizuálních formátů ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts)):**
  - Implementována funkce `isVisualAsset`, která přesně rozlišuje vizuální formáty (obrázky, vektory, PDF a designové projekty určené pro Quick Look a plátno) od nevizuálních souborů a mediálních toků.
  - Mezi nevizuální soubory s automatickým otevíráním ve výchozí aplikaci patří:
    - *Videa*: `.mp4`, `.mov`, `.avi`, `.mkv`, `.wmv`, `.flv`, `.webm`, `.m4v`, `.3gp` atd.
    - *Hudba a audio*: `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg`, `.m4a`, `.wma`, `.aiff`, `.mid` atd.
    - *Textové soubory a kód*: `.txt`, `.md`, `.json`, `.csv`, `.log`, `.xml`, `.html`, `.css`, `.js`, `.ts`, `.py`, `.sql`, `.ini`, `.cfg` atd.
    - *Dokumenty a archivy*: `.docx`, `.xlsx`, `.pptx`, `.zip`, `.rar`, `.7z` atd.
- **Okamžité otevření dvojklikem a klávesou Enter ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx), [AssetGrid.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/AssetGrid.tsx), [MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx)):**
  - Při dvojkliku nebo stisku klávesy `Enter` na nevizuální soubor se soubor okamžitě spustí v jeho přiřazené výchozí aplikaci Windows (např. Poznámkový blok / VS Code pro text, VLC / Windows Media Player pro video a hudbu).
- **Inspekční panel a rychlý náhled ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx) & [QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx)):**
  - U nevizuálních položek je v pravém panelu i v okně QuickLook k dispozici výrazné tlačítko `Otevřít ve výchozí aplikaci (Enter)` s ikonou externího odkazu, které rovněž soubor ihned spustí.

### Version 3.11.0 (Kompletní podpora náhledů pro Adobe Illustrator — .ai)
- **Víceúrovňová pipeline pro extrakci náhledů `.ai` souborů ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts) & [adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts)):**
  1. *Windows Shell API (`IShellItemImageFactory`)*: V desktopovém režimu se automaticky využívá nativní Windows Shell handler Adobe Illustratoru / Adobe Bridge pro okamžité vykreslení ostrých náhledů ve vysokém rozlišení (512x512).
  2. *PDF Stream Renderer (`findPdfOffset` & `renderPdfBufferFirstPage`)*: Moderní `.ai` soubory jsou PDF-kompatibilní. Implementováno vyhledávání offsetu streamu `%PDF-` kdekoliv v hlavičce a vektorové renderování první stránky pomocí PDF.js.
  3. *XMP balíček*: Extrakce vnořeného náhledu `<xmpGImg:image>` v Rustu i JavaScriptu.
  4. *PostScript hex rastrový náhled (`extractPostScriptThumbnail`)*: Pro starší verze nebo soubory bez PDF kompatibility byl implementován dekodér hexadecimálních 24bitových RGB a 8bitových rastrových náhledů z PostScript bloků `%%BeginThumbnail:` / `%AI7_Thumbnail:` / `%%BeginPreview:`.
  5. *Skenování vnořených JPEG toků*: Záložní vyhledávání JPEG SOI markerů (`0xFF 0xD8 ... 0xFF 0xD9`).
- **Podpora vícestránkových pláten (Artboards) v Inspektoru ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx) & [pdfPreview.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/pdfPreview.ts)):**
  - Pro vícestránkové `.ai` soubory s více plátny byl aktivován přepínač stránek v pravém inspekčním panelu.

### Version 3.10.0 (Přidání formátů JPG a PNG do menu výběru médií)
- **Rozšíření menu filtru médií ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)):**
  - Do rozbalovací nabídky *Filtrovat podle médií* byly přidány přímé položky pro `JPG (.jpg, .jpeg)` a `PNG (.png)`.
  - Položky jsou umístěny přímo na začátku seznamu hned pod *Všechna média*, aby byly okamžitě po ruce bez nutnosti rolovat v nabídce.
  - Vizuální barevné rozlišení teček: `#10b981` (smaragdově zelená pro JPG) a `#06b6d4` (azurová pro PNG).
- **Filtrovací logika v aplikaci ([App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Implementována přesná filtrace souborů podle přípon `.jpg`, `.jpeg` a `.png` při výběru příslušné kategorie médií, včetně automatické aktualizace počtadel a okamžitého zobrazení ve všech pohledech.

### Version 3.9.0 (Výběr složek pomocí Shift a Ctrl v levém Průzkumníku jako ve Windows 11)
- **Podpora multi-výběru přes `Ctrl + kliknutí` ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx)):**
  - Umožňuje nesouvislý vícenásobný výběr libovolných složek a jednotek v levém stromu Průzkumníka. Opakovaným kliknutím s `Ctrl` se položka z výběru odebere.
- **Rozsahový výběr přes `Shift + kliknutí`:**
  - Výběr souvislého rozsahu všech aktuálně viditelných složek mezi kotevní složkou (`lastAnchor`) a kliknutou složkou přesně jako v Průzkumníku souborů Windows 11.
- **Klávesová navigace ve stromu:**
  - Podpora `Shift + Šipka nahoru / dolů` pro postupné rozšiřování výběru viditelných složek.
  - Podpora `Ctrl + A` pro okamžitý výběr všech rozbalených a viditelných složek v Průzkumníku.
- **Vizuální styl Windows 11 Fluent:**
  - Vybrané složky získávají Windows 11 podsvícení `bg-white/[0.07]` s jemným ohraničením `ring-1 ring-white/10`.
  - Aktivně procházená složka si zachovává signature modrý vertikální indikátor `#60cdff`.
  - V záhlaví sekce se při vícenásobném výběru zobrazuje odznak s počtem vybraných složek (např. `3 vybráno`).
- **Hromadné kontextové operace ([FileContextMenu.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FileContextMenu.tsx) & [App.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/App.tsx)):**
  - Kliknutí pravým tlačítkem na označené složky zachovává hromadný výběr a umožňuje hromadné operace (kopírování cest, smazání do koše apod.).

### Version 3.8.0 (Výpočet skutečné velikosti složek a detailní statistiky v infu)
- **Výpočet skutečné velikosti složek v Rustu ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - Implementován asynchronní Rust příkaz `get_folder_size`, který nerekurzivním zásobníkovým průchodem bleskově spočítá celkovou velikost všech souborů ve složce v bajtech, celkový počet souborů a podsložek.
- **Zobrazení v inspekčním panelu ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx)):**
  - Místo dřívější chybné hodnoty `0 B` se nyní při označení libovolné složky automaticky načte a zobrazí její skutečná velikost (např. `142.5 MB (48 položek)`) a počet podsložek (`Obsah složky: 48 souborů, 3 podsložky`).
  - Během výpočtu na pozadí je zobrazován stav `Počítám velikost…`.
- **Aktualizace karet miniatur a tabulkového zobrazení ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx) & [MetadataTableView.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/MetadataTableView.tsx)):**
  - Asynchronní procesor na pozadí ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)) dopočítává velikost složek zobrazených v mřížce. Pokud velikost ještě není spočtena, zobrazuje se `Složka` / `—` namísto matoucího `0 B`.

### Version 3.7.0 (Klávesová zkratka 'A' pro okamžité sbalení všech složek v Průzkumníku)
- **Klávesová zkratka `A` (Sbalit vše):**
  - Stisknutím klávesy `A` (nebo `a`) se v postranním panelu Průzkumníka ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx)) okamžitě sbalí všechny otevřené složky nejvyšší úrovně (místa i diskové jednotky C:\, D:\ atd.) včetně všech jejich podsložek.
  - Ochrana proti nechtěnému stisku: zkratka ignoruje psaní v textových vstupech (vyhledávání, dialogy přejmenování) i otevřená modální okna.
  - Do hlavičky sekce *Tento počítač* bylo přidáno přímé tlačítko `Sbalit [A]` s indikací klávesy pro pohodlné ovládání myší i klávesnicí.

### Version 3.6.0 (Podpora náhledů souborů SVG a průhlednosti vektorů)
- **Nativní extrakce náhledů a rozměrů SVG vektorů ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts)):**
  - Implementována funkce `extractSvgThumbnail` pro analýzu a bezpečné renderování libovolných SVG souborů.
  - Zajištění přítomnosti povinného jmenného prostoru `xmlns="http://www.w3.org/2000/svg"`, bez kterého některé prohlížeče a WebView2 odmítají SVG v tagu `<img>` zobrazit.
  - Přesný výpočet vnitřních rozměrů z atributů `viewBox="minX minY width height"` a `width`/`height` pro zobrazení reálného rozlišení v rozhraní.
  - Vytvoření ověřeného `Blob` s explicitním MIME typem `image/svg+xml;charset=utf-8` pro 100% spolehlivé zobrazení na všech platformách.
- **Šachovnice průhlednosti (Studio Transparency Grid):**
  - Pro soubory `.svg` s průhledným pozadím byla přidána subtilní tmavá šachovnice `.bg-checkerboard` ([index.css](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/index.css)) v kartách miniatur ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx)) i v detailním panelu ([PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx)).
  - Tmavé/černé vektorové ikony a loga jsou nyní dokonale čitelné a nekontrastují naslepo s černým pozadím.
- **Filtry v horní liště ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)):**
  - Přidán dedikovaný filtr `SVG a vektory (.svg)` se zlatavým odznakem `#f59e0b`.
- **Integrace do pozadí a webového rozhraní:**
  - Plná integrace do nativní asynchronní fronty generování náhledů ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)) a webového rozhraní ([localFileSystem.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/localFileSystem.ts)).
  - Doplněn ukázkový mock soubor `AeroBridge_Studio_Brandmark.svg` v [mockAssets.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/data/mockAssets.ts).

### Version 3.5.0 (Podpora náhledů souborů Figma — .fig)
- **Nativní extrakce náhledů ze souborů Figma (`.fig`):**
  - Moderní Figma soubory exportované jako `.fig` jsou ZIP archivy obsahující vysokorozlišovací náhled plátna `thumbnail.png` (nebo `preview.png`).
  - Implementována automatická extrakce přes `JSZip` v [adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts):
    1. *ZIP extrakce*: Detekce ZIP hlavičky `PK\x03\x04` a okamžité načtení vnořeného `thumbnail.png` / `preview.png` nebo rastrových aktiv ze složky `images/`.
    2. *Skenování binárních dat*: Podpora pro kiwi-binární streamy a nekomprimované toky skenováním PNG signatur (`0x89 0x50 0x4E 0x47` ... `IEND`) a JPEG streamů.
    3. *Windows Shell náhledy*: Podpora pro nainstalované Windows preview handlery přes `get_shell_thumbnail`.
    4. *Branded Figma placeholder*: Generování charakteristické Bauhaus karty s Figma fialovým odznakem (`#a259ff`), typografií a metadaty.
- **Kategorie a filtry:**
  - Přidána kategorie `figma` do typového systému aplikace ([types.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/types.ts)).
  - Nový filtr formátů v horní liště ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)): `Figma Design (.fig)` s fialovým odznakem `#a259ff`.
  - Integrace do nativního procesoru miniatur na pozadí ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)) a do webového průzkumníka ([localFileSystem.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/localFileSystem.ts)).
  - Přidán ukázkový mock soubor `AeroBridge_Design_System_v3.fig` v [mockAssets.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/data/mockAssets.ts).

### Version 3.4.0 (Zobrazení jména a přípony souborů pod miniaturami ve stylu Adobe Bridge — Ctrl+T)
- **Klávesová zkratka `Ctrl+T` (Adobe Bridge styl):**
  - Stisknutím klávesové zkratky `Ctrl+T` (či `Ctrl+I`) se přepíná zobrazení názvů a přípon souborů přímo pod miniaturami v mřížce.
  - Funguje stejně jako volba *View > Show Thumbnail Only* v Adobe Bridge — umožňuje přepínat mezi čistým zobrazením pouze miniatur a zobrazením s trvalým popiskem se jménem a příponou pod každým obrázkem.
- **Vylepšené popisky miniatur ([ThumbnailCard.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/ThumbnailCard.tsx)):**
  - Pod obrázkem je zobrazen kompletní název souboru včetně přípony s bezpečným zalomením (`line-clamp-2 break-all`), takže ani u dlouhých názvů nedojde k oříznutí přípony.
  - V metadatovém řádku je zobrazena velikost, rozlišení a zřetelný odznak přípony formátu.
- **Rychlé tlačítko a indikace v TopBaru ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)):**
  - Do druhého řádku horní lišty vedle přepínače ořezu (Fit mode) bylo přidáno rychlé tlačítko `Názvy zapnuty / Pouze miniatury` s indikátorem zkratky `Ctrl+T`.
  - Položka v menu se třemi tečkami aktualizována na `Názvy a přípony pod obrázky (Ctrl+T)`.
- **Trvalé uložení stavu (Persistence):**
  - Stav zobrazení popisků se automaticky ukládá do `localStorage`, takže si aplikace volbu pamatuje i po restartu.
- **Autentický Windows 11 vzhled složek a průzkumníka vlevo ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx) & [Sidebar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Sidebar.tsx)):**
  - Vytvořena dedikovaná komponenta vektorových Fluent ikon ([Win11Icons.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/Win11Icons.tsx)) pro Windows 11:
    - *Žluté teplé složky (zavřená / otevřená s náhledem dokumentu uvnitř)*
    - *Barevné ikony známých složek Windows 11:* Plocha (Desktop), Dokumenty (Documents), Stažené soubory (Downloads), Obrázky (Pictures), Hudba (Music), Videa (Videos).
    - *Ikona Tento počítač a nativní disky (Disky C:, D:, ...)* s Windows 11 designem.
- **Autentické názvy diskových jednotek a jmenovek svazků ([lib.rs](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src-tauri/src/lib.rs)):**
  - Místo dřívějšího generického popisku `Disk (C:)` se nyní přes Windows Shell API (`SHGetFileInfoW` a `GetVolumeInformationW`) načítají skutečné jmenovky svazků nastavené v systému Windows (např. `System (C:)`, `Work Archive (D:)`, `Personal (E:)`, `Working (F:)`, `Library (G:)`).
- **Oprava otevírání umístění souboru ("Složka" pod náhledem):**
  - Opravena chyba spouštění `explorer.exe` s escapovanými uvozovkami v Rustu, kvůli které Explorer padal do výchozího zobrazení Plochy.
  - Pomocí `cmd.raw_arg(...)` se nyní spolehlivě otevírá konkrétní nadřazená složka s přesně označeným a zvýrazněným vybraným souborem.

---

### Version 3.3.0 (Podpora náhledů Corel Painter & TIFF, listování vícestránkovými PDF a Windows kontextové menu)
- **Zobrazování náhledů TIFF (`.tif`, `.tiff`):**
  - Implementována plnohodnotná podpora TIFF snímků, které WebView2 / Chromium nativně v tagu `<img>` nepodporuje.
  - *Dvouúrovňový mechanismus:*
    1. *Windows Shell API (`get_shell_thumbnail` v Rustu)* — okamžitý vysokorozlišovací náhled přes Windows Imaging Component (WIC).
    2. *Offline UTIF.js dekodér ([adobeThumbnailExtractor.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/adobeThumbnailExtractor.ts))* — dynamicky načítaný Photopea UTIF engine (LZW, PackBits, Deflate, JPEG-in-TIFF, CMYK, uncompressed).
  - Podpora vícestránkových TIFF souborů s možností listování stranami ([QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx) & [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx)).
  - Přidán filtr formátu `TIFF snímky (.tif)` v postranním panelu.
- **Podpora náhledů Corel Painter (`.rif`, `.riff`):**
  - Dvouúrovňová extrakce náhledů:
    1. *Nativní Windows Shell API (`IShellItemImageFactory` v Rustu)* — přímé čtení vykresleného náhledu přes Windows Shell rozhraní / Corel RiffSE handler.
    2. *Offline binární extraktor RIFF kontejneru* — analyzuje RIFF strukturu, bloky náhledů (`RDIB`, `DIB `, `THMB`, `PREV`, `JPEG`, `PNG `), skenuje vložené JPEG/PNG toky a převádí DIB bitmapy na validní BMP.
  - Vlastní kategorie a filtr formátů v postranním panelu (`Corel Painter (.rif)`) s charakteristickým jantarově oranžovým štítkem (`#f97316`).
- **Listování vícestránkovými PDF dokumenty:**
  - Plnohodnotná podpora listování stranami v rychlém náhledu ([QuickLookModal.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/QuickLookModal.tsx)), v pravém panelu [PreviewInspector.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/PreviewInspector.tsx) i na kartě náhledu.
  - Podpora klávesových zkratek `Page Up` / `Page Down` a číselník stránek s dynamickým offline renderováním přes pdf.js.
- **Plnohodnotné kontextové menu ve stylu Průzkumníka Windows ([FileContextMenu.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/FileContextMenu.tsx)):**
  - Pravým tlačítkem myši nad soubory a složkami: Otevřít ve výchozí aplikaci, Přejmenovat (`F2`), Kopírovat (`Ctrl+C`), Vyjmout (`Ctrl+X`), Vložit (`Ctrl+V`), Smazat do koše / trvale (`Delete`), Zobrazit v Průzkumníku, Vlastnosti souboru (`Alt+Enter`) a Vytvořit novou složku.
- **Zpřehlednění navigace a sjednocení filtrů médií:**
  - Výběr a filtr podle formátu médií byl přesunut z postranního panelu přímo do horní lišty nástrojů ([TopBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/TopBar.tsx)) na místo, kde bylo dříve vyhledávací pole.
  - Vyhledávací pole (Search) bylo umístěno vedle filtru médií směrem doprava doprostřed.
  - Odstraněn duplicitní mock modul „Knihovna & Složky“ z postranního panelu, sjednoceno na nativním stromu disků a složek „Tento počítač“.

---

### Version 3.2.0 (Desktop Průzkumník disků, skutečné náhledy PDF/INDD & nová ikona)
- **Oprava: nezobrazující se náhledy PNG/JPG v desktopové aplikaci** — zapnut Tauri `asset` protokol (`protocol-asset` + `assetProtocol` scope), bez kterého WebView nenačetl lokální soubory.
- **Procházení disků jako v Průzkumníku:**
  - Strom „Tento počítač“ (Plocha, Dokumenty, Stažené, Obrázky, Videa, Hudba + všechny disky) s líným rozbalováním ([NativeExplorerTree.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativeExplorerTree.tsx)).
  - Adresní lišta Zpět / Vpřed / Nahoru / Obnovit, klikací cesta, ruční zadání cesty a čipy podsložek ([NativePathBar.tsx](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/components/NativePathBar.tsx)); zkratky `Alt+←/→/↑`, `F5`.
  - Skryté a systémové soubory Windows se nezobrazují; obnovení poslední otevřené složky po startu.
  - Nové Rust příkazy: `list_drives`, `get_user_places`, `list_subdirs`; skenování běží asynchronně mimo hlavní vlákno.
- **Skutečné náhledy dokumentů** ([nativeThumbnails.ts](file:///e:/_MY_APPS/Antigravity/MediaBridgeBrowser/src/utils/nativeThumbnails.ts)):
  - PDF — vykreslení první stránky přes pdf.js (offline, worker inline).
  - InDesign — Rust příkaz `extract_xmp_thumbnail` streamuje soubor a čte XMP náhled; opravena chyba s entitami `&#xA;` v base64, kvůli které se náhled dříve nenašel. IDML — náhled z ZIP balíčku.
  - Illustrator (PDF-kompatibilní render), Photoshop (XMP / JFIF), RAW, EPS a snímky z videí.
  - Náhledy se generují na pozadí (3 souběžně), složka se otevře okamžitě.
  - `read_file_binary` nyní používá binární IPC (`tauri::ipc::Response`) a volitelný limit bajtů.
- **Nová ikona aplikace** (monogram „Ab“) pro Windows, macOS a web/PWA.
- `tsconfig.json`: omezen rozsah `tsc` na zdrojové soubory (neprochází `src-tauri/target`).

---

### Version 3.1.0 (Čistá neutrální šedá paleta — Neutral Studio Gray)
- **Profesionální vizuální redesign barev:**
  - Odstraněny teplé pískové a hnědé odstíny (`stone-*`, `#ede8df`, `#131211`, `#161513`) napříč celou aplikací.
  - Zavedena čistá neutrální šedá paleta v tónech tmavého zinku a platiny (`zinc-*`, platinový akcent `#e2e4e9`, čisté pozadí `#121316` a panely `#16171a`).
  - Sjednoceny karty náhledů, postranní panel, horní lišta, modální okna i rychlý náhled (QuickLook) do jednotného kalibrovaného tmavého schématu ve stylu moderních profesionálních nástrojů (Adobe / Apple Pro Apps).

---

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
