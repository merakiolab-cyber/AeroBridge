# CLAUDE.md — AeroBridge Studio

Guide for Claude Code Pro and AI assistants working on **AeroBridge Studio**.

---

## 1. Project Overview & Mission

**AeroBridge Studio** is an ultra-fast, modern, lightweight Digital Asset Manager (DAM) and media organizer designed as a modern, high-performance, and free alternative to Adobe Bridge.
- **Aesthetic:** Bauhaus-inspired rectilinear grid, dark studio theme (`#14161e`), JetBrains Mono for data/metadata, Plus Jakarta Sans for UI.
- **Target OS:** Windows 11 (desktop workflow, PWA & future Tauri/native packaging) and modern Chromium browsers.
- **Portfolio Goal:** Clean, modular, well-documented, enterprise-grade codebase ready for public GitHub portfolio showcase.

---

## 2. Tech Stack & Architecture

- **Framework:** React 19 + TypeScript (strict mode)
- **Bundler:** Vite 8 (`@vitejs/plugin-react`, `@tailwindcss/vite`)
- **Styling:** Tailwind CSS v4 (dark mode first, zero clutter)
- **Icons:** `lucide-react`
- **Animations:** `motion` (Framer Motion v12)
- **Local Storage & Persistence:** IndexedDB (`AeroBridge_Studio_DB`), Web File System Access API (`showDirectoryPicker`)
- **Media Processing:** 
  - `jszip` for client-side batch export bundles
  - HTML5 Canvas for format conversion (JPEG/PNG/WebP), downsampling, and watermark overlay
  - Custom PSD thumbnail parser (`src/utils/adobeThumbnailExtractor.ts`)
  - Video HTML5 canvas frame grabber
- **Philosophy:** 100% offline, local-first, zero cloud dependencies, zero telemetry, maximum privacy.

---

## 3. Quick Reference Commands

```bash
# Run local development server (port 3000, 0.0.0.0)
npm run dev

# Type check / Lint
npm run lint

# Production build
npm run build

# Preview build locally
npm run preview
```

> **Note on Windows Shell:** Commands run in PowerShell or Windows Terminal. Use standard Windows path conventions or forward slashes.

---

## 4. Work Division: Antigravity vs. Claude Code Pro

The developer uses **both** Antigravity (primary chat & GUI IDE) and **Claude Code Pro** (CLI terminal). Use this matrix to recommend the best tool for the job:

| Task Type | Best Tool | Why |
|---|---|---|
| **Visual UI design, layout tweaks, CSS polish** | **Antigravity** | Has live browser subagent, direct visual inspection, and rich preview. |
| **Full component architecture & user flows** | **Antigravity** | High-level interactive planning, visual diffs, and context awareness. |
| **Fast CLI commands, npm package updates** | **Claude Code** | Instant terminal execution, direct interactive shell feedback. |
| **Deep single-file refactoring & regex work** | **Claude Code** | Token-efficient, rapid iterative terminal loop. |
| **Git hygiene, commit squash, branch management** | **Claude Code** | Full terminal git control, interactive git workflows. |
| **Security audit & vulnerability scans** | **Antigravity / Claude Code** | Antigravity verifies architecture; Claude Code executes `npm audit` / script scanners. |

> 💡 **Guideline:** Whenever a task is primarily terminal-bound (e.g. git operations, quick CLI script execution, testing edge cases via Node scripts), prompt the user: *"Tento task je ideální spustit přes Claude Code v terminálu."*

---

## 5. Security Principles & Zero-Backdoor Policy

AeroBridge processes user creative files, system paths, and media buffers. Security must be strictly maintained:

1. **No Secret Leaks:**
   - NEVER commit `.env`, `.env.local`, or any hardcoded API keys.
   - Any API key (e.g. `GEMINI_API_KEY`) must only be read from environment variables or user input stored securely.
2. **Safe File System Access:**
   - Only access directories explicitly granted by the user via `showDirectoryPicker()`.
   - Never perform destructive operations (delete, overwrite) without explicit confirmation modals.
3. **Prevent Path Traversal & Sanitization:**
   - When batch renaming or generating ZIP exports, sanitize filenames (strip `../`, `..\\`, illegal Windows characters: `< > : " / \ | ? *`).
4. **Memory Management (Prevent Memory Leaks):**
   - Object URLs (`URL.createObjectURL`) must always be revoked via `URL.revokeObjectURL()` when thumbnails or exports are no longer needed.
