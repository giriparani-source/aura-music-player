import { describe, it, expect, beforeEach } from 'vitest';
import { ArtistPlaylistService } from '../artistPlaylistService';
import { TamilArtist } from '../tamilArtistsData';
import { Song } from '../../types/music';

describe('ArtistPlaylistService', () => {
  let service: ArtistPlaylistService;

  beforeEach(() => {
    service = new ArtistPlaylistService();
    service.clearArtistCache();
  });

  const mockRahman: TamilArtist = {
    id: 'ar_rahman',
    name: 'A.R. Rahman',
    subtitle: 'Isai Puyal • Oscar Maestro',
    image: 'https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg',
    category: 'composer'
  };

  const mockIlaiyaraaja: TamilArtist = {
    id: 'ilaiyaraaja',
    name: 'Ilaiyaraaja',
    subtitle: 'Isaignani • Living Legend',
    image: 'https://c.saavncdn.com/artists/Ilaiyaraaja_001_20251020081419_500x500.jpg',
    category: 'composer'
  };

  const mockAnirudh: TamilArtist = {
    id: 'anirudh_ravichander',
    name: 'Anirudh Ravichander',
    subtitle: 'Rockstar • Modern Hitmaker',
    image: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_003_20260121134149_500x500.jpg',
    category: 'composer'
  };

  const mockKarthik: TamilArtist = {
    id: 'karthik',
    name: 'Karthik',
    subtitle: 'Romantic Ballad Specialist',
    image: 'https://c.saavncdn.com/artists/Karthik_500x500.jpg',
    category: 'contemporary'
  };

  const mockKarthikRaja: TamilArtist = {
    id: 'karthik_raja',
    name: 'Karthik Raja',
    subtitle: 'Classical Harmony & Melodies',
    image: 'https://c.saavncdn.com/445/Kaathala-Kaathala-Tamil-2017-500x500.jpg',
    category: 'composer'
  };

  const mockDeva: TamilArtist = {
    id: 'deva',
    name: 'Deva',
    subtitle: 'Thenisai Thendral • Gaana King',
    image: 'https://c.saavncdn.com/artists/Deva_20190801133857_500x500.jpg',
    category: 'composer'
  };

  const createTestSong = (partial: Partial<Song>): Song => ({
    id: 'song_1',
    filePath: '/songs/song_1.mp3',
    path: '/songs/song_1.mp3',
    fileName: 'song_1.mp3',
    title: 'Test Song',
    artist: 'A.R. Rahman',
    album: 'Test Album',
    duration: 240,
    format: 'mp3',
    fileSize: 5000000,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    ...partial
  });

  describe('1. Artist Normalization & Exact Matching', () => {
    it('normalizes artist names correctly across casing, accents, and punctuation', () => {
      expect(service.normalizeText('A.R. Rahman')).toBe('a r rahman');
      expect(service.normalizeText('Ilaiyaraaja')).toBe('ilaiyaraaja');
      expect(service.normalizeText('S. P. Balasubrahmanyam')).toBe('s p balasubrahmanyam');
    });

    it('matches exact artist name on clean credit string', () => {
      const song = createTestSong({ artist: 'A.R. Rahman' });
      expect(service.matchTrackToArtist(song, mockRahman)).toBe(true);
    });

    it('matches artist name with soundtrack title separated by bullet', () => {
      const song = createTestSong({ artist: 'Anirudh Ravichander • Jailer' });
      expect(service.matchTrackToArtist(song, mockAnirudh)).toBe(true);
    });
  });

  describe('2. Alias & Abbreviation Matching', () => {
    it('matches common abbreviations like ARR and Rahman for A.R. Rahman', () => {
      const song1 = createTestSong({ artist: 'AR Rahman' });
      const song2 = createTestSong({ artist: 'Rahman' });
      expect(service.matchTrackToArtist(song1, mockRahman)).toBe(true);
      expect(service.matchTrackToArtist(song2, mockRahman)).toBe(true);
    });

    it('matches alternate spelling Ilayaraja and title Isaignani for Ilaiyaraaja', () => {
      const song1 = createTestSong({ artist: 'Ilayaraja' });
      const song2 = createTestSong({ artist: 'Isaignani Ilaiyaraaja' });
      expect(service.matchTrackToArtist(song1, mockIlaiyaraaja)).toBe(true);
      expect(service.matchTrackToArtist(song2, mockIlaiyaraaja)).toBe(true);
    });

    it('matches mononym Anirudh for Anirudh Ravichander', () => {
      const song = createTestSong({ artist: 'Thalapathy Vijay, Anirudh • Leo' });
      expect(service.matchTrackToArtist(song, mockAnirudh)).toBe(true);
    });
  });

  describe('3. Collaboration & Multi-Artist Credits', () => {
    it('matches when artist is one of multiple comma-separated artists', () => {
      const song = createTestSong({ artist: 'Anirudh Ravichander, Jonita Gandhi • Beast' });
      expect(service.matchTrackToArtist(song, mockAnirudh)).toBe(true);
    });

    it('matches when artist appears after feat. or &', () => {
      const song = createTestSong({ artist: 'Sid Sriram feat. A.R. Rahman' });
      expect(service.matchTrackToArtist(song, mockRahman)).toBe(true);
    });
  });

  describe('4. Disambiguation Guards (Preventing False Matches)', () => {
    it('does NOT match Karthik when credit is Karthik Raja', () => {
      const song = createTestSong({ artist: 'Karthik Raja • Kaathala Kaathala' });
      expect(service.matchTrackToArtist(song, mockKarthik)).toBe(false);
      expect(service.matchTrackToArtist(song, mockKarthikRaja)).toBe(true);
    });

    it('matches Karthik when both Karthik and another artist appear', () => {
      const song = createTestSong({ artist: 'Karthik, Shweta Mohan' });
      expect(service.matchTrackToArtist(song, mockKarthik)).toBe(true);
    });

    it('does NOT match Deva when credit is Shankar Mahadevan', () => {
      const song = createTestSong({ artist: 'Shankar Mahadevan' });
      expect(service.matchTrackToArtist(song, mockDeva)).toBe(false);
    });

    it('matches Deva when credit is legitimately Deva', () => {
      const song = createTestSong({ artist: 'Deva, Sabesh • Baashha' });
      expect(service.matchTrackToArtist(song, mockDeva)).toBe(true);
    });
  });

  describe('5. Usable Track Validation (Zero Fake Data Guarantee)', () => {
    it('rejects null, undefined, or empty objects', () => {
      expect(service.isUsableTrack(null)).toBe(false);
      expect(service.isUsableTrack(undefined)).toBe(false);
      expect(service.isUsableTrack({} as any)).toBe(false);
    });

    it('rejects songs with missing titles or non-positive durations', () => {
      const zeroDuration = createTestSong({ duration: 0 });
      const noTitle = createTestSong({ title: '' });
      expect(service.isUsableTrack(zeroDuration)).toBe(false);
      expect(service.isUsableTrack(noTitle)).toBe(false);
    });

    it('strictly rejects placeholder or fake tracks', () => {
      const fake1 = createTestSong({ title: 'Placeholder Song 1', id: 'fake_1' });
      const fake2 = createTestSong({ title: 'Dummy Track', id: 'dummy_123' });
      expect(service.isUsableTrack(fake1)).toBe(false);
      expect(service.isUsableTrack(fake2)).toBe(false);
    });

    it('accepts legitimate local and online tracks', () => {
      const localTrack = createTestSong({ id: 'loc_1', filePath: '/music/song.mp3' });
      const onlineTrack = createTestSong({ id: 'saavn_123', sourceId: '123', isOnline: true });
      expect(service.isUsableTrack(localTrack)).toBe(true);
      expect(service.isUsableTrack(onlineTrack)).toBe(true);
    });
  });

  describe('6. Deterministic Deduplication', () => {
    it('removes exact duplicate IDs', () => {
      const track1 = createTestSong({ id: 't1', title: 'Hukum' });
      const track2 = createTestSong({ id: 't1', title: 'Hukum' });
      const deduped = service.deduplicateTracks([track1, track2]);
      expect(deduped).toHaveLength(1);
    });

    it('removes duplicate tracks with identical paths', () => {
      const track1 = createTestSong({ id: 't1', filePath: 'https://audio.com/hukum.mp4' });
      const track2 = createTestSong({ id: 't2', filePath: 'https://audio.com/hukum.mp4' });
      const deduped = service.deduplicateTracks([track1, track2]);
      expect(deduped).toHaveLength(1);
    });

    it('deduplicates variants like "Hukum - Thalaivar Alappara" vs "Hukum (From Jailer)" with matching duration', () => {
      const track1 = createTestSong({ id: 't1', title: 'Hukum - Thalaivar Alappara', duration: 236 });
      const track2 = createTestSong({ id: 't2', title: 'Hukum (From "Jailer")', duration: 236 });
      const deduped = service.deduplicateTracks([track1, track2]);
      expect(deduped).toHaveLength(1);
    });

    it('preserves distinct songs with different titles', () => {
      const track1 = createTestSong({ id: 't1', title: 'Kannazhaga', duration: 210, filePath: '/songs/t1.mp3', path: '/songs/t1.mp3' });
      const track2 = createTestSong({ id: 't2', title: 'Kanne Kalaimane', duration: 240, filePath: '/songs/t2.mp3', path: '/songs/t2.mp3' });
      const deduped = service.deduplicateTracks([track1, track2]);
      expect(deduped).toHaveLength(2);
    });

    it('prefers local track over streaming duplicate', () => {
      const onlineTrack = createTestSong({ id: 'online_1', isOnline: true, title: 'Hukum', duration: 236 });
      const localTrack = createTestSong({ id: 'local_1', isOnline: false, title: 'Hukum', duration: 236 });
      const deduped = service.deduplicateTracks([onlineTrack, localTrack]);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].isOnline).toBe(false);
    });
  });

  describe('7. Aggregation & In-Memory Caching', () => {
    it('aggregates curated tracks and returns cached playlist on subsequent calls', async () => {
      const localSongs = [
        createTestSong({ id: 'loc_arr_1', artist: 'A.R. Rahman', title: 'Chaiyya Chaiyya' })
      ];

      const playlist1 = await service.getArtistPlaylist(mockRahman, localSongs);
      expect(playlist1.artist.id).toBe('ar_rahman');
      expect(playlist1.tracks.length).toBeGreaterThan(0);
      expect(playlist1.tracks.some((t) => t.id === 'loc_arr_1')).toBe(true);

      // Verify cached retrieval
      const playlist2 = await service.getArtistPlaylist(mockRahman);
      expect(playlist2).toBe(playlist1);

      // Clear cache and verify fresh build
      service.clearArtistCache('ar_rahman');
      const playlist3 = await service.getArtistPlaylist(mockRahman);
      expect(playlist3).not.toBe(playlist1);
    });
  });
});
