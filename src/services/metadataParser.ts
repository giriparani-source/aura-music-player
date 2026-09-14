export interface ParsedMetadata {
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  duration: number;
  bitrate?: number;
  artwork?: string;
  lyrics?: string;
}

/**
 * Clean ugly website names or hyphens from a filename fallback
 */
export function cleanFileNameFallback(filename: string): string {
  let name = filename.replace(/\.[^/.]+$/, '');
  // Remove known website junk
  name = name.replace(/[-_]?MassTamilan\.[a-z0-9]+/gi, '');
  name = name.replace(/[-_]?MassTamilan/gi, '');
  name = name.replace(/_320\(PagalWorld[^\)]*\)/gi, '');
  name = name.replace(/\(PagalWorld[^\)]*\)/gi, '');
  name = name.replace(/[-_]?PagalWorld[a-zA-Z0-9]*/gi, '');
  name = name.replace(/[-_]?PagalHits/gi, '');
  name = name.replace(/\(KoshalWorld\.Com\)/gi, '');
  name = name.replace(/[-_]?MastiPagla/gi, '');
  name = name.replace(/[-_]?DJPunjab/gi, '');
  name = name.replace(/[-_]?MobCup\.[^\s]+/gi, '');

  // Normalize separators
  name = name.replace(/---+/g, ' - ');
  name = name.replace(/--+/g, ' - ');
  name = name.replace(/_/g, ' ');
  name = name.replace(/(?<=[a-zA-Z0-9])-(?=[a-zA-Z0-9])/g, ' ');
  name = name.replace(/^[\s\-_.]+|[\s\-_.]+$/g, '');
  name = name.replace(/\s+/g, ' ').trim();

  return name || filename;
}

/**
 * Decode text buffer based on ID3 encoding byte
 */
function decodeID3Text(buffer: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // ISO-8859-1
      let str = '';
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) break;
        str += String.fromCharCode(buffer[i]);
      }
      return str.trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM
      return new TextDecoder('utf-16').decode(buffer).replace(/\0/g, '').trim();
    } else if (encoding === 2) {
      // UTF-16BE without BOM
      return new TextDecoder('utf-16be').decode(buffer).replace(/\0/g, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      return new TextDecoder('utf-8').decode(buffer).replace(/\0/g, '').trim();
    }
  } catch {
    // Fallback ascii
  }
  return '';
}

/**
 * Parses ID3v2 metadata from the first 256KB of a File or Blob
 */
