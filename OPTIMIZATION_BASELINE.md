# AURA MUSIC PLAYER — OPTIMIZATION BASELINE SNAPSHOT

Recorded At: 2026-09-14T08:15:00+05:30
Environment: Windows 10/11, Node.js, Microsoft Edge Headless, Vite 8.3.0, React 19.2.8, Zustand 5.0.15

---

## 1. Test Suite Baseline (`npm run test`)

- **Command**: `vitest run`
- **Result**: 15 test files passed (100%), 159 tests passed (100%), 0 failed
- **Duration**: 3.88s (transform: 4.37s)
- **Test Suites**:
  1. `src/services/__tests__/auraSkipService.test.ts` (16 tests) — 38ms
  2. `src/services/__tests__/auraAffinityService.test.ts` (12 tests) — 72ms
  3. `src/services/__tests__/auraFlowDiscoveryPacing.test.ts` (23 tests) — 36ms
  4. `src/services/__tests__/downloadService.test.ts` (9 tests) — 213ms
  5. `src/services/__tests__/auraFlowService.test.ts` (15 tests) — 54ms
  6. `src/services/__tests__/manualQaScenarios.test.ts` (11 tests) — 381ms
  7. `src/services/__tests__/auraFlowRuntimeScenarios.test.ts` (10 tests) — 329ms
  8. `src/services/__tests__/sleepTimerService.test.ts` (7 tests) — 58ms
  9. `src/utils/__tests__/lyricsParser.test.ts` (18 tests) — 33ms
  10. `src/services/__tests__/auraFlowAffinityScoring.test.ts` (6 tests) — 35ms
  11. `src/services/__tests__/duplicateService.test.ts` (4 tests) — 18ms
  12. `src/utils/__tests__/fairShuffle.test.ts` (6 tests) — 20ms
  13. `src/utils/__tests__/formatters.test.ts` (6 tests) — 38ms
  14. `src/services/__tests__/audioEffectsService.test.ts` (10 tests) — 24ms
  15. `src/utils/__tests__/fuzzySearch.test.ts` (6 tests) — 19ms

---

## 2. Production Build Baseline (`npm run build`)

- **Command**: `tsc -b && vite build`
- **Result**: Success (0 TypeScript errors, 1,942 modules transformed)
- **Build Duration**: 3.00s
- **Bundle Metrics**:
  - `dist/index.html`: 3.25 kB │ gzip: 1.47 kB
  - `dist/assets/index-DgdZMAIP.css`: 148.08 kB │ gzip: 17.38 kB
  - `dist/assets/index-CRysWbRw.js`: 449.98 kB │ gzip: 134.09 kB
  - `dist/assets/NowPlayingModal-CmcXf3ms.js`: 80.36 kB │ gzip: 20.13 kB
  - `dist/assets/jsx-runtime-CtOaj4K3.js`: 54.33 kB │ gzip: 17.91 kB
  - `dist/assets/HomeView-BKzogTk7.js`: 38.66 kB │ gzip: 9.30 kB
  - `dist/assets/LibraryView-wiobWA3p.js`: 31.26 kB │ gzip: 7.18 kB
  - `dist/assets/SearchView-Cgp5Pbo-.js`: 24.71 kB │ gzip: 6.61 kB
  - `dist/assets/AiStudioView-BqEWNhNc.js`: 20.57 kB │ gzip: 7.03 kB
  - `dist/assets/SettingsView-zptXH7H3.js`: 19.49 kB │ gzip: 5.32 kB
  - `dist/assets/JamModal-DZ11O8OT.js`: 11.30 kB │ gzip: 3.26 kB
  - `dist/assets/SongRow-Bt17qKUW.js`: 10.39 kB │ gzip: 3.19 kB
  - `dist/assets/AuraChatDrawer-CCdgObo3.js`: 9.86 kB │ gzip: 3.91 kB
  - `dist/assets/PlaylistsView-DCIeP5kF.js`: 7.23 kB │ gzip: 2.31 kB
  - `dist/assets/radioService-BbYlXoTP.js`: 5.86 kB │ gzip: 1.90 kB
  - `dist/assets/QueueDrawer-nibCj3yt.js`: 5.57 kB │ gzip: 1.80 kB
  - `dist/assets/EmptyState-CZrHApCw.js`: 3.65 kB │ gzip: 1.47 kB
  - Sub-chunks (icons): ~0.20 - 0.40 kB each

