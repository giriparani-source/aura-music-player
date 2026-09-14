import { Song } from '../types/music';
import { TamilArtist } from './tamilArtistsData';
import { INBUILT_PLAYLISTS } from './inbuiltPlaylistsService';
import { PRESET_SAAVN_320K_HITS, searchJioSaavn } from './jiosaavnService';
import { buildApiUrl } from '../utils/apiConfig';

export interface ArtistPlaylist {
  artist: TamilArtist;
  tracks: Song[];
  totalDuration: number;
  sourceBreakdown: {
    local: number;
    curated: number;
    online: number;
  };
}

interface CacheEntry {
  playlist: ArtistPlaylist;
  cachedAt: number;
}

// 1 Hour TTL for in-memory artist playlist cache
const CACHE_TTL_MS = 60 * 60 * 1000;

// Curated artist aliases and normalized lookup terms for all 54 Tamil artists
const ARTIST_ALIASES: Record<string, string[]> = {
  ar_rahman: ['a.r. rahman', 'ar rahman', 'a r rahman', 'rahman', 'a. r. rahman', 'allah rakha rahman'],
  ilaiyaraaja: ['ilaiyaraaja', 'ilayaraja', 'ilaiyaraja', 'illayaraja', 'isai gnani', 'isaignani', 'raaja sir', 'raaja'],
  yuvan_shankar_raja: ['yuvan shankar raja', 'yuvan', 'u1', 'yuvan shankar', 'yuvan shanker raja'],
  anirudh_ravichander: ['anirudh ravichander', 'anirudh'],
  harris_jayaraj: ['harris jayaraj', 'harris', 'harris jeyaraj'],
  gv_prakash_kumar: ['g.v. prakash kumar', 'gv prakash kumar', 'gv prakash', 'g v prakash', 'g.v. prakash', 'gv prakashkumar'],
  santhosh_narayanan: ['santhosh narayanan', 'sana', 'santhosh narayan', 'santosh narayanan'],
  vidyasagar: ['vidyasagar', 'vidyasaagar'],
  deva: ['deva', 'thenisai thendral deva'],
  d_imman: ['d. imman', 'd imman', 'imman', 'd.imman'],
  hiphop_tamizha: ['hiphop tamizha', 'hip hop tamizha', 'hiphop aadhi', 'aadhi', 'adhirav'],
  sean_roldan: ['sean roldan', 'r. raghavendra', 'raghavendra'],
  ghibran: ['ghibran', 'm. ghibran', 'mohammad ghibran'],
  karthik_raja: ['karthik raja'],
  bharadwaj: ['bharadwaj'],
  mani_sharma: ['mani sharma'],
  govind_vasantha: ['govind vasantha', 'govind menon'],
  justin_prabhakaran: ['justin prabhakaran'],
  sam_cs: ['sam c.s.', 'sam cs', 'sam c. s.', 'samcs'],
  vishal_chandrasekhar: ['vishal chandrasekhar', 'vishal chandrashekhar'],
  darbuka_siva: ['darbuka siva'],
  vivek_mervin: ['vivek-mervin', 'vivek mervin', 'vivek siva', 'mervin solomon'],
  vijay_antony: ['vijay antony'],
  sp_balasubrahmanyam: ['s. p. balasubrahmanyam', 's.p. balasubrahmanyam', 'sp balasubrahmanyam', 'spb', 's p b', 'balasubrahmanyam', 's.p.b.', 'sp bala'],
  kj_yesudas: ['k. j. yesudas', 'k.j. yesudas', 'kj yesudas', 'yesudas', 'k. j. yesudhas'],
  p_susheela: ['p. susheela', 'p susheela', 'susheela', 'p.susheela'],
  s_janaki: ['s. janaki', 's janaki', 'janaki', 's.janaki'],
  ks_chithra: ['k. s. chithra', 'k.s. chithra', 'ks chithra', 'chithra', 'chitra', 'k. s. chitra', 'k.s. chitra'],
  hariharan: ['hariharan'],
  unnikrishnan: ['p. unnikrishnan', 'p.unnikrishnan', 'p unnikrishnan', 'unnikrishnan'],
  swarnalatha: ['swarnalatha'],
  anuradha_sriram: ['anuradha sriram'],
  sujatha: ['sujatha mohan', 'sujatha'],
  malaysia_vasudevan: ['malaysia vasudevan'],
  sid_sriram: ['sid sriram'],
  shweta_mohan: ['shweta mohan', 'swetha mohan'],
  chinmayi: ['chinmayi sripaada', 'chinmayi sripada', 'chinmayi', 'chinmayee'],
  karthik: ['karthik'],
  benny_dayal: ['benny dayal'],
  haricharan: ['haricharan', 'haricharan seshadri'],
  vijay_yesudas: ['vijay yesudas'],
  dhee: ['dhee', 'தீ'],
  pradeep_kumar: ['pradeep kumar', 'பிரதீப் குமார்', 'pradeep'],
  andrea_jeremiah: ['andrea jeremiah', 'andrea', 'ஆண்ட்ரியா'],
  arivu: ['arivu', 'அறிவு', 'therukural arivu'],
  asal_kolaar: ['asal kolaar', 'asal kolar', 'அசல் கோலார்'],
  kaber_vasuki: ['kaber vasuki', 'kaber', 'கேபர் வாசுகி', 'vasuki'],
  srinivas: ['srinivas'],
  tippu: ['tippu'],
  naresh_iyer: ['naresh iyer'],
  jonita_gandhi: ['jonita gandhi'],
  shreya_ghoshal: ['shreya ghoshal', 'shreya ghosal'],
  shankar_mahadevan: ['shankar mahadevan'],
  shakthisree_gopalan: ['shakthisree gopalan', 'shaktisree gopalan']
};

