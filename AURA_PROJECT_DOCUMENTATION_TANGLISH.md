# 🎵 AURA MUSIC PLAYER — COMPLETE PROJECT DOCUMENTATION (TANGLISH)

> **"Local Files + High-End Online Streaming + Pro Audiophile DSP + Real-Time Jam Mode + AI Smart Autoplay"**  
> Idhu dhaan namma **Aura Music Player** oda ultimate superpower! Inga full project architecture, features, working mechanism, folder structure ellathayum pure Tanglish-la simple-ah puriyara maadhiri explain pannirukom.

---

## 📑 TABLE OF CONTENTS
1. [Project Overview (Idhu Enna App?)](#1-project-overview-idhu-enna-app)
2. [Tech Stack (Enna enna tech use panrom?)](#2-tech-stack-enna-enna-tech-use-panrom)
3. [Folder Structure (Files enga enna irukku?)](#3-folder-structure-files-enga-enna-irukku)
4. [Core Architecture & Working Mechanism](#4-core-architecture--working-mechanism)
5. [Top Killer Features Breakdown](#5-top-killer-features-breakdown)
   - 5.1 [Aura Flow — Infinite AI Autoplay](#51-aura-flow--infinite-ai-autoplay)
   - 5.2 [Pro Audiophile DSP & Equalizer Engine](#52-pro-audiophile-dsp--equalizer-engine)
   - 5.3 [Jam Session — Real-Time Party Mode (WebRTC)](#53-jam-session--real-time-party-mode-webrtc)
   - 5.4 [Smart Local Library & Scanner](#54-smart-local-library--scanner)
   - 5.5 [Duplicate Track Detection & Library Health](#55-duplicate-track-detection--library-health)
   - 5.6 [Online Streaming (JioSaavn 320kbps) & Offline Cache](#56-online-streaming-jiosaavn-320kbps--offline-cache)
   - 5.7 [AI Studio & Tanglish Chat Assistant](#57-ai-studio--tanglish-chat-assistant)
   - 5.8 [True-Fair Shuffle (Anti-Clustering)](#58-true-fair-shuffle-anti-clustering)
6. [State Management Architecture (Zustand & DB)](#6-state-management-architecture-zustand--db)
7. [Performance & Optimization Achievements](#7-performance--optimization-achievements)
8. [Keyboard Shortcuts & Hotkeys](#8-keyboard-shortcuts--hotkeys)
9. [How to Run, Test & Build (Developer Commands)](#9-how-to-run-test--build-developer-commands)

---

## 1. Project Overview (Idhu Enna App?)

**Aura Music Player** oru ultra-modern, high-performance web and local music player. Simple-ah sollanum na:
- Idhula unga local computer-la irukura **MP3, FLAC, WAV, M4A** songs-ah scan panni super clean UI-la play pannalam.
- Adhe neram, **JioSaavn 320kbps Studio Master** streaming online-laye nadakkum.
- Standard music player maadhiri illama, idhula **10-Band EQ, Real-time Karaoke (Vocal Remover), 3D Spatial Audio, Subsonic Rumble Filter, Psychoacoustic Bass Exciter** maadhiri studio-grade audio features irukku.
- Friends kooda serndhu kekka **Jam Session (WebRTC P2P)** irukku. Room code share panna, rendu perukkum song exact millisecond sync-la play aagum!
- AI smart recommendation (**Aura Flow**) unga taste purinjukittu continuous-ah songs play pannitte irukkum.

---

## 2. Tech Stack (Enna enna tech use panrom?)

| Layer | Technology | Details / Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19** | Ultra-modern React with code splitting via `React.lazy` |
| **Language** | **TypeScript (~6.0)** | Strict types, complete type safety across player, DB, and audio |
| **Bundler & Build** | **Vite 8** | Lightning fast Hot Module Replacement (HMR) & 1.19s production build |
| **Styling** | **Tailwind CSS v4** | Modern glassmorphism, responsive grid, `#090b10` midnight dark theme |
| **State Management** | **Zustand 5** | High-performance micro-state stores (`usePlayerStore`, `useLibraryStore`, `useJamStore`) |
| **Audio Engine** | **Web Audio API + HTML5 Audio** | Low-latency audio processing graph, AnalyserNode for 60 FPS Visualizer |
| **P2P Networking** | **PeerJS (WebRTC)** | Server-less peer-to-peer real-time Jam sync + BroadcastChannel |
| **Local Storage** | **IndexedDB** | In-browser database for songs, playlists, favorites, offline blob cache |
| **Backend & Helper** | **Node.js (Express) + Python 3** | Audio streaming proxy (`server.js`), AI engine (`ai_engine.py`) |
| **Testing & Linting** | **Vitest 5 + Oxlint** | 159 unit tests (executed in 1.74s), zero lint errors |
| **Icons** | **Lucide React** | Clean, lightweight vector icons |

---

## 3. Folder Structure (Files enga enna irukku?)

```text
d:\music player\
├── server/                      # Backend AI & Streaming helpers
│   ├── ai_engine.py             # Local semantic AI logic (moods, lyrics, Tanglish chat)
│   ├── online_stream.py         # yt-dlp / audio stream extractor
│   ├── helpers/                 # Python subprocess runner, LRU search cache
│   └── middleware/              # Local audio streaming (HTTP 206) & path traversal guard
├── api/                         # Vercel / serverless online search endpoints
│   └── online/search.js         # Online audio query resolver
├── src/
│   ├── types/
│   │   └── music.ts             # Core interfaces (Song, Playlist, EqualizerBand, etc.)
│   ├── services/                # Core Business Logic & Audio Engines
│   │   ├── audioService.ts      # HTML5 Audio controller + MediaSession lifecycle
│   │   ├── audioEffectsService.ts # 10-Band EQ, Karaoke, Spatial, Bass Exciter, Limiter
│   │   ├── auraFlowService.ts   # Infinite AI Smart Autoplay scoring engine
│   │   ├── jamService.ts        # WebRTC PeerJS group listening party engine
│   │   ├── db.ts                # IndexedDB wrapper (songs, playlists, history)
│   │   ├── scannerService.ts    # File System Access API scanner
│   │   ├── metadataParser.ts    # ID3 tag & embedded cover art extractor
│   │   ├── jiosaavnService.ts   # JioSaavn API client + 320kbps presets
│   │   ├── lyricsService.ts     # Synced LRC / plain lyrics fetcher & parser
│   │   ├── duplicateService.ts  # Fuzzy duplicate track detector
│   │   ├── healthService.ts     # Library health audit calculator
│   │   ├── downloadService.ts   # Offline audio downloader to IndexedDB
│   │   ├── sleepTimerService.ts # Countdown sleep timer logic
│   │   └── tamilArtistsData.ts  # Curated registry of 23+ legendary Tamil artists
│   ├── store/                   # Zustand Global State
│   │   ├── usePlayerStore.ts    # Current song, queue, play/pause, volume, DSP state
│   │   ├── useLibraryStore.ts   # Songs list, filters, sort, scan progress, favorites
│   │   └── useJamStore.ts       # Jam room state, participants, reactions
│   ├── components/
│   │   ├── layout/              # MainLayout, Sidebar, Header, MobileBottomNav
│   │   ├── views/               # HomeView, LibraryView, SearchView, PlaylistsView, AiStudioView, SettingsView
│   │   ├── player/              # BottomPlayer, NowPlayingModal, EqualizerPanel, AudioVisualizer, LyricsView
│   │   ├── jam/                 # JamModal (Create/Join room, participants, live reactions)
│   │   ├── ai/                  # AuraChatDrawer (Tanglish AI music buddy)
│   │   └── common/              # SongRow, ErrorBoundary, PwaInstallBanner
│   ├── utils/
│   │   └── fairShuffle.ts       # Anti-clustering Fair Shuffle algorithm
│   ├── App.tsx                  # Root app wrapper
│   └── main.tsx                 # Entrypoint
├── server.js                    # Express production server for hosting
├── package.json                 # Project dependencies & scripts
└── vite.config.ts               # Vite configuration with Tailwind CSS v4
```

---

## 4. Core Architecture & Working Mechanism

```mermaid
graph TD
    User([User UI Interaction]) --> Zustand[Zustand Stores<br/>usePlayerStore / useLibraryStore]
    
    subgraph Audio Pipeline
        Zustand --> AudioSvc[audioService.ts]
        AudioSvc --> WebAudioCtx[Web Audio Context Graph]
        WebAudioCtx --> Subsonic[18Hz Subsonic Filter]
        Subsonic --> EQ[10-Band Biquad EQ]
        EQ --> Karaoke[Karaoke Vocal Canceller]
        Karaoke --> Exciter[Psychoacoustic Bass Exciter]
        Exciter --> Spatial[3D Spatial Convolver]
        Spatial --> Limiter[Dynamics Limiter]
        Limiter --> Analyser[AnalyserNode -> 60FPS Visualizer]
        Analyser --> Speakers((Speakers / Headphones))
    end

    subgraph Storage & Offline
        Scanner[scannerService.ts] --> Parser[metadataParser.ts]
        Parser --> IndexedDB[(IndexedDB - musicDB)]
        IndexedDB --> Zustand
    end

    subgraph P2P Social
        Zustand --> JamSvc[jamService.ts]
        JamSvc <--> WebRTC[PeerJS WebRTC Mesh]
    end

    subgraph AI Intelligence
        Zustand --> AuraFlow[auraFlowService.ts]
        AuraFlow --> Affinity[auraAffinityService]
        AuraFlow --> SkipSvc[auraSkipService]
    end
```

1. **User song select pannumbodhu**:
   - `usePlayerStore.playSong(song)` call aagum.
   - `audioService` file URL or stream URL-ah HTML Audio element-la load pannum.
   - Browser memory save panna, local files-ku temporary blob URL create aagi track maarumbodhu revoke aagum.
2. **Audio Graph Processing**:
   - Audio signal direct-ah speaker-ku pogama, namma custom **Web Audio API Graph** vazhiya pogum.
   - Subsonic filter low rumble-ah cut pannum -> 10-Band EQ gain apply aagum -> Karaoke mode active-la irundha vocals subtract aagum -> Bass exciter warm harmonics add pannum -> Limiter audio distort aagama protect pannum -> Analyser visualizer canvas-ku data anuppum.
3. **Song mudiyumbodhu (Autoplay)**:
   - Next song queue-la irundha play aagum.
   - Queue empty aana, **Aura Flow AI** auto-trigger aagi next best song calculate panni sequence pannum.

---

## 5. Top Killer Features Breakdown

### 5.1 Aura Flow — Infinite AI Autoplay
- **Problem**: Queue mudinja udane song ninrupogum.
- **Aura Solution**: Aura Flow oru intelligent music recommendation engine.
- **Scoring Breakdown**:
  - **Vibe Match**: Current song oda tempo and mood (chill, acoustic, kuthu, mass) match aagura tracks-ku high score tharum.
  - **Artist Affinity**: Neenga adhigama keka koodiya artists-ku positive score.
  - **Discovery Preference**: User settings-la 3 modes choose pannalam:
    - `Comfort`: Neenga regular-ah kekura safe favorite songs matum podum.
    - `Balanced`: 70% familiar songs + 30% new songs mix pannum.
    - `Adventurous`: Pudhu pudhu tracks & artists explore panna vekkum.
  - **Persistent Skip Penalty**: Oru song-ah play aana 15 seconds-kulla continuous-ah skip panna, adhu ungalukku pidikala nu purinjukittu penalty podum. Adhukku apram adha auto-play pannaadhu!
  - **Anti-Clustering Diversity**: Orey artist oda 3 songs continuous-ah varaama automatic-ah spacing tharum.

### 5.2 Pro Audiophile DSP & Equalizer Engine
- **10-Band Equalizer**: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz frequency bands.
- **Presets**: Flat, Bass Monster, Treble Boost, Vocal Focus, Pop, Rock, Electronic, Classical.
- **Karaoke Vocal Remover**: Stereo signal-la center-panned vocals-ah phase cancellation + bandpass filtering vazhiya suppress pannum. Neenga lyrics paathu paadalam!
- **3D Spatial Audio**: Theatre, Concert Hall, Cathedral, Club reverbs — ordinary stereo sound-ah binaural 3D stage sound-ah convert pannum.
- **18Hz Subsonic Filter**: Human ear-ku ketkaadha 18Hz-ku keela irukkura low rumble noise-ah cut panni speaker/headphone distortion thadukkum.
- **Psychoacoustic Bass Exciter**: Small speakers / phone speakers-la deep bass ketkadhula? Idhu non-linear harmonic synthesis moolama artificial warm bass frequencies generate panni kekka vekkum.
- **Dynamics Limiter**: Volume sudden-ah peak aagi audio tear (crackling) aagama audio ceiling maintain pannum.

### 5.3 Jam Session — Real-Time Party Mode (WebRTC)
- **Concept**: Long-distance friends kooda orey nerathula orey paata kekkalam.
- **No Central Server Lag**: WebRTC PeerJS moolama browsers direct-ah connect aagum.
- **Host & Join**:
  - Host "Create Jam" click panna 6-digit code kedaikkum (eg: `AUR89X`).
  - Friends "Join Jam" click panni code pota instant-ah connect aaiduvanga.
- **Millisecond Drift Correction**: Internet lag nala minor delay vandha kooda, client automatic-ah seek time adjust panni host kooda millisecond accuracy-la sync pannum.
- **Live Reactions**: Jam modal-la emoji buttons (🔥, ❤️, 🕺, ⚡) click panna, room-la irukkura ellar screen-layum live animation aagi pop aagum.

### 5.4 Smart Local Library & Scanner
- Modern **File System Access API** (`showDirectoryPicker`) use panni unga PC-la irukkura music folder-ah scan pannalam.
- **ID3 Metadata Parser**: Song title, artist name, album, release year, bitrate, duration ellathayum pure binary buffer manipulation moolama instant-ah read pannum.
- Embedded album art pictures-ah 8KB chunk processing moolama fast-ah extract panni IndexedDB-la store pannum.

### 5.5 Duplicate Track Detection & Library Health
- **Duplicate Detection**: Library perusaga aaga orey song vera vera name-la irukkum (eg: `Hukum (320kbps).mp3` vs `01 - Hukum.mp3`).
- Namma system string normalization + fuzzy similarity run panni duplicate songs-ah detect panni list pannum.
- **Library Health Score (0–100%)**: Missing tags, missing artwork, corrupted files, and duplicate percentage calculate panni unga music collection health-ah report tharum.

### 5.6 Online Streaming (JioSaavn 320kbps) & Offline Cache
- High quality 320kbps AAC studio master songs direct-ah stream aagum.
- Pre-curated Top 50 hits (Anirudh mass, AR Rahman classics, Yuvan drugs, Harris melodies) inbuilt-ah irukku.
- **Offline Download**: "Download" icon click panna, song blob data indexedDB-la cache aagum. Internet illadha podhu kooda "Downloads" tab-la offline-la kekkalam!

### 5.7 AI Studio & Tanglish Chat Assistant
- Natural Tanglish language processing capability!
- **Aura Chat Drawer**: Bottom corner-la AI icon click panni chat pannalam:
  - *"Bro late night drive-ku etha song podu"* -> Instant vibe playlist sequence pannum!
  - *"Karaoke on pannu"* -> Automate panni vocal cancel pannum!
  - *"Bass yethu"* -> Bass preset EQ apply pannum!
- **AI Song Insights**: Oru song play aagumbodhu andha song oda lyric meaning, background emotion, composer trivia ellathayum Tanglish-la display pannum.

### 5.8 True-Fair Shuffle (Anti-Clustering)
- Standard shuffle la random pick panradhala orey artist oda 3 paatu aduthadutha play aagi bore adikkum.
- Aura Player **Spotify-style Fair Shuffle** algorithm use pannudhu:
  1. Library songs-ah artist buckets-ah pirikkum.
  2. Bucket-kulla Fisher-Yates shuffle pannum.
  3. Mathematical interval spacing moolama queue-la tracks-ah interleave panni podum. Orey artist songs pakkathu pakkathula varave varaadhu!

---

## 6. State Management Architecture (Zustand & DB)

State management romba clean-ah 3 Zustand stores-la divide aagiyirukku:

1. **`usePlayerStore`**:
   - `currentSong`, `isPlaying`, `currentTime`, `duration`, `volume`.
   - DSP states: `isKaraoke`, `spatialPreset`, `bassExciterLevel`, `isLimiterActive`.
   - Queue management: `queue`, `queueIndex`, `shuffledQueueOrder`, `playbackHistory`.
2. **`useLibraryStore`**:
   - `songs`, `albums`, `artists`, `playlists`, `favorites`.
   - `activeTab` ('home' | 'library' | 'search' | 'playlists' | 'ai-studio' | 'settings').
   - `scanProgress`, `health`, `duplicates`.
3. **`useJamStore`**:
   - `isInRoom`, `isHost`, `roomCode`, `participants`, `reactions`.

### Re-Render Optimization Strategy
Audio player-la common problem: `timeupdate` event second-ku 4 times trigger aagum. Whole component tree re-render aana UI lag aagum.
Aura Player-la:
- Micro-selectors use panrom: `const isPlaying = usePlayerStore((s) => s.isPlaying);`
- `currentTime` changes row-level components-ku broadcast aagaadhu; seek bar and timestamp elements matume direct-ah listen pannum.
- Result: **Zero unnecessary re-renders during playback!**

---

## 7. Performance & Optimization Achievements

| Metric | Before Optimization | After Optimization | Benefit |
| :--- | :--- | :--- | :--- |
| **Unit Test Duration** | 3.88s | **1.74s** | **55.2% faster** (159 passing unit tests) |
| **Production Build Time** | 3.00s | **1.19s** | **60.3% faster** Vite bundle |
| **SongRow Playback Renders** | ~4 renders/sec | **0 renders/sec** | Battery saving & zero scroll stutter |
| **Visualizer Idle CPU/GPU** | Constant 60 FPS loop | **0 FPS when paused** | Laptops-la zero battery drain when paused |
| **MediaMetadata GC Churn** | 4 object alloc/sec | **1 alloc per song** | Browser garbage collection freeze eliminated |
| **Search Debounce & Race** | Overlapping responses | **AbortController + LRU** | Fast typing-la wrong results varave varaadhu |
| **File URL Memory Leaks** | Unbounded Blob URLs | **On-demand + auto revoke** | Memory usage stable even for 5,000 songs |

---

## 8. Keyboard Shortcuts & Hotkeys

Power users-ku desktop experience speed-up panna inbuilt hotkeys irukku:

| Key | Action | Description |
| :--- | :--- | :--- |
| **Space** | `Play / Pause` | Current playback toggle pannum |
| **Arrow Right** | `Seek +5s` | 5 seconds forward pogum |
| **Arrow Left** | `Seek -5s` | 5 seconds rewind pannum |
| **N** | `Next Track` | Queue-la irukkura next song play pannum |
| **P** | `Previous Track`| History or previous song play pannum |
| **F** | `Favorite Toggle`| Current song-ah favorites-la add/remove pannum |
| **Escape** | `Close Modals` | Now Playing modal or Queue drawer close pannum |

*(Note: Search box or Text input focus-la irukkumbodhu hotkeys trigger aagaadhu).*

---

## 9. How to Run, Test & Build (Developer Commands)

Project root folder (`d:\music player`)-la terminal open panni execute pannunga:

```bash
# 1. Start Development Server (Vite HMR)
npm run dev
# Browser-la open pannunga: http://localhost:5173

# 2. Run All Unit Tests (Vitest)
npm test

# 3. Watch Mode Tests
npm run test:watch

# 4. Code Linting (Oxlint)
npm run lint

# 5. Production Build
npm run build

# 6. Preview Production Build
npm run preview

# 7. Start Node.js Backend Server (for streaming & API)
node server.js
```

---

## 💡 Summary & Final Words

Namma **Aura Music Player** simply just oru frontend UI mattum kedayadhu; idhu oru **full-fledged audiophile music ecosystem**:
- Audiophile grade sound engine (Web Audio API)
- Realtime group listening (WebRTC)
- Smart AI music buddy (Tanglish NLP + Aura Flow)
- Ultra-fast & optimized code (Zero memory leaks, 1.74s test suite)

Unga project pathi vera edhavadhu specific doubt or new feature add panna thonuna kelunga nanba, instant-ah execute pannidalam! 🚀🔥
