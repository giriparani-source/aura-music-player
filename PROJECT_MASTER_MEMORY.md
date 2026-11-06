# 🧭 AURA MUSIC PLAYER - MASTER PROJECT MEMORY & STATE SNAPSHOT

**Project Name:** Aura Music Player (Pure Cloud Streaming Music Ecosystem)  
**Version:** 1.4.0 (Continuous Background Playback & Android Telephony Audio Focus Edition)  
**Type:** Cross-Platform React 19 + Capacitor 8.5 Android & Web Application  
**Primary Path:** `d:\Antigravity Projects\music player`  
**Last Checkpoint:** 2026-11-06 IST (Screen-Off Continuous Progression, Phone Call Audio Focus Management, 675 Green Tests)  
**Active Phase:** Phase 6 - Production Release, Multi-Section Queue Mobility & Mobile Packaging  

---

## 🛑 TIER 1: REGRESSION SHIELD (DO NOT TOUCH / LOCKED WORKING LOGIC)
> *The AI agent MUST NOT refactor, rename, or break any of the following verified working components without explicit user permission:*

1. **Audio Player Engine & State (`src/store/usePlayerStore.ts` & `src/services/audioService.ts`):**
   - High-fidelity streaming playback, dynamic queue management, continuous loop/shuffle algorithms, and ExoPlayer native bridge are locked and verified green (666 tests passing across 47 suites).
2. **Spotify Queue Engine (`src/components/player/QueueSheet.tsx` & `src/components/common/QueueToast.tsx`):**
   - 3-section bottom sheet modal (Currently Playing with live animated equalizer, Next in Queue with green badges, and Next from Playlist / Shuffling from).
   - Cross-section and within-section drag-and-drop reordering for all upcoming tracks via `@hello-pangea/dnd`.
   - Right-swipe gesture on song rows (`SongRow.tsx`) revealing Spotify-green `#1ed760` `ListPlus` badge with haptic feedback.
   - Non-interrupting Clear Queue confirmation dialog at `z-[80]`.
3. **Real-time Music Jam Room (`src/store/useJamStore.ts` & `src/components/jam/*`):**
   - PeerJS WebRTC peer-to-peer room syncing, live audio coordination, and collaborative listening sessions with real-time emoji reactions.
4. **Capacitor Mobile Native Bridge (`@capacitor/android`, `android/*`):**
   - Native Android Media3 ExoPlayer foreground audio service (`AuraAudioService.java`), lockscreen MediaSession controls, and automated APK build pipeline (`build-apk.ps1`). Zero storage permissions requested.
5. **Universal Playlist Importer (`src/services/universalPlaylistImporter.ts`):**
   - Invidious YouTube extraction, Spotify web parser, 16-song pagination normalization, zero fake song policy for unavailable tracks, and JioSaavn 320k matching.
6. **Pure Cloud Streaming Model (`src/store/useLibraryStore.ts` & `src/services/scannerService.ts`):**
   - Strictly cloud tracks, playlists, favorites, and offline cached audio. Local device storage scanning, directory pickers, and local file playback are permanently purged from application logic, store, and UI/UX.
7. **Stitch Spotify Nocturne Design System (`src/index.css`, layout, player, views):**
   - Nocturne color palette (`#0A0910` base canvas, `#14121a` surface, `#9d4edd` primary violet, `#00f1fd` secondary cyan), glowing interactive Scrubber, floating frosted glass mini-player, and expandable full-screen Now Playing hero.

---

## 🏛️ TIER 2: ARCHITECTURE & TECHNOLOGY STACK

- **Core Framework:** React 19.2 + Vite 8.3 + TypeScript (Node 24)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`) + Lucide React Icons
- **Drag & Drop:** `@hello-pangea/dnd` multi-droppable with touch and pointer support
- **Design Reference:** Stitch "Spotify Dark Mobile Home UI" + Spotify UX Parity
- **Theme Palette (Nocturne):**
  - Base Canvas: `#0A0910`
  - Surfaces: `#12101B` (Sidebar), `#14121A` (Dock/Surface 1), `#1C1B22` (Surface 2), `#242036` (Surface 3), `#2E2942` (Surface 4)
  - Primaries & Accents: `#9D4EDD` / `#e0b6ff` (Violet glow), `#00F2FE` / `#00f1fd` (Cyan electric glow), `#1ed760` (Spotify Green Queue accent)
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
  - `src/components/player/` -> BottomPlayer, NowPlayingModal, QueueSheet, QueueDrawer, AudioEffectsModal, LyricsView.
  - `src/components/views/` -> HomeView, SearchView, LibraryView, PlaylistsView, RadioView, SettingsView.
  - `src/components/layout/` -> MobileBottomNav, Sidebar, Header, MainLayout.
  - `src/components/common/` -> SongRow, QueueToast, Artwork, VirtualSongList.
  - `src/components/jam/` -> Real-time group listening / Jam rooms via PeerJS.
  - `src/store/` -> Domain-separated Zustand state stores.
  - `src/services/` -> JioSaavn resolver, YouTube stream failovers, database, audio effects, Aura Flow engine.
  - `server/` -> Express cloud streaming proxy, R2/S3 range audio streaming.

