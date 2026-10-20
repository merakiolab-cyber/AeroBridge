# AeroBridge Studio — Product Roadmap

**Vize:** Bleskový, open-source digitální asset manažer (DAM) a organizér fotografií/grafiky pro Windows 11 a web, který plnohodnotně nahrazuje těžkopádný a placený Adobe Bridge.

---

## 🧭 Aktuální stav: Verze 3.27.30 (Dvoupanelový Commander s ConPTY Multi-Tab terminálem & Zápisníkem)
- [x] Základní architektura v React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Tauri v2 (Rust)
- [x] 5 pracovních režimů (Prohlížeč Mřížka/Seznam, Filmstrip, Porovnání / Compare, Commander dvoupanel)
- [x] Integrovaný ConPTY terminál s multi-tab podporou pro více složek současně a přetrváváním procesů na pozadí
- [x] Podpora Claude Code, Git, npm a interaktivních CLI nástrojů s Bracketed Paste Mode
- [x] Vícezložkový Zápisník s formátovaným Markdown & JSON náhledem přímo v panelech Commanderu
- [x] Bauhaus vizuální styl (tmavý motiv, JetBrains Mono + Plus Jakarta Sans, jemné dělicí linie)
- [x] Pravý inspekční panel (zvětšený náhled 400px, EXIF data, IPTC, histogram, rozlišení & MP)
- [x] Bezkontaktní výběr souborů (decentní 10% bílý závoj místo rušivého obrysu)
- [x] Resizovatelný levý postranní panel (180–500 px s pamětí v LocalStorage)
- [x] File System Access API + IndexedDB trvalé ukládání složek a sezení
- [x] Dávkové přejmenování souborů (Prefix, Datum, Číselná řada, Suffix, Find & Replace)
- [x] Dávková úprava IPTC metadat (Titulek, Popis, Autor, Copyright, Místo, Klíčová slova)
- [x] Rychlý export do ZIP s klientským přepočtem (WebP, JPEG, PNG, vodoznak, resize)
- [x] Klávesové zkratky (`Mezerník` pro QuickLook, `Ctrl+M` pro IPTC, `Ctrl+T` / `Ctrl+I` pro zobrazení názvů a přípon jako v Adobe Bridge, šipky pro navigaci)
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

## 🖥️ Fáze 3: Samostatná nativní desktopová aplikace pro Windows 11 (Tauri v2) (DOKONČENO ✅)
- [x] **Přechod na Tauri v2 (Rust + WebView2):**
  - [x] Inicializace Tauri v2 architektury (`src-tauri`) a konfigurace nativního okna (1400×900, centrované, resizovatelné)
  - [x] Přidání desktopových npm skriptů (`npm run desktop:dev`, `npm run desktop:build`)
  - [x] Nativní Windows okno se Snap Layouts podporou a přímým přístupem k diskům bez webových dialogů
  - [x] Nativní IPC most v Rustu (`pick_folder_native`, `scan_folder_native`, `read_file_binary`, `reveal_in_explorer`)
  - [x] Tlačítko „Složka / Průzkumník“ v pravém inspekčním panelu pro okamžité zvýraznění souboru ve Windows File Exploreru
  - [x] Podpora kompilace standalone .exe balíčku (velikost do 15 MB)

---

## 🗂️ Fáze 4: Desktop Průzkumník & nativní náhledy (DOKONČENO ✅)
- [x] Procházení všech disků a složek jako v Průzkumníku (strom, adresní lišta, historie, zkratky)
- [x] Náhledy PDF (pdf.js s listováním stran), InDesign (XMP), Illustrator, Photoshop, RAW a videí přímo z disku
- [x] Náhledy souborů Corel Painter (`.rif`, `.riff`) — Windows Shell `IShellItemImageFactory` + offline RIFF/DIB/JPEG dekodér
- [x] Náhledy souborů TIFF (`.tif`, `.tiff`) — Windows Shell WIC + offline Photopea UTIF engine (i pro vícestránkové TIFFy)
- [x] Náhledy souborů Figma (`.fig`) — extrakce vloženého `thumbnail.png` z ZIP kontejneru + kiwi stream / Windows Shell + fialový odznak (`#a259ff`)
- [x] Náhledy souborů Adobe XD (`.xd`) — extrakce vloženého `preview.png` / `thumbnail.png` z ZIP kontejneru + Windows Shell + fuchsiový odznak (`#ff61f6`)
- [x] Náhledy souborů SVG (`.svg`) — XML validace, viewBox/width/height extrakce, xmlns normalizace a šachovnice průhlednosti
- [x] Plnohodnotné kontextové menu Průzkumníka Windows (Otevřít, Přejmenovat, Kopírovat, Vyjmout, Smazat, Nová složka, Vlastnosti)
- [x] Dvojklik na soubor = otevření v systémové aplikaci; podsložky přímo v mřížce
- [x] Nová ikona aplikace a standalone .exe + instalátor
- [x] Cache náhledů v paměti / LRU s okamžitým 0ms načtením, aby se při opakovaném otevření složky negenerovaly znovu
- [x] Čistý strom navigačního panelu: ponechány klíčové složky (Plocha, Stažené, Obrázky, Oblíbené), odstraněna Videa, Hudba a Dokumenty