5. **Safe Rendering & XSS Prevention:**
   - All IPTC metadata, file names, and camera EXIF strings must be safely escaped (never use `dangerouslySetInnerHTML` with unsanitized file metadata).
6. **No External Backdoors:**
   - Zero telemetry to untrusted third parties.
   - Keep network calls strictly limited to explicit user actions (e.g. Gemini AI metadata enhancement if toggled on).

---

## 6. Project "Do's and Don'ts" (Learned from Development)

### DO:
- ✅ **Keep offline-first:** The application must work 100% offline without internet connection for standard browsing, sorting, batch renaming, and ZIP exports.
- ✅ **Preserve non-blocking UI:** Large file scans or thumbnail generations must be asynchronous or chunked to prevent UI freezes.
- ✅ **Respect Bauhaus Aesthetics:** Clean rectilinear panels, high contrast, subtle borders (`border-white/10`), crisp typography (`font-mono` for data, `font-sans` for labels).
- ✅ **Maintain documentation:** Update `CHANGELOG.md` and `ROADMAP.md` when introducing significant features.
- ✅ **Validate directory permissions:** Always verify directory handle permission using `verifyDirectoryPermission()` before attempting re-scans in IndexedDB.

### DON'T:
- ❌ **Don't hardcode absolute local paths:** Use relative virtual paths or user-selected handles.
- ❌ **Don't use Tailwind utility overload without purpose:** Stick to the established color tokens (`bg-[#14161e]`, `bg-[#1a1d27]`, `border-white/10`).
- ❌ **Don't block the main thread with heavy image resizing:** Process exports sequentially or with yields (`await new Promise(r => setTimeout(r, 0))`).
- ❌ **Don't assume `window.showDirectoryPicker` is available everywhere:** Keep fallback to standard `<input type="file" webkitdirectory />` or Drag & Drop.

---

## 7. Project Structure

```
MediaBridgeBrowser/
├── src/
│   ├── components/         # Modular UI components
│   │   ├── TopBar.tsx              # View switchers, search, batch triggers, sort
│   │   ├── Sidebar.tsx             # Folder tree, favorites, saved local disks
│   │   ├── AssetGrid.tsx           # Grid thumbnail view
│   │   ├── FilmstripView.tsx       # Bottom filmstrip + top hero preview
│   │   ├── CompareView.tsx         # Side-by-side asset comparison
│   │   ├── MetadataTableView.tsx   # Detailed tabular spreadsheet view
│   │   ├── PreviewInspector.tsx    # Right inspection panel (EXIF, IPTC, histogram)
│   │   ├── QuickLookModal.tsx      # Spacebar instant zoom modal
│   │   ├── BatchRenameModal.tsx    # Multi-file batch rename tool
│   │   ├── BatchExportModal.tsx    # Format conversion & ZIP export modal
│   │   ├── BatchIptcModal.tsx      # Batch IPTC metadata editor
│   │   ├── ThumbnailCard.tsx       # Single asset tile with selection states
│   │   ├── Toast.tsx               # Non-intrusive alert toasts
│   │   └── ZoomableCanvas.tsx      # High-performance pan & zoom canvas
│   ├── utils/
│   │   ├── adobeThumbnailExtractor.ts  # PSD header parser, video thumb grabber
│   │   ├── indexedDbStorage.ts         # Persistent DB for handles, assets & sessions
│   │   └── localFileSystem.ts          # File system access, clipboard, ZIP bundling
│   ├── data/
│   │   └── mockAssets.ts          # Demo creative assets for first launch
│   ├── types.ts                   # Core TypeScript interfaces (AssetItem, EXIF, IPTC)
│   ├── App.tsx                    # Main state orchestrator
│   ├── main.tsx                   # React root mount
│   └── index.css                  # Tailwind styles and custom scrollbars
├── public/
│   ├── manifest.json              # PWA manifest (Windows installable)
│   ├── sw.js                      # Offline service worker
│   └── icon.svg                   # Bauhaus vector app icon
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md
├── ROADMAP.md
└── CLAUDE.md
```

---

## 8. Windows 11 Desktop Evolution Path

1. **Phase 1 (Current):** Enhanced PWA with native File System Access API & persistent IndexedDB handles.
2. **Phase 2 (Desktop Wrapper):** Tauri v2 or Electron wrapper for Windows 11:
   - System tray integration
   - Right-click "Open in AeroBridge" in Windows File Explorer
   - Direct local disk file operations without browser sandbox prompts
   - Local RAW file preview decoding (CR2, NEF, ARW) via native libraw