---

## 🚦 TIER 3: FEATURE MATRIX & EXECUTION STATUS

| Feature Module | Status | Primary Files | Key Details |
| :--- | :---: | :--- | :--- |
| **Spotify Queue Experience** | ✅ DONE | `QueueSheet.tsx`, `usePlayerStore.ts` | 3-section bottom sheet, Currently Playing live equalizer, Next in Queue badges |
| **Cross-Section Drag-and-Drop** | ✅ DONE | `QueueSheet.tsx`, `usePlayerStore.ts` | Drag ALL upcoming songs within/between sections; Currently Playing remains fixed |
| **Song Right-Swipe to Queue** | ✅ DONE | `SongRow.tsx`, `QueueToast.tsx` | Direction-locked swipe right revealing green `#1ed760` badge + floating toast pill |
| **Non-Interrupting Clear Queue** | ✅ DONE | `QueueSheet.tsx`, `usePlayerStore.ts` | Safe confirmation dialog at `z-[80]`; clears upcoming items without stopping active audio |
| **Pure Cloud Streaming Core** | ✅ DONE | `src/services/audioService.ts` | 100% cloud streaming (JioSaavn 320k + YouTube failover + R2/S3) |
| **Local File Scanning / Storage** | ❌ PURGED | N/A | Permanently purged from UI, permissions, store, and server by user directive |
| **AI DJ Studio & Assistant** | ❌ PURGED | N/A | Completely removed from app, store, types, API, and server (Zero AI directive) |
| **Android Zero-Storage Permissions** | ✅ DONE | `AndroidManifest.xml`, `MainActivity.java` | `READ_MEDIA_AUDIO` and `READ_EXTERNAL_STORAGE` removed; zero storage prompts on boot |
| **Stitch Spotify Home Screen** | ✅ DONE | `src/components/views/HomeView.tsx` | Contextual greeting, 6-pack quick access sessions grid, curated carousels, artist portraits |
| **Spotify Search & Discovery** | ✅ DONE | `src/components/views/SearchView.tsx` | Elevated pill search bar, filter pills, recent searches with 1-click removal, Bento vibes |
| **Spotify Library Hub** | ✅ DONE | `src/components/views/LibraryView.tsx` | Pinned Collections hub (Liked Songs, Downloaded Cache, Recently Played), subtabs, sort |
| **Expandable Now Playing Hero** | ✅ DONE | `src/components/player/NowPlayingModal.tsx` | Ambient radial gradient, vinyl sheen artwork, 320k badge, cyan scrubber, 72x72 kinetic trigger |
| **Floating Mini Player Dock** | ✅ DONE | `src/components/player/BottomPlayer.tsx` | Frosted glass dock, bottom gradient progress bar, vinyl sheen, kinetic play trigger, queue button |
| **Persistent Bottom Navigation** | ✅ DONE | `src/components/layout/MobileBottomNav.tsx` | 64dp frosted dock with Home, Search, Library, Radio, Settings, active violet glow |
| **Desktop Studio Sidebar & Header** | ✅ DONE | `src/components/layout/Sidebar.tsx`, `Header.tsx` | Nocturne desktop sidebar (`bg-[#12101b]/95`), 320k badge, active gradient pills |
| **Screen-Off Background Playback** | ✅ DONE | `android/.../AuraAudioService.java` | Native Android Media3 ExoPlayer with lockscreen notification & controls |
| **Universal Playlist Importer** | ✅ DONE | `src/services/universalPlaylistImporter.ts` | Spotify & YouTube playlist import with 320k auto-matching |
| **24/7 Live Radio FM** | ✅ DONE | `src/services/radioService.ts` | Real-time live Tamil and regional radio broadcast stations |
| **P2P Social Jam Rooms** | ✅ DONE | `src/components/jam/` | PeerJS room creation, sync, and emoji reactions |
| **Android APK Build Pipeline** | ✅ DONE | `package.json`, `build-apk.ps1` | `npm run apk:build` -> generates `AuraMusic-latest.apk` & `AuraMusic-v1.0.apk` |
| **Vercel Web Production Deployment**| ✅ DONE | `main` branch | Live at `https://aura-music-player-omega.vercel.app/` (Zero AI, Pure Cloud) |

---

## 🧠 KEY ARCHITECTURAL DECISIONS & RESOLVED GOTCHAS

