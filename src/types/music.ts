export interface Song {
  id: string;
  path: string; // Relative path or URI
  filePath: string; // Alias for backward compatibility
  fileName: string;
  title: string;
  artist: string; // 'Not set' if missing
  album: string; // 'Not set' if missing
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  duration: number; // in seconds
  bitrate?: number; // in kbps
  format: string; // 'mp3', 'opus', 'wav', 'm4a', 'flac'
  fileSize: number; // in bytes
  dateAdded: number; // timestamp
  lastModified?: number; // file timestamp
  playCount: number;
  lastPlayedAt?: number; // timestamp
  lastPlayed?: number; // Alias for backward compatibility
  isFavorite: boolean;
  artwork?: string; // base64 / blob URL
  coverArt?: string; // Alias for backward compatibility
  folder?: string;
  lyrics?: string; // Raw or embedded lyrics text
  syncedLyrics?: { time: number; text: string }[]; // Parsed timestamps
  isOnline?: boolean;
  sourceId?: string;
  isLiveRadio?: boolean;
  isSaavn?: boolean;
  isPreview?: boolean;
  isDownloaded?: boolean;
  downloadedAt?: number;
  isAuraFlow?: boolean;
  auraReason?: AuraRecommendationReason;
}

export type AuraRecommendationReason =
  | 'discovery_pick'
  | 'favorite_artist'
  | 'artist_continuity'
  | 'vibe_continuity'
  | 'affinity_match'
  | 'curated_pick';

export type DownloadState = 'not-downloaded' | 'downloading' | 'downloaded' | 'failed';

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  songCount: number;
  coverArt?: string;
  songs: Song[];
}

export interface Artist {
  id: string;
  name: string;
  songCount: number;
  albumCount: number;
  coverArt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  isSmart?: boolean;
  coverArt?: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface ScanResult {
  added: number;
  updated: number;
  unchanged: number;
  missing: number;
  failed: number;
  totalScanned: number;
  durationMs: number;
}

export interface ScanProgress {
  status: 'idle' | 'scanning' | 'complete' | 'error';
  currentFile: string;
  processedCount: number;
  totalCount: number;
  result?: ScanResult;
  errorMessage?: string;
}

export interface DuplicateGroup {
  id: string;
  canonicalTitle: string;
  similarityScore: number; // 0 - 100
  reasons: string[];
  songs: Song[];
}

export interface LibraryHealth {
  totalSongs: number;
  totalStorageBytes: number;
  formats: Record<string, number>;
  missingFilesCount: number;
  possibleDuplicatesCount: number;
  missingArtworkCount: number;
  missingArtistCount: number;
  missingAlbumCount: number;
  missingDurationCount: number;
  healthScore: number; // 0 - 100%
}

// Backward compatibility for existing components
export interface LibraryStats {
  totalSongs: number;
  totalStorageBytes: number;
  totalArtists: number;
  totalAlbums: number;
  totalPlaylists: number;
  songsMissingArtwork: number;
  songsMissingMetadata: number;
  possibleDuplicates: number;
}

export type NavigationTab = 'home' | 'library' | 'radio' | 'search' | 'playlists' | 'ai-studio' | 'settings';
export type LibrarySubTab = 'songs' | 'albums' | 'artists' | 'playlists' | 'folders' | 'downloads';
export type SortOption = 'recent' | 'title' | 'artist' | 'album' | 'duration' | 'mostPlayed' | 'bitrate' | 'fileSize';
export type ViewMode = 'grid' | 'list';

export type NowPlayingTab = 'artwork' | 'visualizer' | 'lyrics' | 'equalizer' | 'ai-insights';
export type VisualizerMode = 'spectrum' | 'waveform' | 'radial';

export type EqualizerPreset =
  | 'flat'
  | 'bass'
  | 'treble'
  | 'vocal'
  | 'pop'
  | 'rock'
  | 'electronic'
  | 'classical'
  | 'custom';

export type EqualizerBandType = BiquadFilterType;

export interface EqualizerBand {
  frequency: number;
  label: string;
  gain: number; // in dB (-12 to +12)
  type: EqualizerBandType;
}

export type SpatialPreset = 'off' | 'theatre' | 'concert' | 'cathedral' | 'club';


// AI Feature Interfaces
export interface AiDjTrack {
  title: string;
  artist: string;
}

export interface AiDjPlaylist {
  title: string;
  intro: string;
  vibe: string;
  suggested_eq: string;
  tracks: AiDjTrack[];
}

export interface SongAiInsights {
  theme: string;
  emotion: string;
  story: string;
  lines: { tamil: string; meaning: string }[];
  composer_notes: string;
  recommended_eq: string;
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'aura';
  text: string;
  timestamp: number;
  action?: {
    type:
      | 'TOGGLE_KARAOKE'
      | 'SET_EQ_PRESET'
      | 'PAUSE'
      | 'PLAY'
      | 'NEXT_TRACK'
      | 'PREV_TRACK'
      | 'TOGGLE_SHUFFLE'
      | 'SEARCH_AND_PLAY'
      | 'SET_VOLUME'
      | 'OPEN_AI_INSIGHTS'
      | 'NAVIGATE_TAB';
    preset?: EqualizerPreset;
    tab?: NavigationTab;
    query?: string;
    volume?: number;
  };
}

// Phase 3: Backup & Restore Schema
export interface BackupPlaylist {
  id: string;
  name: string;
  description?: string;
  songPaths: string[];
  createdAt: number;
  updatedAt: number;
}

export interface BackupFavorite {
  path: string;
  title: string;
  artist: string;
}

export interface BackupPlayHistory {
  path: string;
  playCount: number;
  lastPlayedAt?: number;
}

export interface LibraryBackup {
  version: number;
  appName: string;
  exportedAt: string;
  playlists: BackupPlaylist[];
  favorites: BackupFavorite[];
  playHistory: BackupPlayHistory[];
  settings?: Record<string, unknown>;
}

export interface BackupImportResult {
  success: boolean;
  playlistsImported: number;
  favoritesUpdated: number;
  playCountsUpdated: number;
  errors: string[];
}
