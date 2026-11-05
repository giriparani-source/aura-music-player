# 🧭 AURA MUSIC PLAYER - MASTER PROJECT MEMORY & STATE SNAPSHOT

**Project Name:** Aura Music Player (Pure Cloud Streaming Music Ecosystem)  
**Version:** 1.2.6 (Stitch Nocturne Spotify Edition - Pure Cloud Release)  
**Type:** Cross-Platform React 19 + Capacitor 8.5 Android & Web Application  
**Primary Path:** `d:\Antigravity Projects\music player`  
**Last Checkpoint:** 2026-11-05 IST (Zero AI Purge, Pure Cloud Hardening, Android Zero-Storage & Vercel Production Deploy)  
**Active Phase:** Phase 5 - Pure Cloud Stability, Low-Budget Device Optimization & Production Deployment  

---

## 🛑 TIER 1: REGRESSION SHIELD (DO NOT TOUCH / LOCKED WORKING LOGIC)
> *The AI agent MUST NOT refactor, rename, or break any of the following verified working components without explicit user permission:*

1. **Audio Player Engine & State (`src/store/usePlayerStore.ts` & `src/services/audioService.ts`):**
   - High-fidelity streaming playback, dynamic queue management, continuous loop/shuffle algorithms, and ExoPlayer native bridge are locked and verified green (463 tests passing across 36 suites).
2. **Real-time Music Jam Room (`src/store/useJamStore.ts` & `src/components/jam/*`):**
   - PeerJS WebRTC peer-to-peer room syncing, live audio coordination, and collaborative listening sessions with real-time emoji reactions.
3. **Capacitor Mobile Native Bridge (`@capacitor/android`, `android/*`):**
   - Native Android Media3 ExoPlayer foreground audio service (`AuraAudioService.java`), lockscreen MediaSession controls, and automated APK build pipeline (`build-apk.ps1`). Zero storage permissions requested.
4. **Universal Playlist Importer (`src/services/universalPlaylistImporter.ts`):**
   - Invidious YouTube extraction, Spotify web parser, 16-song pagination normalization, zero fake song policy for unavailable tracks, and JioSaavn 320k matching.
5. **Pure Cloud Streaming Model (`src/store/useLibraryStore.ts` & `src/services/scannerService.ts`):**
   - Strictly cloud tracks, playlists, favorites, and offline cached audio. Local device storage scanning, directory pickers, and local file playback are permanently purged from application logic, store, and UI/UX.
6. **Stitch Spotify Nocturne Design System (`src/index.css`, layout, player, views):**
   - Nocturne color palette (`#0A0910` base canvas, `#14121a` surface, `#9d4edd` primary violet, `#00f1fd` secondary cyan), glowing interactive Scrubber, floating frosted glass mini-player, and expandable full-screen Now Playing hero.

---

## 🏛️ TIER 2: ARCHITECTURE & TECHNOLOGY STACK

- **Core Framework:** React 19.2 + Vite 8.3 + TypeScript (Node 24)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`) + Lucide React Icons
- **Design Reference:** Stitch "Spotify Dark Mobile Home UI" + Spotify UX Parity
- **Theme Palette (Nocturne):**
  - Base Canvas: `#0A0910`
  - Surfaces: `#12101B` (Sidebar), `#14121A` (Dock/Surface 1), `#1C1B22` (Surface 2), `#242036` (Surface 3), `#2E2942` (Surface 4)
  - Primaries & Accents: `#9D4EDD` / `#e0b6ff` (Violet glow), `#00F2FE` / `#00f1fd` (Cyan electric glow)
- **State Architecture:** Zustand v5 (Domain stores: `usePlayerStore`, `useLibraryStore`, `useJamStore`, `useProfileStore`)
- **Mobile Runtime:** Capacitor 8.5 with Android Media3 / ExoPlayer foreground audio service
- **Audio Streaming Engines:**
  1. *Tier 1 Primary:* JioSaavn 320kbps Lossless AAC Direct Stream CDN
  2. *Tier 2 Fallback:* YouTube Music Direct Audio Stream via native ExoPlayer / yt-dlp backend
  3. *Tier 3 Cloud Storage:* Cloudflare R2 / AWS S3 range streaming with HTTP 206 Partial Content support (`/api/audio`)
  4. *Tier 4 Broadcast:* 24/7 Live Web Radio FM Stations
