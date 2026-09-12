import { Song, ScanProgress, ScanResult } from '../types/music';
import { extractAudioMetadata } from './metadataParser';
import { musicDB } from './db';

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.opus', '.wav', '.m4a', '.flac']);

// In-memory active file registry mapping song ID to File object for on-demand streaming
const activeFileRegistry = new Map<string, File>();

export function getRegisteredFile(songId: string): File | undefined {
  return activeFileRegistry.get(songId);
}

export function registerFile(songId: string, file: File) {
  activeFileRegistry.set(songId, file);
}

/**
 * Generate a deterministic stable ID for a song based on relative path
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

export interface ScanFileEntry {
  file: File;
  relativePath: string;
}

/**
 * Recursively extracts files from a FileSystemDirectoryHandle
 */
export async function collectFilesFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = ''
): Promise<ScanFileEntry[]> {
  const entries: ScanFileEntry[] = [];

  // @ts-ignore - async iterator on directory handle
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const ext = '.' + entry.name.split('.').pop()?.toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        try {
          const file = await entry.getFile();
          entries.push({
            file,
            relativePath: currentPath ? `${currentPath}/${entry.name}` : entry.name
          });
        } catch {
          // File access error
        }
      }
    } else if (entry.kind === 'directory') {
      const subDir = entry as FileSystemDirectoryHandle;
      const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      const subFiles = await collectFilesFromDirectoryHandle(subDir, subPath);
      entries.push(...subFiles);
    }
  }

  return entries;
}

/**
 * Extracts supported audio files from standard HTML FileList input
 */
export function collectFilesFromFileList(fileList: FileList): ScanFileEntry[] {
  const entries: ScanFileEntry[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      const relativePath = file.webkitRelativePath || file.name;
      entries.push({ file, relativePath });
    }
  }
  return entries;
}

/**
 * Core Differential Music Scanner
 * Accurately tracks Added, Updated, Unchanged, Missing, Failed
 */
export async function runDifferentialScan(
  entries: ScanFileEntry[],
  onProgress: (progress: ScanProgress) => void
): Promise<{ result: ScanResult; songsToSave: Song[] }> {
  const startTime = performance.now();

  const scanResult: ScanResult = {
    added: 0,
    updated: 0,
    unchanged: 0,
    missing: 0,
    failed: 0,
    totalScanned: entries.length,
    durationMs: 0
  };

  // Step 1: Load existing songs from database
  const existingSongs = await musicDB.getAllSongs();
  const existingSongMap = new Map<string, Song>();
  for (const s of existingSongs) {
    existingSongMap.set(s.id, s);
    // Also index by path
    if (s.path) existingSongMap.set(s.path, s);
  }

  const scannedPaths = new Set<string>();
  const songsToSave: Song[] = [];

  // Step 2: Iterate and process each file differentially
  for (let i = 0; i < entries.length; i++) {
    const { file, relativePath } = entries[i];
    scannedPaths.add(relativePath);

    // Non-blocking UI progress update
    onProgress({
      status: 'scanning',
      currentFile: file.name,
      processedCount: i + 1,
      totalCount: entries.length
    });

    // Yield control to browser event loop every 10 files to keep UI at 60 FPS
    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const songId = generateSongId(relativePath);
    registerFile(songId, file);

    const existing = existingSongMap.get(songId) || existingSongMap.get(relativePath);

    // Fast differential check: if size and lastModified match, file is unchanged!
    if (existing && existing.fileSize === file.size && existing.lastModified === file.lastModified) {
      scanResult.unchanged++;
      // Still update runtime path URL so it plays seamlessly in current session
      existing.filePath = URL.createObjectURL(file);
      continue;
    }

    // Otherwise, parse metadata
    try {
      const meta = await extractAudioMetadata(file, relativePath);

      // Determine folder name from relative path
      const parts = relativePath.split('/');
      const folderName = parts.length > 1 ? parts[parts.length - 2] : 'Music';
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      const songObj: Song = {
        id: songId,
        path: relativePath,
        filePath: URL.createObjectURL(file),
        fileName: file.name,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        albumArtist: meta.albumArtist,
        genre: meta.genre,
        year: meta.year,
        trackNumber: meta.trackNumber,
        discNumber: meta.discNumber,
        duration: meta.duration,
        bitrate: meta.bitrate,
        format: ext.replace('.', ''),
        fileSize: file.size,
        dateAdded: existing ? existing.dateAdded : Date.now(),
        lastModified: file.lastModified,
        playCount: existing ? existing.playCount : 0,
        lastPlayedAt: existing ? existing.lastPlayedAt : undefined,
        lastPlayed: existing ? existing.lastPlayed : undefined,
        isFavorite: existing ? existing.isFavorite : false,
        artwork: meta.artwork,
        coverArt: meta.artwork,
        folder: folderName,
        lyrics: meta.lyrics || (existing ? existing.lyrics : undefined)
      };

      songsToSave.push(songObj);

      if (existing) {
        scanResult.updated++;
      } else {
        scanResult.added++;
      }
    } catch {
      scanResult.failed++;
    }
  }

  // Step 3: Check for missing songs (existed in DB before, but not seen in this folder scan)
  for (const s of existingSongs) {
    if (s.path && !scannedPaths.has(s.path)) {
      scanResult.missing++;
    }
  }

  scanResult.durationMs = Math.round(performance.now() - startTime);

  // Save new & updated songs in batch
  if (songsToSave.length > 0) {
    await musicDB.saveSongsBatch(songsToSave);
  }

  return { result: scanResult, songsToSave };
}
