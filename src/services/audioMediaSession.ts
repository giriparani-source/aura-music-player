import { Song } from '../types/music';

/**
 * Manages OS-level media integration via the MediaSession API (SMTC on Windows, lockscreen on Android/iOS).
 * Formats artwork, artist, album metadata and updates playback state without redundant IPC calls.
 */
export class AudioMediaSession {
  private lastMediaSessionKey: string | null = null;

  public update(currentSong: Song | null, isActuallyPlaying: boolean): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const desiredState: MediaSessionPlaybackState = isActuallyPlaying ? 'playing' : 'paused';
      if (navigator.mediaSession.playbackState !== desiredState) {
        navigator.mediaSession.playbackState = desiredState;
      }

      if (!currentSong) {
        if (this.lastMediaSessionKey !== null) {
          navigator.mediaSession.metadata = null;
          this.lastMediaSessionKey = null;
        }
        return;
      }

      const artworkUrl = currentSong.artwork || currentSong.coverArt;
      const songKey = `${currentSong.id}_${currentSong.title}_${currentSong.artist}_${artworkUrl}`;
      if (songKey !== this.lastMediaSessionKey) {
        this.lastMediaSessionKey = songKey;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist !== 'Not set' ? currentSong.artist : 'Aura Music',
          album: currentSong.album !== 'Not set' ? currentSong.album : 'Aura Collection',
          artwork: artworkUrl
            ? [{ src: artworkUrl, sizes: '512x512', type: 'image/png' }]
            : []
        });
      }
    } catch {
      // Ignore mediaSession errors on platforms without SMTC
    }
  }

  public clear(): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        this.lastMediaSessionKey = null;
      } catch {}
    }
  }
}

export const audioMediaSession = new AudioMediaSession();
