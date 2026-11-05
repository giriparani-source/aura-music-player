# 🧭 AURA MUSIC PLAYER - MASTER PROJECT MEMORY & STATE SNAPSHOT

**Project Name:** Aura Music Player (Pure Cloud Streaming Music Ecosystem)  
**Version:** 1.2.5 (Stitch Nocturne Spotify Edition) | **Type:** Cross-Platform React 19 + Capacitor 8.5 Android & Web App  
**Primary Path:** D:\Projects\music player  
**Last Checkpoint:** 2026-10-29 IST  
**Active Phase:** Phase 4 - Spotify-Grade Nocturne UI/UX Implementation & Pure Cloud Hardening  

---

## 🛑 TIER 1: REGRESSION SHIELD (DO NOT TOUCH / LOCKED WORKING LOGIC)
> *The AI agent MUST NOT refactor, rename, or break any of the following verified working components without explicit user permission:*

1. **Audio Player Engine & State (src/store/usePlayerStore.ts & src/services/audioService.ts):**
   - High-fidelity streaming playback, queue management, loop/shuffle algorithms, and ExoPlayer native bridge are locked and verified green (482 tests passing).
2. **Real-time Music Jam Room (src/store/useJamStore.ts & src/components/jam/*):**
   - PeerJS WebRTC peer-to-peer room syncing, live audio coordination, and collaborative listening sessions.
3. **Capacitor Mobile Native Bridge (@capacitor/android, android/*):**
   - Android native configuration, foreground audio service (`AuraAudioService.java`), MediaSession controls, and APK build scripts (`npm run apk:build`, `build-apk.ps1`).
4. **Universal Playlist Importer (src/services/universalPlaylistImporter.ts):**
   - Invidious YouTube extraction, 16-song pagination normalization, zero fake song policy for unavailable tracks, and JioSaavn 320k matching.
5. **Pure Cloud Streaming Model (src/store/useLibraryStore.ts):**
   - Strictly cloud tracks, playlists, favorites, and offline cached audio. Local device storage scanning and local folder imports are completely removed from app logic and UI/UX.
6. **Stitch Spotify Nocturne Design System (src/index.css, layout, player, views):**
   - Nocturne color palette (`#0A0910` base canvas, `#14121a` surface, `#9d4edd` primary violet, `#00f1fd` secondary cyan), glowing interactive Scrubber, floating frosted glass mini-player, and expandable full-screen Now Playing hero.

---

## 🏛️ TIER 2: ARCHITECTURE & TECHNOLOGY STACK

- **Core Framework:** React 19.2 + Vite 8.3 + TypeScript (Node 24)
- **Styling:** Tailwind CSS v4 (@tailwindcss/vite) + Lucide React Icons
- **Design Reference:** Stitch "Spotify Dark Mobile Home UI" + Spotify UX Parity
- **Theme Palette (Nocturne):**
  - Base Canvas: `#0A0910`
  - Surfaces: `#12101B` (Sidebar), `#14121A` (Dock/Surface 1), `#1C1B22` (Surface 2), `#242036` (Surface 3), `#2E2942` (Surface 4)
  - Primaries & Accents: `#9D4EDD` / `#e0b6ff` (Violet glow), `#00F2FE` / `#00f1fd` (Cyan electric glow)
- **State Architecture:** Zustand v5 (Domain stores: Player, Library, Jam, Profile)
- **Mobile Runtime:** Capacitor 8.5 (Android ExoPlayer Media3 background audio service)
- **Audio Streaming Engines:**
  1. *Tier 1 Primary:* JioSaavn 320kbps Lossless AAC Direct Stream CDN
  2. *Tier 2 Fallback:* YouTube Music Direct Audio Stream via native ExoPlayer / yt-dlp backend
  3. *Tier 3 Broadcast:* 24/7 Live Web Radio FM Stations
- **Key Directory Map:**
  - `src/components/player/` -> BottomPlayer, NowPlayingModal, QueueDrawer, AudioEffectsModal.
  - `src/components/views/` -> HomeView, SearchView, LibraryView, PlaylistsView, RadioView, SettingsView.
  - `src/components/layout/` -> MobileBottomNav, Sidebar, Header, MainLayout.
  - `src/components/jam/` -> Real-time group listening / Jam rooms via PeerJS.
  - `src/store/` -> Domain-separated Zustand state stores.
  - `src/services/` -> JioSaavn resolver, YouTube stream failovers, database, audio effects, Aura Flow engine.

---

## 🚦 TIER 3: FEATURE MATRIX & EXECUTION STATUS

| Feature Module | Status | Primary Files | Key Details |
| :--- | :---: | :--- | :--- |
| **Pure Cloud Streaming Core** | ✅ DONE | `src/services/audioService.ts` | 100% cloud streaming (JioSaavn 320k + YouTube failover) |
| **Local File Scanning / Storage** | ❌ PURGED | N/A | Permanently removed from UI, permissions, store, and server by user directive |
| **Stitch Spotify Home Screen** | ✅ DONE | `src/components/views/HomeView.tsx` | Contextual greeting, 6-pack quick access sessions grid, curated carousels, circular artist portraits, live radio |
| **Spotify Search & Discovery** | ✅ DONE | `src/components/views/SearchView.tsx` | Elevated pill search bar, filter pills (All, JioSaavn 320k, Live Radio), recent searches flow chips with 1-click removal, Bento vibe & genre grid |
| **Spotify Library Hub** | ✅ DONE | `src/components/views/LibraryView.tsx` | Pinned Collections hub (Liked Songs, Downloaded Cache, Recently Played), subtab pills, search & sort toolbar, grid/list toggles |
| **Expandable Now Playing Hero** | ✅ DONE | `src/components/player/NowPlayingModal.tsx` | High-performance ambient radial gradient, vinyl sheen artwork, Hi-Res 320k badge, cyan scrubber thumb, 72x72 kinetic hero play trigger |
| **Floating Mini Player Dock** | ✅ DONE | `src/components/player/BottomPlayer.tsx` | Floating frosted glass dock (`rounded-2xl`, 2.5dp bottom gradient progress bar `from-[#00f1fd] via-[#9d4edd] to-[#e0b6ff]`, vinyl sheen, kinetic play) |
| **Persistent Bottom Navigation** | ✅ DONE | `src/components/layout/MobileBottomNav.tsx` | 64dp frosted dock with Home, Search, Library, Radio, Settings, active violet glow, 48dp touch targets |
| **Desktop Studio Sidebar & Header** | ✅ DONE | `src/components/layout/Sidebar.tsx`, `Header.tsx` | Nocturne desktop sidebar (`bg-[#12101b]/95`), 320k brand badge, active gradient nav pills, frosted top bar (`bg-[#14121a]/80`) |
| **Screen-Off Background Playback** | ✅ DONE | `android/.../AuraAudioService.java` | Native Android Media3 ExoPlayer with lockscreen notification |
| **Universal Playlist Importer** | ✅ DONE | `src/services/universalPlaylistImporter.ts` | Spotify & YouTube playlist import with 320k auto-matching |
| **24/7 Live Radio FM** | ✅ DONE | `src/services/radioService.ts` | Real-time live Tamil and regional radio broadcast stations |
| **P2P Social Jam Rooms** | ✅ DONE | `src/components/jam/` | PeerJS room creation, sync, and emoji reactions |
| **AI DJ Studio & Assistant** | ❌ PURGED | N/A | Completely removed from app, store, types, and server (Zero AI directive) |
| **Android APK Build Pipeline** | ✅ DONE | `package.json`, `build-apk.ps1` | `npm run apk:build` -> generates `AuraMusic-latest.apk` (11.6 MB) |

---

## 🧠 KEY ARCHITECTURAL DECISIONS & RESOLVED GOTCHAS

- **Decision 001 (Zustand over Context):** Used modular Zustand stores to prevent full-tree re-renders during high-frequency audio `timeupdate` events.
- **Decision 002 (Capacitor over React Native):** Chose Vite + Capacitor for 100% shared web and mobile codebase with instant hot-reload and native ExoPlayer bridge.
- **Decision 003 (Pure Cloud Streaming Paradigm Shift):** 
  - User explicitly ordered the elimination of local device audio files from the app.
  - Removed local device music hub, local duplicates detection modal, music folder scanner, and local files search tab.
  - The UI and UX now exclusively reflect cloud streaming tracks, playlists, radio, and offline downloaded caches.
- **Decision 004 (Stitch "Nocturne" Spotify Design Tokens Alignment):**
  - Configured `@theme` in `src/index.css` with canvas base `#0A0910`, layered frosted glass surfaces (`#12101b`, `#14121a`, `#1c1b22`, `#242036`), and primary violet glow (`#9D4EDD`) + cyan electric highlights (`#00f1fd`).
  - Added vinyl sheen reflective highlights, dynamic ambient backdrop illumination for the Now Playing screen, and kinetic bouncy touch triggers.
- **Decision 005 (Spotify Usability Parity):**
  - Persistent floating mini-player seamlessly expands to full Now Playing modal on touch or click.
  - Interactive scrubber with continuous time scrubbing and glow thumb.
  - 6-pack quick access sessions grid with live animated equalizer bar indicator on the currently playing card.
  - Bento-style discovery cards in Search with vivid gradients and rotated album art mockups.
- **Gotcha 001 (Audio Backgrounding):** Background audio on Android requires native ExoPlayer foreground service with `FOREGROUND_SERVICE_MEDIA_PLAYBACK` to avoid pause on app minimize or screen off.
- **Gotcha 002 (Zero Fake Songs on Import):** Unavailable or deleted YouTube tracks must have `status: 'unavailable'` and `songId: null` to avoid creating phantom broken records in user playlists.
- **Gotcha 003 (Search Bar Dual-Sync):** Main header search bar and view-level search inputs synchronize bidirectionally via `searchQuery` state in `useLibraryStore` to prevent state decoupling.

---

## 🧪 VERIFICATION & TEST RESULTS (2026-10-29)

- **Vitest Unit & Integration Tests:** 37 test suites, 482 tests passed (100% green).
- **Oxlint Static Code Analysis:** 0 errors across 525 project files.
- **TypeScript Typecheck & Vite Production Build:** Succeeded with zero errors (`tsc -b && vite build` in 3.29s).