- **Decision 001 (Zustand over Context):** Used modular Zustand stores to prevent full-tree re-renders during high-frequency audio `timeupdate` events.
- **Decision 002 (Capacitor over React Native):** Chose Vite + Capacitor for 100% shared web and mobile codebase with instant hot-reload and native ExoPlayer bridge.
- **Decision 003 (Pure Cloud Streaming Paradigm Shift):** Permanently eliminated local device audio files from the app.
- **Decision 004 (Stitch "Nocturne" Spotify Design Tokens):** Configured `@theme` with canvas base `#0A0910`, layered frosted glass surfaces, and primary violet glow (`#9D4EDD`) + cyan electric highlights (`#00f1fd`) + Spotify green (`#1ed760`).
- **Decision 005 (Spotify Usability Parity):** Persistent floating mini-player seamlessly expands to full Now Playing modal on touch or click.
- **Decision 006 (Zero-AI Architectural Purge):** App is 100% deterministic, instant-loading, and zero-cost/zero-latency from external AI endpoints.
- **Decision 007 (Android Zero-Permission Architecture):** Zero storage permission popups on boot. Only `POST_NOTIFICATIONS` requested on Android 13+ for lockscreen media controls.
- **Decision 008 (Spotify Queue Experience & Cross-Section DnD):**
  - Implemented dual-queue architecture (`userQueue: QueuedSong[]` + context queue `queue: Song[]`).
  - Right-swipe gesture on song rows with 6px direction locking and 75px threshold with haptic feedback.
  - Floating `QueueToast` pill mounted at `z-[65]` with direct `[Open]` button.
  - `@hello-pangea/dnd` multi-droppable architecture enabling reordering across ALL upcoming songs within and between sections.
  - Currently Playing song stays strictly stationary at the top with live 3-bar animated equalizer and inline play/pause.
  - Safe confirmation dialog at `z-[80]` for clearing user queue without interrupting active playback.
- **Decision 009 (Android Telephony Audio Focus & Battery Optimization):**
  - Integrated modern `AudioFocusRequest` (API 26+) + `AudioManager.OnAudioFocusChangeListener` in `AuraAudioService.java`.
  - Transient focus loss (`AUDIOFOCUS_LOSS_TRANSIENT`) records exact timestamp `savedPositionBeforeCall` and pauses ExoPlayer.
  - Releases CPU WakeLock and Wi-Fi lock during calls to eliminate background battery drain while telephony modem keeps device active; re-acquires immediately upon `AUDIOFOCUS_GAIN`.
  - Upon `AUDIOFOCUS_GAIN`, re-prepares media source if connection dropped during long call (1+ hour), and seeks directly to `savedPositionBeforeCall`.
  - Dual guards in `STATE_ENDED` protect against socket timeouts being mistaken for song completion, preventing accidental track skipping.
  - Manual pause protection: if user pauses before or during a call, auto-resume is inhibited.
- **Gotcha 001 (Audio Backgrounding):** Background audio on Android requires native ExoPlayer foreground service with `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.
- **Gotcha 002 (Zero Fake Songs on Import):** Unavailable or deleted YouTube tracks must have `status: 'unavailable'` and `songId: null`.
- **Gotcha 003 (Search Bar Dual-Sync):** Main header search bar and view-level search inputs synchronize bidirectionally via `searchQuery` state in `useLibraryStore`.
- **Gotcha 004 (Vercel Deployment Branch Coupling):** Vercel's production environment is tied to `origin/main`. Changes committed to `web-player` must be merged into `main` and pushed to `origin main` to update `https://aura-music-player-omega.vercel.app/`.
- **Gotcha 005 (Windows CRLF vs LF Normalization):** PowerShell and Git on Windows may insert CRLF line endings.
- **Gotcha 006 (DnD Shuffle Index Safety):** When cross-dropping tracks in shuffle mode, tracks are appended to `queue` and spliced into `shuffledQueueOrder`, preserving exact 1-to-1 array permutations and preventing pointer drift.
- **Gotcha 007 (Long Phone Call HTTP Socket Drop):** ExoPlayer streaming over HTTP/CDN drops socket during 30m-1h calls; `resumePlaybackAfterCall()` checks player state and re-prepares media item instead of crashing or skipping.

---

## 🧪 VERIFICATION & TEST RESULTS (v1.4.0 Release)

- **Vitest Unit & Integration Tests:** 48 test suites, **675 tests passed (100% green)**.
- **Oxlint Static Code Analysis:** **0 errors** across all project files.
- **TypeScript Typecheck & Vite Production Build:** Succeeded with zero errors (`tsc -b && vite build`).
- **Targeted Telephony Suite:** `src/services/__tests__/phoneCallAudioHandling.test.ts` (9/9 passed).
- **Vercel Production Deployment:** Live at [https://aura-music-player-omega.vercel.app/](https://aura-music-player-omega.vercel.app/).
- **Android APK Build:** `AuraMusic-latest.apk` & `AuraMusic-v1.0.apk` (zero storage permissions, background ExoPlayer playback verified).