async function parseID3v2(file: File | Blob): Promise<Partial<ParsedMetadata>> {
  const meta: Partial<ParsedMetadata> = {};
  const headerSlice = await file.slice(0, 10).arrayBuffer();
  const header = new Uint8Array(headerSlice);

  // Check ID3 magic bytes
  if (header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) {
    return meta; // No ID3v2
  }

  const majorVersion = header[3];
  // Calculate synchsafe tag size
  const tagSize =
    ((header[6] & 0x7f) << 21) |
    ((header[7] & 0x7f) << 14) |
    ((header[8] & 0x7f) << 7) |
    (header[9] & 0x7f);

  if (tagSize <= 0 || tagSize > 10 * 1024 * 1024) {
    return meta;
  }

  // Read up to 256KB of tag data to stay fast
  const readLength = Math.min(tagSize, 256 * 1024);
  const tagSlice = await file.slice(10, 10 + readLength).arrayBuffer();
  const tagData = new Uint8Array(tagSlice);

  let offset = 0;

  while (offset + 10 < tagData.length) {
    // Read 4-byte frame ID
    const frameId = String.fromCharCode(
      tagData[offset],
      tagData[offset + 1],
      tagData[offset + 2],
      tagData[offset + 3]
    );

    // Padding / zero byte check
    if (tagData[offset] === 0) break;

    // Frame size (synchsafe in v2.4, regular 32-bit int in v2.3)
    let frameSize = 0;
    if (majorVersion === 4) {
      frameSize =
        ((tagData[offset + 4] & 0x7f) << 21) |
        ((tagData[offset + 5] & 0x7f) << 14) |
        ((tagData[offset + 6] & 0x7f) << 7) |
        (tagData[offset + 7] & 0x7f);
    } else {
      frameSize =
        (tagData[offset + 4] << 24) |
        (tagData[offset + 5] << 16) |
        (tagData[offset + 6] << 8) |
        tagData[offset + 7];
    }

    offset += 10; // Skip frame header

    if (frameSize <= 0 || offset + frameSize > tagData.length) {
      break;
    }

    const frameData = tagData.subarray(offset, offset + frameSize);
    offset += frameSize;

    if (frameData.length < 2) continue;

    const encoding = frameData[0];
    const textBytes = frameData.subarray(1);

    if (frameId === 'TIT2') {
      meta.title = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TPE1') {
      meta.artist = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TALB') {
      meta.album = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TPE2') {
      meta.albumArtist = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TCON') {
      meta.genre = decodeID3Text(textBytes, encoding);
    } else if (frameId === 'TYER' || frameId === 'TDRC') {
      const yearStr = decodeID3Text(textBytes, encoding);
      const yearNum = parseInt(yearStr.substring(0, 4), 10);
      if (!isNaN(yearNum)) meta.year = yearNum;
    } else if (frameId === 'TRCK') {
      const trackStr = decodeID3Text(textBytes, encoding);
      const trackNum = parseInt(trackStr.split('/')[0], 10);
      if (!isNaN(trackNum)) meta.trackNumber = trackNum;
    } else if (frameId === 'TPOS') {
      const discStr = decodeID3Text(textBytes, encoding);
      const discNum = parseInt(discStr.split('/')[0], 10);
      if (!isNaN(discNum)) meta.discNumber = discNum;
    } else if (frameId === 'TLEN') {
      const durationMs = parseInt(decodeID3Text(textBytes, encoding), 10);
      if (!isNaN(durationMs) && durationMs > 0) {
        meta.duration = Math.round(durationMs / 1000);
      }
    } else if (frameId === 'APIC') {
      // Attached Picture (Cover Art)
      try {
        let picOffset = 1;
        // Read null-terminated mime-type
        let mime = '';
        while (picOffset < frameData.length && frameData[picOffset] !== 0) {
          mime += String.fromCharCode(frameData[picOffset]);
          picOffset++;
        }
        picOffset++; // Skip null byte
        picOffset++; // Skip picture type byte

        // Skip description
        if (encoding === 0 || encoding === 3) {
          while (picOffset < frameData.length && frameData[picOffset] !== 0) {
            picOffset++;
          }
          picOffset++; // Skip null byte
        } else {
          while (picOffset + 1 < frameData.length && (frameData[picOffset] !== 0 || frameData[picOffset + 1] !== 0)) {
            picOffset += 2;
          }
          picOffset += 2;
        }

        if (picOffset < frameData.length) {
          const imgBytes = frameData.subarray(picOffset);
          // Convert to base64 data URL using 8KB chunks to prevent main-thread freeze
          const CHUNK_SIZE = 8192;
          let binary = '';
          const len = imgBytes.length;
          for (let i = 0; i < len; i += CHUNK_SIZE) {
            const chunk = imgBytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
          }
          const base64 = btoa(binary);
          meta.artwork = `data:${mime || 'image/jpeg'};base64,${base64}`;
        }
      } catch {
        // Skip corrupted artwork
      }
    } else if (frameId === 'USLT' || frameId === 'SYLT') {
      try {
        // Frame format: [encoding: 1B][language: 3B][descriptor (terminated)][lyrics text]
        if (frameData.length > 5) {
          let descOffset = 4;
          if (encoding === 0 || encoding === 3) {
            while (descOffset < frameData.length && frameData[descOffset] !== 0) {
              descOffset++;
            }
            descOffset++; // skip null byte
          } else {
            while (
              descOffset + 1 < frameData.length &&
              (frameData[descOffset] !== 0 || frameData[descOffset + 1] !== 0)
            ) {
              descOffset += 2;
            }
            descOffset += 2; // skip double null byte
          }
          if (descOffset < frameData.length) {
            const rawLyrics = decodeID3Text(frameData.subarray(descOffset), encoding);
            if (rawLyrics && rawLyrics.trim().length > 0) {
              meta.lyrics = rawLyrics.trim();
            }
          }
        }
      } catch {
        // Skip corrupted lyrics
      }
    }
  }

  return meta;
}

