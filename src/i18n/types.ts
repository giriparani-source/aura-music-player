export type Language = 'en' | 'ta' | 'tanglish';

export interface TranslationSchema {
  nav: {
    home: string;
    library: string;
    radio: string;
    search: string;
    aiStudio: string;
    settings: string;
    smartMixes: string;
    liveBadge: string;
    cloudBadge: string;
    aiBadge: string;
    subTitle: string;
  };
  player: {
    play: string;
    pause: string;
    next: string;
    previous: string;
    shuffle: string;
    repeat: string;
    mute: string;
    unmute: string;
    queue: string;
    lyrics: string;
    karaoke: string;
    sleepTimer: string;
    auraFlow: string;
    socialJam: string;
    nowPlaying: string;
    noTrackPlaying: string;
    volume: string;
    expand: string;
    equalizer: string;
    spatialAudio: string;
    favorites: string;
    download: string;
    downloaded: string;
  };
  header: {
    searchPlaceholder: string;
    librarySearchPlaceholder: string;
    clearSearch: string;
    storageUsage: string;
    openAiDj: string;
  };
  settings: {
    title: string;
    subtitle: string;
    language: string;
    languageSubtitle: string;
    english: string;
    tamil: string;
    tanglish: string;
    musicSource: string;
    auraFlowTitle: string;
    socialJamTitle: string;
    backupRestoreTitle: string;
    libraryHealthTitle: string;
    geminiAiTitle: string;
  };
  common: {
    songs: string;
    artists: string;
    albums: string;
    playlists: string;
    loading: string;
    offline: string;
    online: string;
    save: string;
    saved: string;
    cancel: string;
    delete: string;
    clear: string;
    close: string;
  };
}
