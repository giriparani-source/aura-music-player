/**
 * src/services/auraProfileExplainer.ts
 *
 * Aura Flow Profile Explainer & Taste Intelligence Formatting (Phase 5.5).
 * Pure deterministic utility providing human-readable labels, top-taste summaries,
 * and transparent recommendation reason explanations based strictly on real profile data.
 */

import { UserAffinityProfile } from './auraAffinityService';
import { AuraRecommendationReason } from '../types/music';
import { VibeCluster } from './flowKnowledgeBase';

/**
 * Friendly display mappings for Vibe Clusters
 */
export const VIBE_DISPLAY_LABELS: Record<VibeCluster, string> = {
  'high-energy': 'High Energy',
  'party': 'Party & Dance',
  'melodic-chill': 'Melodic & Chill',
  'romantic': 'Romantic',
  'sad-soulful': 'Soulful & Nostalgic',
  'retro-vintage': 'Retro Classics',
  'acoustic': 'Acoustic & Peaceful',
  'general': 'Eclectic'
};

/**
 * Truthful explanations for Aura recommendation reasons
 */
export const AURA_REASON_EXPLANATIONS: Record<AuraRecommendationReason, string> = {
  discovery_pick: 'Picked as a fresh discovery after familiar listening.',
  favorite_artist: 'Picked because this artist matches your long-term listening preferences.',
  artist_continuity: "Picked because it connects with the artist or collaborator you're listening to.",
  vibe_continuity: 'Picked because its vibe matches the current track.',
  affinity_match: 'Picked because it matches patterns Aura has learned from your listening.',
  curated_pick: 'Picked as a curated option for a smooth continuation.'
};

/**
 * Converts a normalized artist name into clean, human-readable title casing.
 */
export function formatArtistDisplayName(rawArtist: string): string {
  if (!rawArtist || typeof rawArtist !== 'string') return '';
  const trimmed = rawArtist.trim();
  if (!trimmed) return '';

  // Handle known common abbreviations and special cases cleanly
  const specialCases: Record<string, string> = {
    'a.r. rahman': 'A.R. Rahman',
    'a r rahman': 'A.R. Rahman',
    'ar rahman': 'A.R. Rahman',
    'g.v. prakash': 'G.V. Prakash',
    'gv prakash': 'G.V. Prakash',
    'spb': 'S.P. Balasubrahmanyam',
    's.p.b.': 'S.P. Balasubrahmanyam',
    's. p. balasubrahmanyam': 'S.P. Balasubrahmanyam',
    'yuvan shankar raja': 'Yuvan Shankar Raja',
    'anirudh ravichander': 'Anirudh Ravichander',
    'santhosh narayanan': 'Santhosh Narayanan',
    'harris jayaraj': 'Harris Jayaraj',
    'ilaiyaraaja': 'Ilaiyaraaja',
    'vidyasagar': 'Vidyasagar',
    'deva': 'Deva'
  };

  const lower = trimmed.toLowerCase();
  if (specialCases[lower]) {
    return specialCases[lower];
  }

  // General title case with support for dots and hyphens
  return trimmed
    .split(' ')
    .map((word) => {
      if (word.includes('.')) {
        return word
          .split('.')
          .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
          .join('.');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Gets the human-friendly display label for a vibe cluster.
 */
export function getVibeFriendlyLabel(vibe: string): string {
  if (!vibe) return 'Eclectic';
  const cluster = vibe as VibeCluster;
  if (VIBE_DISPLAY_LABELS[cluster]) {
    return VIBE_DISPLAY_LABELS[cluster];
  }
  return vibe
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export interface TopArtistItem {
  artist: string;
  displayName: string;
  score: number;
}

export interface TopVibeItem {
  vibe: string;
  displayName: string;
  score: number;
}

/**
 * Extracts top artists sorted by affinity score descending.
 */
export function getTopArtists(profile: UserAffinityProfile | null, limit: number = 8): TopArtistItem[] {
  if (!profile || !profile.artistAffinity) return [];

  return Object.entries(profile.artistAffinity)
    .filter(([, score]) => typeof score === 'number' && score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([artist, score]) => ({
      artist,
      displayName: formatArtistDisplayName(artist),
      score: Math.round(score)
    }));
}

/**
 * Extracts top vibes sorted by affinity score descending.
 */
export function getTopVibes(profile: UserAffinityProfile | null, limit: number = 5): TopVibeItem[] {
  if (!profile || !profile.vibeAffinity) return [];

  return Object.entries(profile.vibeAffinity)
    .filter(([, score]) => typeof score === 'number' && score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([vibe, score]) => ({
      vibe,
      displayName: getVibeFriendlyLabel(vibe),
      score: Math.round(score)
    }));
}

/**
 * Generates a human-readable summary of what Aura has learned from the user's actual profile.
 * Returns a friendly empty state if insufficient data exists.
 */
export function generateProfileSummary(profile: UserAffinityProfile | null): string {
  if (!profile || (profile.totalMeaningfulPlays ?? 0) < 3) {
    return 'Aura is still learning your taste. Listen to more tracks to activate deep personalization.';
  }

  const topArtists = getTopArtists(profile, 3);
  const topVibes = getTopVibes(profile, 2);

  if (topArtists.length === 0 && topVibes.length === 0) {
    return 'Aura is still learning your taste. Listen to more tracks to activate deep personalization.';
  }

  const playLabel = `${profile.totalMeaningfulPlays} meaningful ${profile.totalMeaningfulPlays === 1 ? 'play' : 'plays'}`;

  if (topArtists.length > 0 && topVibes.length > 0) {
    const artistList = topArtists.map((a) => a.displayName).join(', ');
    const vibeList = topVibes.map((v) => v.displayName).join(' & ');
    return `You have a strong affinity for ${vibeList} led by ${artistList}, with ${playLabel} logged.`;
  }

  if (topArtists.length > 0) {
    const artistList = topArtists.map((a) => a.displayName).join(', ');
    return `Your listening is concentrated around ${artistList}, with ${playLabel} logged.`;
  }

  const vibeList = topVibes.map((v) => v.displayName).join(' & ');
  return `Your listening is drawn to ${vibeList}, with ${playLabel} logged.`;
}

/**
 * Gets a human-friendly truthful explanation for an Aura recommendation reason.
 */
export function getAuraReasonExplanation(reason?: AuraRecommendationReason): string {
  if (!reason) return 'Picked by Aura Flow for seamless listening.';
  return AURA_REASON_EXPLANATIONS[reason] || 'Picked by Aura Flow for seamless listening.';
}
