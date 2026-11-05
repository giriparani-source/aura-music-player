/**
 * src/services/scannerService.ts
 *
 * In-memory active file registry for on-demand playback.
 * Obsolete local disk/directory scanning functionality has been purged for Pure Cloud Streaming.
 */

// In-memory active file registry mapping song ID to File object for on-demand streaming
const activeFileRegistry = new Map<string, File>();

export function getRegisteredFile(songId: string): File | undefined {
  return activeFileRegistry.get(songId);
}

export function registerFile(songId: string, file: File) {
  activeFileRegistry.set(songId, file);
}

/**
 * Generate a deterministic stable ID for a song based on relative path or key
 */
export function generateSongId(relativePath: string): string {
  let hash = 0;
  const str = relativePath.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `song-${Math.abs(hash).toString(36)}`;
}
