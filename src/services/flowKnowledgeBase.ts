/**
 * src/services/flowKnowledgeBase.ts
 *
 * Lightweight client-side music vibe classification & artist normalization.
 * Distills core semantic rules from server/ai_engine.py into a fast, zero-dependency utility.
 */

export type VibeCluster =
  | 'high-energy'
  | 'party'
  | 'melodic-chill'
  | 'romantic'
  | 'sad-soulful'
  | 'retro-vintage'
  | 'acoustic'
  | 'general';

/**
 * Keyword rules for fast keyword-based vibe extraction
 */
const VIBE_KEYWORDS: Record<VibeCluster, string[]> = {
  'high-energy': [
    'gym', 'workout', 'fitness', 'beast', 'energy', 'pump', 'power', 'heavy',
    'adrenaline', 'verithanam', 'badass', 'hukum', 'alappara', 'naa ready',
    'vikram', 'roar', 'monster', 'believer'
  ],
  'party': [
    'party', 'dance', 'kuthu', 'blast', 'club', 'celebrat', 'dj', 'fast',
    'dappankuthu', 'aatam', 'thiruvizha', 'arabic kuthu', 'kaavaalaa',
    'illuminati', 'manasilaayo', 'vaathi coming', 'jalabulanjangu', 'rowdy'
  ],
  'melodic-chill': [
    'drive', 'night', 'midnight', 'cruis', 'highway', 'iravu', 'moon',
    'breeze', 'chill', 'late night', 'starboy', 'blinding lights', 'porkanda singam',
    'nenjame', 'sunset', 'lofi'
  ],
  'romantic': [
    'romantic', 'romance', 'love', 'kadhal', 'kaadhal', 'crush', 'lover',
    'anbu', 'heart', 'vaseegara', 'venmathi', 'munbe vaa', 'maruvarthai',
    'kannazhaga', 'duet', 'sweet', 'valayapatti'
  ],
  'sad-soulful': [
    'breakup', 'sad', 'alone', 'cry', 'pain', 'heal', 'miss', 'heartbreak',
    'vali', 'sogam', 'pirivu', 'kaneer', 'po nee po', 'kanave', 'unrequited'
  ],
  'retro-vintage': [
    '90s', '80s', 'ilaiyaraaja', 'spb', 'vintage', 'retro', 'classic',
    'maestro', 'pazhaiya', 'raaja', 'yesudas', 'janaki', 'chitra', 'nostalgia'
  ],
  'acoustic': [
    'acoustic', 'unplugged', 'peace', 'relax', 'calm', 'coffee', 'mazhai',
    'rain', 'rainy', 'monsoon', 'morning', 'kaalai', 'thendral', 'piano'
  ],
  'general': []
};

/**
 * Normalizes artist names by removing collaborations, separators, and parentheticals.
 * e.g. "Anirudh Ravichander, Jonita Gandhi • Beast" -> "anirudh ravichander"
 */
export function normalizeArtistName(artist: string): string {
  if (!artist || artist === 'Not set' || artist === 'Local Artist') return '';
  let clean = artist.toLowerCase();
  // Remove album bullet suffix: "Artist • Album"
  if (clean.includes('•')) {
    clean = clean.split('•')[0];
  }
  // Take primary lead artist before comma, slash, or ft.
  clean = clean.split(/[,/&]|ft\.|feat\./)[0];
  return clean.replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Extracts a normalized list of all artists involved (lead + features)
 */
export function extractArtistPool(artist: string): string[] {
  if (!artist || artist === 'Not set' || artist === 'Local Artist') return [];
  let text = artist.toLowerCase();
  if (text.includes('•')) {
    text = text.split('•')[0];
  }
  return text
    .split(/[,/&]|ft\.|feat\./)
    .map((a) => a.replace(/[^a-z0-9\s]/g, '').trim())
    .filter((a) => a.length > 1);
}

/**
 * Infers the vibe cluster of a song from its title, artist, album, and genre
 */
export function inferSongVibe(
  title: string,
  artist: string = '',
  album: string = '',
  genre: string = ''
): VibeCluster {
  const combined = `${title} ${artist} ${album} ${genre}`.toLowerCase();

  let bestCluster: VibeCluster = 'general';
  let maxScore = 0;

  for (const [cluster, keywords] of Object.entries(VIBE_KEYWORDS) as [VibeCluster, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        score += kw.length > 5 ? 2 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCluster = cluster;
    }
  }

  return bestCluster;
}

/**
 * Calculates similarity between two vibe clusters [0.0 to 1.0]
 */
export function calculateVibeSimilarity(vibeA: VibeCluster, vibeB: VibeCluster): number {
  if (vibeA === 'general' || vibeB === 'general') return 0.4;
  if (vibeA === vibeB) return 1.0;

  // Compatible clusters
  const compatiblePairs: [VibeCluster, VibeCluster][] = [
    ['high-energy', 'party'],
    ['melodic-chill', 'romantic'],
    ['melodic-chill', 'acoustic'],
    ['romantic', 'acoustic'],
    ['sad-soulful', 'melodic-chill'],
    ['retro-vintage', 'melodic-chill'],
    ['retro-vintage', 'romantic']
  ];

  for (const [p1, p2] of compatiblePairs) {
    if ((vibeA === p1 && vibeB === p2) || (vibeA === p2 && vibeB === p1)) {
      return 0.65;
    }
  }

  return 0.1;
}