---

## ⚡ Fáze 5: Dvoupanelový správce souborů Commander (Total Commander styl) (DOKONČENO ✅)
- [x] **Dvoupanelové zobrazení (CommanderView):**
  - [x] Autonomní levý a pravý panel s nezávislým procházením, posuvným splitterem a pamětí otevřených cest
  - [x] Rychlá tlačítka diskových jednotek (`C:`, `D:`, ...), systémová místa a tlačítko otevření terminálu (PowerShell / CMD)
  - [x] Řaditelné sloupce (Název, Přípona, Velikost, Změněno) a řádek nadřazené složky `[ .. ]`
  - [x] Stavový řádek Total Commanderu s počty vybraných souborů a celkovou velikostí v bajtech
- [x] **Kompletní souborové operace & klávesové zkratky:**
  - [x] <kbd>F5</kbd> Kopírování do protějšího panelu / <kbd>F6</kbd> Přesun do protějšího panelu
  - [x] <kbd>F7</kbd> Vytvoření nové složky / <kbd>F8</kbd> a <kbd>Delete</kbd> Smazání do Koše Windows
  - [x] <kbd>F2</kbd> / <kbd>Shift+F6</kbd> Rychlé přejmenování položky
  - [x] <kbd>F3</kbd> Rychlý náhled (QuickLook) / <kbd>F4</kbd> a <kbd>Enter</kbd> Otevření v asociované aplikaci
  - [x] <kbd>Tab</kbd> Přepínání mezi levým a pravým panelem s automatickým fokusem
  - [x] <kbd>Space</kbd> / <kbd>Insert</kbd> Označení položky s posunem dolů
  - [x] <kbd>Ctrl+A</kbd> Označit vše / <kbd>Ctrl+D</kbd> Zrušit označení
  - [x] <kbd>Ctrl+U</kbd> Prohození cest levého a pravého panelu / Tlačítko `=` Synchronizace složky
- [x] **HTML5 Drag & Drop přetahování myší mezi panely:**
  - [x] Přetažení myší z panelu do panelu (přesun jako výchozí, podržením <kbd>Ctrl</kbd> kopírování)
  - [x] Pustit do konkrétní podsložky i do nadřazeného řádku `[ .. ]`
  - [x] Vypnutí nativního `dragDropEnabled: false` v Tauri pro plnou kompatibilitu s WebView2 HTML5 událostmi
- [x] **Plná podpora bočních tlačítek myši (XButton1 / XButton2):**
  - [x] Tlačítko Zpět / Vpřed na myši kontextově naviguje v historii panelu, nad kterým se nachází kurzor myši
  - [x] Klávesová navigace historií <kbd>Alt+Vlevo</kbd>, <kbd>Alt+Vpravo</kbd>, <kbd>Alt+Nahoru</kbd>
- [x] **Spolehlivé systémové kopírování a schránka (<kbd>Ctrl+C</kbd>, <kbd>Ctrl+X</kbd>, <kbd>Ctrl+V</kbd>):**
  - [x] Capture fáze listeneru a ochrana proti uvíznutí fokusu v textových polích
  - [x] Stabilní reference bez stale closures (`stateRef`, `clipboardRef`)
  - [x] Automatické zacílení na první reálný soubor při vstupu do složky
  - [x] Obousměrná integrace se systémovou schránkou Windows (vkládání souborů z Průzkumníka Windows)