- **Git & CI/CD Deployment Architecture:**
  - **Remote Repository:** `https://github.com/giriparani-source/aura-music-player.git`
  - **Development Branch:** `web-player`
  - **Production Vercel Branch:** `main` (Auto-deploys to https://aura-music-player-omega.vercel.app/)
  - **Safety Backup Branch:** `backup/pre-ai-removal` (preserved at baseline commit `be383bc`)
  - **Safety Tag:** `pre-ai-removal-baseline`
- **Key Directory Map:**
  - `src/components/player/` -> BottomPlayer, NowPlayingModal, QueueDrawer, AudioEffectsModal, LyricsView.
  - `src/components/views/` -> HomeView, SearchView, LibraryView, PlaylistsView, RadioView, SettingsView.
  - `src/components/layout/` -> MobileBottomNav, Sidebar, Header, MainLayout.
  - `src/components/jam/` -> Real-time group listening / Jam rooms via PeerJS.
  - `src/store/` -> Domain-separated Zustand state stores.
  - `src/services/` -> JioSaavn resolver, YouTube stream failovers, database, audio effects, Aura Flow engine.
  - `server/` -> Express cloud streaming proxy, R2/S3 range audio streaming.

---

## 🚦 TIER 3: FEATURE MATRIX & EXECUTION STATUS

| Feature Module | Status | Primary Files | Key Details |
| :--- | :---: | :--- | :--- |
| **Pure Cloud Streaming Core** | ✅ DONE | `src/services/audioService.ts` | 100% cloud streaming (JioSaavn 320k + YouTube failover + R2/S3) |
| **Local File Scanning / Storage** | ❌ PURGED | N/A | Permanently purged from UI, permissions, store, and server by user directive |
| **AI DJ Studio & Assistant** | ❌ PURGED | N/A | Completely removed from app, store, types, API, and server (Zero AI directive) |
| **Android Zero-Storage Permissions** | ✅ DONE | `AndroidManifest.xml`, `MainActivity.java` | `READ_MEDIA_AUDIO` and `READ_EXTERNAL_STORAGE` removed; zero storage prompts on boot |
| **Stitch Spotify Home Screen** | ✅ DONE | `src/components/views/HomeView.tsx` | Contextual greeting, 6-pack quick access sessions grid, curated carousels, artist portraits |
| **Spotify Search & Discovery** | ✅ DONE | `src/components/views/SearchView.tsx` | Elevated pill search bar, filter pills, recent searches with 1-click removal, Bento vibes |
| **Spotify Library Hub** | ✅ DONE | `src/components/views/LibraryView.tsx` | Pinned Collections hub (Liked Songs, Downloaded Cache, Recently Played), subtabs, sort |
| **Expandable Now Playing Hero** | ✅ DONE | `src/components/player/NowPlayingModal.tsx` | Ambient radial gradient, vinyl sheen artwork, 320k badge, cyan scrubber, 72x72 kinetic trigger |
| **Floating Mini Player Dock** | ✅ DONE | `src/components/player/BottomPlayer.tsx` | Frosted glass dock, bottom gradient progress bar, vinyl sheen, kinetic play trigger |
| **Persistent Bottom Navigation** | ✅ DONE | `src/components/layout/MobileBottomNav.tsx` | 64dp frosted dock with Home, Search, Library, Radio, Settings, active violet glow |
| **Desktop Studio Sidebar & Header** | ✅ DONE | `src/components/layout/Sidebar.tsx`, `Header.tsx` | Nocturne desktop sidebar (`bg-[#12101b]/95`), 320k badge, active gradient pills |
| **Screen-Off Background Playback** | ✅ DONE | `android/.../AuraAudioService.java` | Native Android Media3 ExoPlayer with lockscreen notification & controls |
| **Universal Playlist Importer** | ✅ DONE | `src/services/universalPlaylistImporter.ts` | Spotify & YouTube playlist import with 320k auto-matching |
| **24/7 Live Radio FM** | ✅ DONE | `src/services/radioService.ts` | Real-time live Tamil and regional radio broadcast stations |
| **P2P Social Jam Rooms** | ✅ DONE | `src/components/jam/` | PeerJS room creation, sync, and emoji reactions |
| **Android APK Build Pipeline** | ✅ DONE | `package.json`, `build-apk.ps1` | `npm run apk:build` -> generates `AuraMusic-latest.apk` (11.14 MB) |
| **Vercel Web Production Deployment**| ✅ DONE | `main` branch | Live at `https://aura-music-player-omega.vercel.app/` (Zero AI, Pure Cloud) |

---

## 🧠 KEY ARCHITECTURAL DECISIONS & RESOLVED GOTCHAS

- **Decision 001 (Zustand over Context):** Used modular Zustand stores to prevent full-tree re-renders during high-frequency audio `timeupdate` events.
- **Decision 002 (Capacitor over React Native):** Chose Vite + Capacitor for 100% shared web and mobile codebase with instant hot-reload and native ExoPlayer bridge.
- **Decision 003 (Pure Cloud Streaming Paradigm Shift):** 
  - Permanently eliminated local device audio files from the app.
  - Removed local music hub, duplicate detection modal, directory scanner, and metadata ID3 parser.
  - The UI and UX exclusively reflect cloud streaming tracks, playlists, live radio, and offline cached audio.
- **Decision 004 (Stitch "Nocturne" Spotify Design Tokens):**
  - Configured `@theme` in `src/index.css` with canvas base `#0A0910`, layered frosted glass surfaces (`#12101b`, `#14121a`, `#1c1b22`, `#242036`), and primary violet glow (`#9D4EDD`) + cyan electric highlights (`#00f1fd`).
  - Added vinyl sheen reflective highlights, dynamic ambient backdrop illumination for Now Playing, and kinetic touch triggers.
- **Decision 005 (Spotify Usability Parity):**
  - Persistent floating mini-player seamlessly expands to full Now Playing modal on touch or click.
  - Interactive scrubber with continuous time scrubbing and glow thumb.
  - 6-pack quick access sessions grid with live animated equalizer bar indicator on currently playing card.
- **Decision 006 (Zero-AI Architectural Purge):**
  - Completely purged AI DJ Studio (`AiStudioView.tsx`), Aura AI Chat Drawer (`AuraChatDrawer.tsx`), AI Song Insights (`AiSongInsights.tsx`), Gemini AI service (`geminiAiService.ts`), and backend Python/Node AI routes (`server/ai_engine.py`, `server/helpers/aiEngineNative.ts`, `server/middleware/aiRouter.ts`, `api/ai/*`).
  - App is 100% deterministic, instant-loading, and zero-cost/zero-latency from external AI endpoints.
- **Decision 007 (Android Zero-Permission Architecture):**
  - Removed `READ_MEDIA_AUDIO` and `READ_EXTERNAL_STORAGE` from `AndroidManifest.xml` and `MainActivity.java`.
  - App launches without intrusive storage permission popups. Only `POST_NOTIFICATIONS` requested on Android 13+ for lockscreen media controls.
- **Gotcha 001 (Audio Backgrounding):** Background audio on Android requires native ExoPlayer foreground service with `FOREGROUND_SERVICE_MEDIA_PLAYBACK` to avoid pause on app minimize or screen off.
- **Gotcha 002 (Zero Fake Songs on Import):** Unavailable or deleted YouTube tracks must have `status: 'unavailable'` and `songId: null` to avoid creating phantom broken records in user playlists.
- **Gotcha 003 (Search Bar Dual-Sync):** Main header search bar and view-level search inputs synchronize bidirectionally via `searchQuery` state in `useLibraryStore` to prevent state decoupling.
- **Gotcha 004 (Vercel Deployment Branch Coupling):** Vercel's production environment is tied to `origin/main`. Changes committed to `web-player` must be merged into `main` and pushed to `origin main` to update `https://aura-music-player-omega.vercel.app/`.
- **Gotcha 005 (Windows CRLF vs LF Normalization):** PowerShell and Git on Windows may insert CRLF line endings. Code updates should normalize line endings to prevent target mismatch in automated patch scripts.

---

## 🧪 VERIFICATION & TEST RESULTS (2026-11-05 Release)

- **Vitest Unit & Integration Tests:** 36 test suites, **463 tests passed (100% green)**; local scanner and AI tests safely decommissioned.
- **Oxlint Static Code Analysis:** **0 errors** across all project files (287ms scan time).
- **TypeScript Typecheck & Vite Production Build:** Succeeded with zero errors (`tsc -b && vite build` in 1.89s).
- **Vercel Production Deployment:** Live at [https://aura-music-player-omega.vercel.app/](https://aura-music-player-omega.vercel.app/) (Zero AI, Pure Cloud verified via bundle hash `index-DWqqf8es.js`).
- **Android APK Build:** `AuraMusic-latest.apk` (11.14 MB / 11,678,536 bytes, zero storage permissions, background ExoPlayer playback verified).
