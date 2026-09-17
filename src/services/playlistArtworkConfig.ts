/**
 * src/services/playlistArtworkConfig.ts
 *
 * Centralized, deterministic playlist artwork configuration & semantic mapping registry.
 * Each curated / inbuilt playlist is mapped to high-resolution, visually relevant artwork
 * crafted specifically for that playlist's title, description, and musical mood.
 *
 * All artwork assets are locally hosted in `/assets/playlists/` for instantaneous loading,
 * zero CDN latency, 100% offline resilience, and consistent 1:1 aspect ratio presentation.
 */

export interface PlaylistArtworkMetadata {
  playlistId: string;
  title: string;
  theme: string;
  description: string;
  artwork: string;
  accentColor: string;
}

export const PLAYLIST_ARTWORK_REGISTRY: Record<string, PlaylistArtworkMetadata> = {
  top_50_tamil: {
    playlistId: 'top_50_tamil',
    title: 'Top 50 – Tamil Blockbusters',
    theme: 'Tamil Cinema Blockbusters • Grand Gold Stage & Celebration',
    description: 'Opulent golden celebration stage with spotlights, sparkling light trails, and festive cinematic awards atmosphere.',
    artwork: '/assets/playlists/top_50_tamil.jpg',
    accentColor: '#f59e0b'
  },
  mudhal_kaadhal: {
    playlistId: 'mudhal_kaadhal',
    title: 'Mudhal Kaadhal',
    theme: 'First Love Romance • Coastal Golden Hour & Rain Walk',
    description: 'Romantic South Indian couple walking hand-in-hand along a scenic rain-washed coastal road under warm sunset rays.',
    artwork: '/assets/playlists/mudhal_kaadhal.jpg',
    accentColor: '#f43f5e'
  },
  '90s_vibe': {
    playlistId: '90s_vibe',
    title: '90s Vibe',
    theme: '1990s Tamil Golden Era • Analog Vinyl & Vacuum Tube Warmth',
    description: 'Classic wooden turntable playing a spinning vinyl record alongside glowing warm vacuum tube amplifiers and vintage cassettes.',
    artwork: '/assets/playlists/90s_vibe.jpg',
    accentColor: '#eab308'
  },
  night_drive: {
    playlistId: 'night_drive',
    title: 'Night Drive',
    theme: 'Midnight Highway • Neon City Bokeh & Rain Reflections',
    description: 'Inside a sports car cockpit looking out onto an illuminated midnight highway with purple-cyan neon lights reflecting on wet roads.',
    artwork: '/assets/playlists/night_drive.jpg',
    accentColor: '#a855f7'
  },
  beast_mode_workout: {
    playlistId: 'beast_mode_workout',
    title: 'Beast Mode Workout',
    theme: 'High BPM Gym Hype • Intense Iron Lifting & Chalk Dust',
    description: 'Muscular athletic silhouette gripping heavy steel dumbbells in a dark gym bathed in fiery orange and red motivation lights.',
    artwork: '/assets/playlists/beast_mode_workout.jpg',
    accentColor: '#ea580c'
  },
  kollywood_chillout: {
    playlistId: 'kollywood_chillout',
    title: 'Kollywood Chillout',
    theme: 'Soulful Acoustics • Balcony Sunset Twilight & Coffee',
    description: 'Acoustic guitar resting on an armchair by an open balcony window overlooking a tranquil twilight sea with warm string lights.',
    artwork: '/assets/playlists/kollywood_chillout.jpg',
    accentColor: '#6366f1'
  },
  kuthu_party_blast: {
    playlistId: 'kuthu_party_blast',
    title: 'Kuthu & Party Blast',
    theme: 'Festival Bangers • Thavil/Dholak Drums & Color Explosion',
    description: 'High-energy celebration dance with traditional South Indian percussion drums, bursting festive powders, and golden celebration sparks.',
    artwork: '/assets/playlists/kuthu_party_blast.jpg',
    accentColor: '#f59e0b'
  },
  anirudh_mass: {
    playlistId: 'anirudh_mass',
    title: 'Anirudh Mass Anthems',
    theme: 'Rockstar Concert Energy • Cyan & Magenta Arena Lasers',
    description: 'Rockstar jumping on a stadium stage with electric guitar under piercing neon purple and laser light beams before a roaring crowd.',
    artwork: '/assets/playlists/anirudh_mass.jpg',
    accentColor: '#3b82f6'
  },
  ar_rahman_hits: {
    playlistId: 'ar_rahman_hits',
    title: 'A.R. Rahman • Isai Puyal',
    theme: 'Oscar Maestro Soundtracks • Celestial Concert Grand Piano',
    description: 'Concert grand piano bathed in a celestial golden spotlight in a prestigious hall with floating musical notes and orchestra.',
    artwork: '/assets/playlists/ar_rahman_hits.jpg',
    accentColor: '#14b8a6'
  },
  yuvan_drug_bgm: {
    playlistId: 'yuvan_drug_bgm',
    title: 'Yuvan Shankar Raja • Drug BGMs',
    theme: 'U1 Cult Melodies • Neon Studio Console & Melancholic Waves',
    description: 'Late-night music production mixing console with illuminated sliders, audio waveforms, and studio headphones in deep magenta-purple glow.',
    artwork: '/assets/playlists/yuvan_drug_bgm.jpg',
    accentColor: '#e11d48'
  },
  harris_jayaraj_melodies: {
    playlistId: 'harris_jayaraj_melodies',
    title: 'Harris Jayaraj • Minnal Melodies',
    theme: 'Monsoon Breeze Classics • Raindrop Window & Acoustic Guitar',
    description: 'Acoustic guitar resting beside a rain-streaked window looking out over lush misty green tropical hills during fresh monsoon rain.',
    artwork: '/assets/playlists/harris_jayaraj_melodies.jpg',
    accentColor: '#06b6d4'
  },
  liked_songs: {
    playlistId: 'liked_songs',
    title: 'Liked Songs',
    theme: 'Personal Favorites • Neon Violet Heart & Vinyl Disc',
    description: 'Minimalist glowing neon violet heart floating over a glossy dark vinyl record with ambient audio ripples.',
    artwork: '/assets/playlists/liked_songs.jpg',
    accentColor: '#8b5cf6'
  }
};

/**
 * Returns the semantic high-resolution artwork URL for a given playlist ID.
 * Falls back to a sleek gradient or default image if ID is not recognized.
 */
export function getPlaylistArtwork(playlistId: string): string {
  const meta = PLAYLIST_ARTWORK_REGISTRY[playlistId];
  if (meta?.artwork) {
    return meta.artwork;
  }
  return '/assets/playlists/top_50_tamil.jpg';
}

/**
 * Returns full metadata (theme, description, accent color) for a playlist.
 */
export function getPlaylistArtworkMeta(playlistId: string): PlaylistArtworkMetadata | undefined {
  return PLAYLIST_ARTWORK_REGISTRY[playlistId];
}