---

## 3. Linter Baseline (`npm run lint`)

- **Command**: `oxlint`
- **Result**: 83 warnings, 0 errors (Finished in 472ms across 104 files with 116 rules)
- **Top Warning Categories**:
  - Unused imports / variables (`eslint(no-unused-vars)`) in views and modals
  - Calling setState directly within effects (`react(set-state-in-effect)`)
  - Missing hook dependencies (`react-hooks(exhaustive-deps)`)

---

## 4. Microsoft Edge Browser Stress Audit Baseline (`scripts/final_stress_audit.mjs`)

- **Browser**: Microsoft Edge Headless (Remote Debugging Port: 9245)
- **Console Errors**: 0
- **Console Warnings**: 0
- **Uncaught Exceptions**: 0
- **Network Errors (HTTP 4xx/5xx)**: 0
- **Flow Assertions**:
  - Valid Search ("Hukum"): PASS (14 cards, top hit: Jailer)
  - Search -> Play: PASS
  - Empty Search / Nonsense Search: PASS (graceful fallback)
  - Partial Search ("Vasee"): PASS (3 matched cards)
  - Rapid Typing (An -> Ani -> Anirudh): PASS (8 matched cards)
  - Favorites Toggle & IndexedDB Persistence: PASS
  - Queue Drawer Open & Play: PASS (50 rendered items, top hit Vaseegara)
  - Playlist Modal ESC key close: PASS
  - Responsiveness & Viewports:
    - 1280px (Desktop): scrollWidth = 1280px, hasHorizontalOverflow = false
    - 768px (Tablet): scrollWidth = 768px, hasHorizontalOverflow = false
    - 375px (Mobile): hasHorizontalOverflow = false, no bottom player / nav overlap

---

## 5. Identified Bottleneck Baseline Metrics

1. **SongRow Re-render Storm**:
   - `usePlayerStore` updates `currentTime` ~4 times per second (every ~250ms).
   - `SongRow.tsx` calls `const { ... } = usePlayerStore()` without selector.
   - For a 1,000 song library: 1,000 SongRows * 4 renders/sec = 4,000 renders/sec.
   - Each render runs `librarySongs.find(...)` across 1,000 items = 4,000,000 array iterations/sec on the main thread.
   - 1,000 instances of `<AddToPlaylistModal>` mounted unconditionally.
2. **Scanner Memory Leak**:
   - Scanner executes `URL.createObjectURL(file)` for every file and saves dead `blob:` strings into IndexedDB.
   - For 1,000 songs, 1,000 file references remain pinned in memory indefinitely without revocation.
3. **Audio Visualizer Idle Animation**:
   - Canvas `render()` loop runs `requestAnimationFrame` at 60-120 FPS continuously even when audio is paused.
4. **MediaSession Churn**:
   - `audioService.updateMediaSession()` creates new `MediaMetadata` 4 times/sec on every `timeupdate` tick.
5. **ID3 Artwork Extraction Freezing**:
   - Byte-by-byte string concatenation loop in `metadataParser.ts` blocks JS main thread during folder scan for large embedded images.
6. **Search Race Conditions**:
   - `SearchView.tsx` lacks `AbortController` cancellation for rapid keystrokes and lacks client-side memory caching.
7. **Server Caching & Process Guards**:
   - `searchCache` in `server/helpers/caches.ts` has unbounded growth.
   - Python subprocess execution lacks timeouts.
   - `/api/audio` lacks path traversal containment check.