/**
 * Parses ID3v1 metadata from the last 128 bytes of an MP3 file
 */
async function parseID3v1(file: File | Blob): Promise<Partial<ParsedMetadata>> {
  const meta: Partial<ParsedMetadata> = {};
  if (file.size < 128) return meta;

  const slice = await file.slice(file.size - 128, file.size).arrayBuffer();
  const bytes = new Uint8Array(slice);

  // Magic 'TAG'
  if (bytes[0] === 0x54 && bytes[1] === 0x41 && bytes[2] === 0x47) {
    const title = new TextDecoder('iso-8859-1').decode(bytes.subarray(3, 33)).replace(/\0/g, '').trim();
    const artist = new TextDecoder('iso-8859-1').decode(bytes.subarray(33, 63)).replace(/\0/g, '').trim();
    const album = new TextDecoder('iso-8859-1').decode(bytes.subarray(63, 93)).replace(/\0/g, '').trim();
    const yearStr = new TextDecoder('iso-8859-1').decode(bytes.subarray(93, 97)).replace(/\0/g, '').trim();

    if (title) meta.title = title;
    if (artist) meta.artist = artist;
    if (album) meta.album = album;
    const yearNum = parseInt(yearStr, 10);
    if (!isNaN(yearNum)) meta.year = yearNum;
  }

  return meta;
}

/**
 * Calculates accurate audio duration using temporary Audio element with timeout
 */
function getAudioDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const timer = setTimeout(() => {
      cleanup();
      resolve(0);
    }, 2500);

    const cleanup = () => {
      clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.src = '';
      URL.revokeObjectURL(url);
    };

    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      cleanup();
      resolve(isFinite(dur) && dur > 0 ? Math.round(dur) : 0);
    };

    audio.onerror = () => {
      cleanup();
      resolve(0);
    };

    audio.src = url;
  });
}

/**
 * Main Metadata Extractor for Audio Files
 * Follows strict rule: If metadata is missing, set to 'Not set'. Never invent metadata.
 */
export async function extractAudioMetadata(file: File, relativePath?: string): Promise<ParsedMetadata> {
  // Step 1: Attempt ID3v2
  let v2: Partial<ParsedMetadata> = {};
  let v1: Partial<ParsedMetadata> = {};

  try {
    v2 = await parseID3v2(file);
  } catch {
    // Graceful fallback
  }

  // Step 2: Attempt ID3v1 if v2 missing core fields
  if (!v2.title || !v2.artist || !v2.album) {
    try {
      v1 = await parseID3v1(file);
    } catch {
      // Graceful fallback
    }
  }

  const title = v2.title || v1.title || cleanFileNameFallback(file.name);
  const artist = v2.artist || v1.artist || 'Not set';
  const album = v2.album || v1.album || 'Not set';
  const albumArtist = v2.albumArtist || undefined;
  const genre = v2.genre || undefined;
  const year = v2.year || v1.year || undefined;
  const trackNumber = v2.trackNumber || undefined;
  const discNumber = v2.discNumber || undefined;
  const artwork = v2.artwork || undefined;

  // Step 3: Duration resolution
  let duration = v2.duration || 0;
  if (!duration || duration <= 0) {
    duration = await getAudioDuration(file);
  }

  // Step 4: Bitrate estimation if duration and size exist
  let bitrate: number | undefined;
  if (duration > 0 && file.size > 0) {
    bitrate = Math.round((file.size * 8) / (duration * 1000));
  }

  return {
    title,
    artist,
    album,
    albumArtist,
    genre,
    year,
    trackNumber,
    discNumber,
    duration,
    bitrate,
    artwork,
    lyrics: v2.lyrics || undefined
  };
}