export class ArtistPlaylistService {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Normalizes a text string for case-insensitive, accent-free comparison.
   */
  public normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Cleans a track title for robust deduplication.
   * Strips movie indicators, media descriptors, and bracketed metadata.
   */
  public cleanTitleForDedup(title: string): string {
    if (!title) return '';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\((?:from|original|lyrical|video|audio|remastered|official|full|hd|4k|tamil)[^)]*\)/gi, '')
      .replace(/\[(?:from|original|lyrical|video|audio|remastered|official|full|hd|4k|tamil)[^\]]*\]/gi, '')
      .replace(/\s*[-|–•]\s*(?:from|lyrical|video|audio|official|tamil|remastered|4k|hd|full|song).*$/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extracts base title token (the primary song name) before any subtitles or delimiters.
   */
  public getBaseTitle(title: string): string {
    const cleaned = this.cleanTitleForDedup(title);
    const parts = cleaned.split(/\s*[-|–•]\s*/);
    return (parts[0] || cleaned).trim();
  }

  /**
   * Returns all normalized alias variants for an artist.
   */
  public getArtistAliases(artist: TamilArtist): string[] {
    const defaultAliases = ARTIST_ALIASES[artist.id] || [];
    const directAliases = artist.aliases || [];
    const nameNorm = this.normalizeText(artist.name);

    const set = new Set<string>();
    set.add(nameNorm);
    defaultAliases.forEach((a) => set.add(this.normalizeText(a)));
    directAliases.forEach((a) => set.add(this.normalizeText(a)));

    return Array.from(set).filter(Boolean);
  }

  /**
   * Checks whether a given song legitimately belongs to an artist.
   * Handles primary credits, composer credits, singer credits, and collaborations.
   * Includes strict disambiguation rules to avoid false collisions.
   */
  public matchTrackToArtist(song: Song, artist: TamilArtist): boolean {
    if (!song || !artist) return false;

    const aliases = this.getArtistAliases(artist);

    // 1. Separate artist credits from movie/album suffixes (often placed after • in Aura data)
    const rawArtistField = song.artist || '';
    const artistPortion = rawArtistField.split('•')[0] || rawArtistField;
    const normArtistPortion = this.normalizeText(artistPortion);

    // 2. Disambiguation guards:
    // - "Karthik" must not match "Karthik Raja"
    if (artist.id === 'karthik') {
      if (normArtistPortion.includes('karthik raja')) {
        // Only matches if "karthik" appears independently of "karthik raja"
        const withoutKarthikRaja = normArtistPortion.replace(/karthik\s+raja/g, '').trim();
        if (!withoutKarthikRaja.includes('karthik')) {
          return false;
        }
      }
    }

    // - "Deva" must not match "Shankar Mahadevan" or "Vasudevan"
    if (artist.id === 'deva') {
      const tokens = normArtistPortion.split(/\s+/);
      const hasExactDeva = tokens.includes('deva');
      if (!hasExactDeva) return false;
    }

    // - "Vijay Antony" vs "Vijay Yesudas" vs "Thalapathy Vijay"
    if (artist.id === 'vijay_antony' && !normArtistPortion.includes('vijay antony')) {
      return false;
    }
    if (artist.id === 'vijay_yesudas' && !normArtistPortion.includes('vijay yesudas')) {
      return false;
    }

    // - "Dhee": ensure exact token match
    if (artist.id === 'dhee') {
      const tokens = normArtistPortion.split(/\s+/);
      if (!tokens.includes('dhee')) return false;
    }

    // 3. Match individual credit chunks (split by comma, &, feat, ft, and, +)
    const creditChunks = artistPortion
      .split(/[,&+/]|(?:\b(?:feat|ft|and)\b)/i)
      .map((c) => this.normalizeText(c))
      .filter(Boolean);

    for (const chunk of creditChunks) {
      for (const alias of aliases) {
        if (chunk === alias) return true;
        // Word boundary match within chunk
        const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(chunk)) return true;
      }
    }

    // 4. Also check direct normalized artist field
    for (const alias of aliases) {
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normArtistPortion)) return true;
    }

    // 5. If artist credit is generic/channel name (e.g. YouTube search result like "Ayngaran Music"),
    // check if the song title explicitly credits the artist via delimiters
    const normTitle = this.normalizeText(song.title);
    const genericChannelTerms = ['music', 'records', 'vevo', 'channel', 'audio', 'entertainment', 'films', 'media'];
    const isGenericArtist = genericChannelTerms.some((term) => normArtistPortion.includes(term));

    if (isGenericArtist || !normArtistPortion) {
      for (const alias of aliases) {
        if (alias.length >= 4) {
          const titleRegex = new RegExp(`(?:[-|–•/]|\\b(?:by|music|musical|ft|feat)\\b)\\s*${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (titleRegex.test(normTitle)) return true;
        }
      }
    }

    return false;
  }

  /**
   * Verifies that a track has all necessary attributes to be played by Aura's audio engine.
   * Disallows fake titles, placeholder IDs, or broken records.
   */
  public isUsableTrack(track: Song | null | undefined): boolean {
    if (!track) return false;
    if (!track.id || typeof track.id !== 'string' || track.id.trim() === '') return false;
    if (!track.title || typeof track.title !== 'string' || track.title.trim() === '') return false;
    if (typeof track.duration !== 'number' || isNaN(track.duration) || track.duration <= 0) return false;

    // Strict check: zero fake or placeholder tracks
    const lowerTitle = track.title.toLowerCase();
    const lowerId = track.id.toLowerCase();
    if (
      lowerTitle.includes('placeholder') ||
      lowerTitle.includes('dummy track') ||
      lowerTitle.includes('fake song') ||
      lowerTitle.includes('fake track') ||
      lowerId.startsWith('fake_') ||
      lowerId.startsWith('dummy_') ||
      lowerId.startsWith('placeholder_')
    ) {
      return false;
    }

    // Must have a playable local path or a valid online sourceId / stream identifier
    const hasPath = Boolean(track.filePath || track.path);
    const hasOnlineId = Boolean(track.sourceId || track.isOnline || track.id.startsWith('saavn_') || track.id.startsWith('online_'));

    if (!hasPath && !hasOnlineId) return false;

    return true;
  }

  /**
   * Deterministically deduplicates a collection of tracks.
   * Priority: Local songs > 320kbps Curated Saavn tracks > Online search tracks.
   */
  public deduplicateTracks(tracks: Song[]): Song[] {
    const seenIds = new Set<string>();
    const seenPaths = new Set<string>();
    const seenBaseTitles = new Map<string, Song>();
    const result: Song[] = [];

    // Sort order: Local tracks first, then 320k Saavn tracks, then other online tracks
    const sorted = [...tracks].sort((a, b) => {
      const aLocal = !a.isOnline ? 1 : 0;
      const bLocal = !b.isOnline ? 1 : 0;
      if (aLocal !== bLocal) return bLocal - aLocal;

      const aSaavn = a.isSaavn || (a.bitrate && a.bitrate >= 320) ? 1 : 0;
      const bSaavn = b.isSaavn || (b.bitrate && b.bitrate >= 320) ? 1 : 0;
      return bSaavn - aSaavn;
    });

    for (const track of sorted) {
      if (!this.isUsableTrack(track)) continue;

      // Check ID uniqueness
      if (seenIds.has(track.id)) continue;

      // Check URL / file path uniqueness
      const pathKey = track.filePath || track.path;
      if (pathKey && seenPaths.has(pathKey)) continue;

      // Base title & duration proximity check
      const baseTitle = this.getBaseTitle(track.title);
      if (baseTitle && baseTitle.length >= 3) {
        const existing = seenBaseTitles.get(baseTitle);
        if (existing) {
          // If the duration is within 25 seconds of the existing track, consider it a duplicate
          const durationDiff = Math.abs((existing.duration || 0) - (track.duration || 0));
          if (durationDiff <= 25) {
            continue;
          }
        }
      }

      seenIds.add(track.id);
      if (pathKey) seenPaths.add(pathKey);
      if (baseTitle && baseTitle.length >= 3) seenBaseTitles.set(baseTitle, track);

      result.push(track);
    }

    return result;
  }

  /**
   * Fetches additional real tracks from the existing online search infrastructure.
   */
  private async fetchOnlineTracksForArtist(artist: TamilArtist, neededCount: number): Promise<Song[]> {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return [];
    }

    const collected: Song[] = [];
    const cleanQuery = artist.name.replace(/\./g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Query JioSaavn infrastructure (authentic 320k AAC studio audio)
    try {
      const saavnResults = await searchJioSaavn(cleanQuery, Math.min(40, neededCount + 10));
      if (saavnResults && saavnResults.length > 0) {
        for (const track of saavnResults) {
          if (this.matchTrackToArtist(track, artist)) {
            collected.push(track);
          }
        }
      }

      // If still under neededCount, try query with "Tamil" keyword
      if (collected.length < neededCount) {
        const saavnTamilResults = await searchJioSaavn(`${cleanQuery} Tamil`, Math.min(40, neededCount - collected.length + 5));
        if (saavnTamilResults && saavnTamilResults.length > 0) {
          for (const track of saavnTamilResults) {
            if (this.matchTrackToArtist(track, artist)) {
              collected.push(track);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[ArtistPlaylistService] JioSaavn query error for ${artist.name}:`, err);
    }

    // 2. Query YouTube Music search endpoint (/api/online/search) if available and more tracks are needed
    if (collected.length < neededCount && typeof fetch !== 'undefined') {
      try {
        const endpoint = buildApiUrl(`/api/online/search?q=${encodeURIComponent(`${cleanQuery} Tamil songs`)}`);
        const res = await fetch(endpoint);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data?.results)) {
            for (const track of data.results) {
              if (this.matchTrackToArtist(track, artist)) {
                collected.push(track);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[ArtistPlaylistService] Online search error for ${artist.name}:`, err);
      }
    }

    return collected;
  }

  /**
   * Builds or retrieves the dedicated artist playlist for the specified artist.
   * Gathers tracks from local library, curated inbuilt playlists, and online search.
   */
  public async getArtistPlaylist(artist: TamilArtist, localSongs: Song[] = []): Promise<ArtistPlaylist> {
    const cacheKey = artist.id;
    const now = Date.now();

    // 1. Check in-memory cache
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached.playlist;
    }

    let localCount = 0;
    let curatedCount = 0;
    let onlineCount = 0;
    const candidateTracks: Song[] = [];

    // 2. Gather matching tracks from user's local library
    if (localSongs && localSongs.length > 0) {
      const localMatches = localSongs.filter((song) => this.matchTrackToArtist(song, artist));
      localCount = localMatches.length;
      candidateTracks.push(...localMatches);
    }

    // 3. Gather matching tracks from curated inbuilt playlists & studio master presets
    const allInbuiltTracks = INBUILT_PLAYLISTS.flatMap((p) => p.tracks);
    const combinedCurated = [...allInbuiltTracks, ...PRESET_SAAVN_320K_HITS];

    const curatedMatches = combinedCurated.filter((song) => this.matchTrackToArtist(song, artist));
    curatedCount = curatedMatches.length;
    candidateTracks.push(...curatedMatches);

    // Initial deduplication of local and curated data
    let deduplicated = this.deduplicateTracks(candidateTracks);

    // 4. If online and more tracks can be found, query real online search infrastructure
    const isOnline = typeof window === 'undefined' ? true : navigator.onLine;
    if (isOnline && deduplicated.length < 40) {
      const needed = 45 - deduplicated.length;
      const onlineTracks = await this.fetchOnlineTracksForArtist(artist, needed);
      if (onlineTracks.length > 0) {
        deduplicated = this.deduplicateTracks([...deduplicated, ...onlineTracks]);
      }
    }

    // Recalculate source breakdown accurately from the final deduplicated tracklist
    localCount = deduplicated.filter((t) => !t.isOnline).length;
    curatedCount = deduplicated.filter((t) => t.isOnline && (t.id.startsWith('t50_') || t.id.startsWith('fl_') || t.id.startsWith('saavn_') || t.id.startsWith('nd_') || t.id.startsWith('ch_') || t.id.startsWith('kt_') || t.id.startsWith('ani_') || t.id.startsWith('arr_') || t.id.startsWith('yuv_') || t.id.startsWith('hj_'))).length;
    onlineCount = deduplicated.length - localCount - curatedCount;

    const totalDuration = deduplicated.reduce((acc, t) => acc + (t.duration || 0), 0);

    const playlist: ArtistPlaylist = {
      artist,
      tracks: deduplicated,
      totalDuration,
      sourceBreakdown: {
        local: localCount,
        curated: curatedCount,
        online: Math.max(0, onlineCount)
      }
    };

    // Store in cache
    this.cache.set(cacheKey, {
      playlist,
      cachedAt: now
    });

    return playlist;
  }

  /**
   * Clears the artist playlist cache (either for a single artist or completely).
   */
  public clearArtistCache(artistId?: string): void {
    if (artistId) {
      this.cache.delete(artistId);
    } else {
      this.cache.clear();
    }
  }
}

export const artistPlaylistService = new ArtistPlaylistService();
