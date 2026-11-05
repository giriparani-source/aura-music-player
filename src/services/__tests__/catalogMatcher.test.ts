import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanTrackMetadata,
  calculateDiceSimilarity,
  evaluateHardGates,
  matchYouTubeToCatalog
} from '../catalogMatcher';
import * as jiosaavnService from '../jiosaavnService';
import { Song } from '../../types/music';

describe('Catalog Matcher with Hard Gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('cleanTrackMetadata', () => {
    it('aggressively cleans noise tags, brackets, and movie credits from YouTube video titles', () => {
      const raw = 'Arabic Kuthu - Video Song | Beast | Thalapathy Vijay | Sun Pictures | Anirudh | Nelson';
      const meta = cleanTrackMetadata(raw, 'Sun TV', 280);

      expect(meta.cleanTitle).toBe('Arabic Kuthu');
      expect(meta.isMixtape).toBe(false);
      expect(meta.isRemix).toBe(false);
      expect(meta.isLive).toBe(false);
    });

    it('identifies 33-minute DJ mixtapes and compilation videos', () => {
      const raw = 'Yuvan Mixtape | Yuvan Drugs | 03 | DJ V | VISHAL | Pitching Keys';
      const meta = cleanTrackMetadata(raw, 'Pitching Keys', 2000); // 33m 20s

      expect(meta.cleanTitle).toBe('Yuvan Mixtape');
      expect(meta.isMixtape).toBe(true);
    });

    it('identifies remix, live, and slowed versions', () => {
      const remixMeta = cleanTrackMetadata('Naa Ready (EDM Club Remix)', 'Anirudh', 210);
      expect(remixMeta.isRemix).toBe(true);

      const liveMeta = cleanTrackMetadata('Vaseegara (Live in Concert 2024)', 'Bombay Jayashri', 350);
      expect(liveMeta.isLive).toBe(true);

      const slowedMeta = cleanTrackMetadata('Enna Sona [Slowed + Reverb]', 'Arijit Singh', 240);
      expect(slowedMeta.isSlowed).toBe(true);
    });
  });

  describe('calculateDiceSimilarity', () => {
    it('returns high similarity for near-identical titles', () => {
      const sim = calculateDiceSimilarity('Arabic Kuthu', 'Arabic Kuthu');
      expect(sim).toBe(1.0);
    });

    it('returns low similarity for completely unrelated titles', () => {
      const sim = calculateDiceSimilarity('Arabic Kuthu', 'Kanja Poovu Kannala');
      expect(sim).toBeLessThan(0.3);
    });
  });

  describe('evaluateHardGates', () => {
    it('HARD GATE 1: REJECTS substituting a 33-minute mixtape with a 3-minute original song', () => {
      const mixtapeMeta = cleanTrackMetadata(
        'Yuvan Mixtape | Yuvan Drugs | 03 | DJ V | VISHAL | Pitching Keys',
        'Pitching Keys',
        2000 // 33 minutes
      );

      const popSongCandidate: Song = {
        id: 'saavn_pop_1',
        title: 'Yuvan Drugs',
        artist: 'Yuvan Shankar Raja',
        album: 'Aura',
        duration: 215, // 3.5 minutes
        format: 'mp3',
        fileName: 'test.mp4',
        fileSize: 5000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        path: 'https://aac.saavncdn.com/test.mp4',
        filePath: 'https://aac.saavncdn.com/test.mp4'
      };

      const result = evaluateHardGates(mixtapeMeta, popSongCandidate);
      expect(result.passed).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('mixtape/compilation');
    });

    it('HARD GATE 2: REJECTS substituting a Remix with the original studio track', () => {
      const remixMeta = cleanTrackMetadata('Naa Ready (Official EDM Remix)', 'Anirudh', 210);

      const originalCandidate: Song = {
        id: 'saavn_leo_1',
        title: 'Naa Ready',
        artist: 'Thalapathy Vijay, Anirudh',
        album: 'Leo',
        duration: 245,
        format: 'mp3',
        fileName: 'naaready.mp4',
        fileSize: 5000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        path: 'https://aac.saavncdn.com/naaready.mp4',
        filePath: 'https://aac.saavncdn.com/naaready.mp4'
      };

      const result = evaluateHardGates(remixMeta, originalCandidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Remix');
    });

    it('HARD GATE 3: REJECTS when duration difference exceeds standard tolerance', () => {
      const meta = cleanTrackMetadata('Hukum - Alappara', 'Anirudh', 200);

      const candidate: Song = {
        id: 'saavn_hukum_long',
        title: 'Hukum',
        artist: 'Anirudh',
        album: 'Jailer',
        duration: 380, // diff > 100s
        format: 'mp3',
        fileName: 'hukum.mp4',
        fileSize: 5000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        path: 'https://aac.saavncdn.com/hukum.mp4',
        filePath: 'https://aac.saavncdn.com/hukum.mp4'
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Duration mismatch');
    });

    it('PASSES when candidate matches title, artist, and duration within tolerance', () => {
      const meta = cleanTrackMetadata('Arabic Kuthu - Video Song | Beast', 'Anirudh', 280);

      const candidate: Song = {
        id: 'saavn_beast_1',
        title: 'Arabic Kuthu',
        artist: 'Anirudh Ravichander, Jonita Gandhi',
        album: 'Beast',
        duration: 278, // almost exact duration
        format: 'mp3',
        fileName: 'beast.mp4',
        fileSize: 6000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        path: 'https://aac.saavncdn.com/beast.mp4',
        filePath: 'https://aac.saavncdn.com/beast.mp4'
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(75);
    });
  });

  describe('matchYouTubeToCatalog', () => {
    it('returns MATCHED with direct 320k stream for high-confidence movie song', async () => {
      vi.spyOn(jiosaavnService, 'searchJioSaavn').mockResolvedValue([
        {
          id: 'saavn_arabic_kuthu',
          title: 'Arabic Kuthu',
          artist: 'Anirudh Ravichander, Jonita Gandhi',
          album: 'Beast',
          duration: 278,
          fileName: 'arabic_kuthu_320.mp4',
          filePath: 'https://aac.saavncdn.com/arabic_kuthu_320.mp4',
          path: 'https://aac.saavncdn.com/arabic_kuthu_320.mp4',
          format: '320k AAC',
          fileSize: 8000000,
          dateAdded: Date.now(),
          playCount: 0,
          isFavorite: false,
          artwork: 'https://c.saavncdn.com/beast.jpg'
        } as Song
      ]);

      const res = await matchYouTubeToCatalog(
        'Arabic Kuthu - Video Song | Beast | Thalapathy Vijay',
        'Sun TV',
        280,
        'KUN5Uf9mOBQ'
      );

      expect(res.status).toBe('MATCHED');
      expect(res.confidence).toBeGreaterThanOrEqual(75);
      if (res.status === 'MATCHED') {
        expect(res.streamUrl).toMatch(/aac\.saavncdn\.com\/(arabic_kuthu_320\.mp4|510\/9d96fc7d)/);
      }
      expect(res.song.isDirectAudioStream).toBe(true);
      expect(res.song.playbackMode).toBe('direct-catalog');
    });

    it('returns UNMATCHED_FOREGROUND_ONLY without querying catalog for 33-minute mixtape', async () => {
      const saavnSpy = vi.spyOn(jiosaavnService, 'searchJioSaavn');

      const res = await matchYouTubeToCatalog(
        'Yuvan Mixtape | Yuvan Drugs | 03 | DJ V | VISHAL | Pitching Keys',
        'Pitching Keys',
        2000,
        '08wJEbvRL3Q'
      );

      expect(res.status).toBe('UNMATCHED_FOREGROUND_ONLY');
      expect(res.confidence).toBe(0);
      expect(res.song.isForegroundOnly).toBe(true);
      expect(res.song.playbackMode).toBe('youtube-foreground');
      expect(saavnSpy).not.toHaveBeenCalled();
    });

    it('extracts movie context and matches via Pass 1 (Clean Title + Movie)', async () => {
      const saavnSpy = vi.spyOn(jiosaavnService, 'searchJioSaavn').mockImplementation(async (query) => {
        if (query.includes('Maamadura') && query.includes('Jigarthanda DoubleX')) {
          return [
            {
              id: 'saavn_maamadura',
              title: 'Maamadura',
              artist: 'Santhosh Narayanan, Dhee',
              album: 'Jigarthanda DoubleX',
              duration: 220,
              fileName: 'maamadura.mp4',
              filePath: 'https://aac.saavncdn.com/maamadura.mp4',
              path: 'https://aac.saavncdn.com/maamadura.mp4',
              format: '320k AAC',
              fileSize: 7000000,
              dateAdded: Date.now(),
              playCount: 0,
              isFavorite: false,
              artwork: 'https://c.saavncdn.com/jigarthanda.jpg'
            } as Song
          ];
        }
        return [];
      });

      const res = await matchYouTubeToCatalog(
        'Maamadura (From "Jigarthanda DoubleX") [Official Audio]',
        'Think Music India',
        222,
        'XyZ12345678'
      );

      expect(res.status).toBe('MATCHED');
      expect(saavnSpy).toHaveBeenCalledWith('Maamadura Jigarthanda DoubleX', 4, 1);
      if (res.status === 'MATCHED') {
        expect(res.reason).toContain('Pass 1 Matched');
      }
    });

    it('sanitizes "- Topic" channel suffix and matches via Pass 2 (Clean Title + Clean Artist)', async () => {
      const saavnSpy = vi.spyOn(jiosaavnService, 'searchJioSaavn').mockImplementation(async (query) => {
        if (query === 'Matta Yuvan Shankar Raja') {
          return [
            {
              id: 'saavn_matta',
              title: 'Matta',
              artist: 'Yuvan Shankar Raja, Vijay',
              album: 'The Greatest of All Time',
              duration: 215,
              fileName: 'matta.mp4',
              filePath: 'https://aac.saavncdn.com/matta.mp4',
              path: 'https://aac.saavncdn.com/matta.mp4',
              format: '320k AAC',
              fileSize: 6500000,
              dateAdded: Date.now(),
              playCount: 0,
              isFavorite: false,
              artwork: 'https://c.saavncdn.com/goat.jpg'
            } as Song
          ];
        }
        return [];
      });

      const res = await matchYouTubeToCatalog(
        'Matta',
        'Yuvan Shankar Raja - Topic',
        215,
        'MattaVid123'
      );

      expect(res.status).toBe('MATCHED');
      expect(saavnSpy).toHaveBeenCalledWith('Matta Yuvan Shankar Raja', 4, 1);
    });

    it('bypasses distributor/record label mismatch for Release - Topic in Pass 3 with strict duration', async () => {
      vi.spyOn(jiosaavnService, 'searchJioSaavn').mockImplementation(async (query) => {
        if (query === 'Kadharalz') {
          return [
            {
              id: 'saavn_kadharalz',
              title: 'Kadharalz',
              artist: 'Anirudh Ravichander',
              album: 'Kadharalz Single',
              duration: 232, // diff is 2s (within ±4s)
              fileName: 'kadharalz.mp4',
              filePath: 'https://aac.saavncdn.com/kadharalz.mp4',
              path: 'https://aac.saavncdn.com/kadharalz.mp4',
              format: '320k AAC',
              fileSize: 6000000,
              dateAdded: Date.now(),
              playCount: 0,
              isFavorite: false,
              artwork: 'https://c.saavncdn.com/kadharalz.jpg'
            } as Song
          ];
        }
        return [];
      });

      const res = await matchYouTubeToCatalog(
        'Kadharalz',
        'Release - Topic',
        230,
        'KadharalzId1'
      );

      expect(res.status).toBe('MATCHED');
      if (res.status === 'MATCHED') {
        expect(res.confidence).toBeGreaterThanOrEqual(85);
        expect(res.reason).toContain('Pass 3 Matched');
      }
    });

    it('STRICT RULE 1: Allows startsWith() ONLY if duration difference is <= 2 seconds', () => {
      const meta = cleanTrackMetadata('Matta', 'Yuvan Shankar Raja', 215);

      // Candidate 1: Duration diff is 2s (within <= 2s) -> Passes
      const candWithin2s: Song = {
        id: 'c1',
        title: 'Matta Extended Version',
        artist: 'Yuvan Shankar Raja',
        album: 'GOAT',
        duration: 213, // diff = 2s
        fileName: 't.mp3',
        filePath: 'https://aac.saavncdn.com/t.mp3',
        path: 'https://aac.saavncdn.com/t.mp3',
        format: '320k',
        fileSize: 1000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false
      };
      const res1 = evaluateHardGates(meta, candWithin2s);
      expect(res1.passed).toBe(true);

      // Candidate 2: Duration diff is 15s (> 2s) -> startsWith rejected
      const candAbove2s: Song = {
        id: 'c2',
        title: 'Matta Extended Dance Mix Version',
        artist: 'Yuvan Shankar Raja',
        album: 'GOAT',
        duration: 230, // diff = 15s > 2s
        fileName: 't2.mp3',
        filePath: 'https://aac.saavncdn.com/t2.mp3',
        path: 'https://aac.saavncdn.com/t2.mp3',
        format: '320k',
        fileSize: 1000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false
      };
      const res2 = evaluateHardGates(meta, candAbove2s);
      expect(res2.passed).toBe(false);
      expect(res2.reason).toContain('Title similarity too low');
    });

    it('STRICT RULE 2: REJECTS cross-movie mismatch when movie is specified in title', () => {
      const meta = cleanTrackMetadata('Maamadura (From "Jigarthanda DoubleX")', 'Santhosh Narayanan', 229);

      const wrongMovieCand: Song = {
        id: 'c_wrong_movie',
        title: 'Maamadura',
        artist: 'Santhosh Narayanan',
        album: 'Aadukalam', // completely different movie album!
        duration: 228,
        fileName: 'm.mp3',
        filePath: 'https://aac.saavncdn.com/m.mp3',
        path: 'https://aac.saavncdn.com/m.mp3',
        format: '320k',
        fileSize: 1000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false
      };

      const res = evaluateHardGates(meta, wrongMovieCand);
      expect(res.passed).toBe(false);
      expect(res.reason).toContain('Cross-movie mismatch');
    });

    it('STRICT RULE 2: REJECTS generic song without movie when artist differs and duration diff > 3s', () => {
      const meta = cleanTrackMetadata('Thangam', 'Unknown Artist', 280);

      const diffMovieCand: Song = {
        id: 'c_generic_diff',
        title: 'Thangam (From "Old Movie")',
        artist: 'Different Artist',
        album: 'Old Movie Album',
        duration: 250, // diff = 30s > 3s
        fileName: 'th.mp3',
        filePath: 'https://aac.saavncdn.com/th.mp3',
        path: 'https://aac.saavncdn.com/th.mp3',
        format: '320k',
        fileSize: 1000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false
      };

      const res = evaluateHardGates(meta, diffMovieCand);
      expect(res.passed).toBe(false);
      expect(res.reason).toContain('Cross-movie protection');
    });
  });
});