---

## 🖼️ Fáze 6: Zdokonalení zobrazení médií, Filmstrip a výchozí pracovní prostředí (DOKONČENO ✅)
- [x] **Výchozí pracovní disk `F:\` (Working) namísto systémového `C:\` (System):**
  - [x] Prioritní automatická detekce a otevírání pracovního disku `F:\` při startu aplikace v desktopovém režimu
  - [x] Automatické přesměrování a ignorování systémového disku `C:\` (Windows OS)
  - [x] Oboustranná inicializace panelů Commanderu na disk `F:\` (Working)
  - [x] Plná podpora kořenů všech diskových jednotek v navigačním stromu a oblíbených položkách
- [x] **Oprava zobrazení náhledů ve Filmstripu (Fit to Frame Screen):**
  - [x] Odstranění globálních omezovačů `96vh` / `98vw` způsobujících vertikální ořez na monitorech
  - [x] Plnohodnotný `max-w-full max-h-full min-w-0 min-h-0 w-auto h-auto object-contain` adaptivní kontejner se zachováním poměru stran bez ořezu a deformací
  - [x] Bezpečné okraje (`paddingClassName` `pt-16 pb-16`) zamezující kolizi s horním informačním štítkem a spodní lištou zoomu
- [x] **Persistent Zoom (Paměť měřítka zobrazení):**
  - [x] Zachování zvoleného zoomu/měřítka (např. 70 %, 50 %, 150 %) při přechodu mezi obrázky (šipkami, kolečkem či kliknutím)
  - [x] Automatické vycentrování nového obrázku při zachování měřítka
  - [x] Rozšíření spodního limitu zmenšení až na 20 % (`scale: 0.2`)
  - [x] Dvojklik nebo tlačítko *Okno* pro okamžitý reset na 100% přizpůsobení oknu
- [x] **Interaktivní spodní lišta miniatur Filmstripu:**
  - [x] Uchopení a tažení myší (Mouse Grab & Drag-to-Scroll) pro plynulý posun dlouhých pásů miniatur
  - [x] Ochrana proti nechtěnému výběru při dokončení tažení
  - [x] Automatické horizontální rolování při otáčení kolečka myši nad lištou
  - [x] Automatické sledování aktivní miniatury (`scrollIntoView`) při navigaci z klávesnice či bočních tlačítek myši
- [x] **Podpora změny velikosti miniatur i pro zobrazení Seznam (Table/List View):**
  - [x] Sjednocení ovládacích prvků velikosti miniatur (posuvník, presety S/M/L/XL, Oříznout vs Celý) v TopBaru i pro zobrazení Seznam
- [x] **Odstranění složek z gridu v náhledových režimech:**
  - [x] Režimy Prohlížeč, Filmstrip a Porovnat zobrazují výhradně mediální soubory (složky jsou přístupné v levém stromu a Commanderu)
  - [x] Odstraněna položka Videa z levého panelu systémových složek

---

## ⚙️ Fáze 7: Správa mezipaměti & nastavení (DOKONČENO ✅)
- [x] **Správa a promazání mezipaměti (Cache Management a la Adobe Bridge):**
  - [x] Rychlá akce pro promazání cache aktivní složky (vynucení čerstvého znovunačtení miniatur z disku) přes nabídku `...` i klávesovou zkratku <kbd>Ctrl+F5</kbd>
  - [x] Plnohodnotný modální dialog Nastavení a správa mezipaměti přístupný tlačítkem ozubeného kola v horní liště, z nabídky `...` nebo přes <kbd>Ctrl+,</kbd>
  - [x] Živý přehled stavu mezipaměti v reálném čase: počet miniatur v RAM (LRU), renderované stránky a dokumenty PDF, systémové ikony Windows Shell a databáze IndexedDB s odhadem velikosti v MB
  - [x] Vyčištění veškeré paměťové i diskové mezipaměti jedním kliknutím s bezpečným uvolněním paměti (`URL.revokeObjectURL`, `.destroy()` pro PDF streamy a resetem tabulek)
  - [x] Nastavitelná kapacita paměťové mezipaměti miniatur (1 000 / 2 500 / 5 000 položek) s perzistencí v `localStorage`
  - [x] Informační záložka „O aplikaci & Systém“ s přehledem parametrů Windows 11 Fluent UX, 100% offline zabezpečení a podporovaných formátů

---

## 💻 Fáze 8: Integrovaný ConPTY Multi-Tab terminál, Zápisník a pokročilé Commander workflow (DOKONČENO ✅)
- [x] **Multi-Tab terminálový systém (ConPTY + xterm.js):**
  - [x] Nativní Rust backend `portable-pty` implementující Windows Pseudo Console (ConPTY)
  - [x] Podpora více současně otevřených terminálových záložek s nezávislými PTY relacemi, historií a běžícími procesy
  - [x] Tlačítko `+ Nová` pro otevření terminálu v aktuální složce a tlačítko `Z druhé strany` pro otevření v protějším panelu
  - [x] Kontextové otevření z nabídky Průzkumníka/Commanderu na libovolné složce přímo do nové záložky integrovaného terminálu
  - [x] Podpora shellů PowerShell, CMD a WSL s přepínáním bez restartu procesů
  - [x] Křížek `✕` na záložce pro deterministické ukončení daného PTY procesu (`ptyKill`)
- [x] **Plná podpora pro Claude Code & interaktivní CLI nástroje:**
  - [x] Korektní implementace Bracketed Paste Mode (`\x1b[200~...\x1b[201~`) přes `term.paste()` a normalizace CRLF
  - [x] Podpora vkládání přes <kbd>Ctrl+V</kbd>, <kbd>Ctrl+Shift+V</kbd>, <kbd>Shift+Insert</kbd> i pravé tlačítko myši
  - [x] Inteligentní chování <kbd>Ctrl+C</kbd>: kopírování při aktivním výběru, jinak vyslání signálu `SIGINT` (`^C`) pro přerušení běžícího příkazu
  - [x] Rychlé spouštěcí tlačítko Claude Code (`Sparkles`) přímo v nástrojové liště
- [x] **Přetrvávání procesů na pozadí & optimalizace výkonu:**
  - [x] Při přepnutí z Terminálu na Soubory se relace neodpojují, ale zůstávají běžet na pozadí (`display: none`) s 0 % GPU/canvasové zátěže
  - [x] Živý zeleně pulzující indikátor počtu aktivních procesů běžících na pozadí v záhlaví panelu Commanderu
  - [x] Návrat do Terminálu bez prodlevy a bez ztráty kontextu, rozpracovaných příkazů či scrollbacku
- [x] **Spolehlivý zoom a škálování terminálu:**
  - [x] Okamžitá synchronizace geometrie sloupců a řádků (`ptyResize`) při změně velikosti písma
  - [x] Prevence ztráty fokusu při kliknutí na zoom tlačítka (`preventDefault` na mousedown)
  - [x] Tlačítko ukazatele velikosti písma s funkcí okamžitého resetu na výchozích 13 px
  - [x] Zkratky <kbd>Ctrl + +</kbd>, <kbd>Ctrl + -</kbd>, <kbd>Ctrl + 0</kbd> a <kbd>Ctrl + Kolečko myši</kbd> nad oknem terminálu
- [x] **Vícezložkový Zápisník / Editor s Markdown & JSON náhledem:**
  - [x] Současná práce s více textovými soubory v záložkách s indikátorem neuložených změn
  - [x] Režimy Editor, Rozdělený náhled (Split) a Čistý náhled (Preview) s formátováním Markdown a barevnou syntaxí JSON

---

## 🚫 Vyřazené funkce ze záměru (Out of Scope / Záměrně neimplementovat)
- ❌ **Typografie & OpenType (Font preview / Glyphs / Font management):** Zcela vyřazeno z DAM workflow jako zbytečné. AeroBridge se soustředí výhradně na kreativní média (foto, video, Adobe formáty, vektorovou grafiku).
- ❌ **Barevné štítky & hodnocení hvězdičkami (Rating 1–5, Labels):** Odmítnuto pro zachování minimalistického, nerušivého prostředí bez vizuálního smogu.
- ❌ **Cloud AI & externí API (Gemini / Auto-tagging / Sémantické vyhledávání):** Zrušeno ve prospěch 100% offline soukromí, nulové telemetrie a nulových nákladů na tokeny.

