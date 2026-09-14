"""
scripts/generate_cloud_manifest.py

Scans G:\\My Drive\\songs 1 (or configured local music directory),
extracts metadata using TinyTag (title, artist, album, duration, format, size),
and generates a production-safe cloud_manifest.json.

Does NOT expose credentials or server secrets.
"""

import os
import sys
import json
import re
from tinytag import TinyTag

MUSIC_DIR = os.getenv("MUSIC_DIR", r"G:\My Drive\songs 1")
OUTPUT_MANIFEST = os.path.join(os.path.dirname(__file__), "..", "server", "data", "cloud_manifest.json")

os.makedirs(os.path.dirname(OUTPUT_MANIFEST), exist_ok=True)

def clean_tag(val, fallback):
    if not val:
        return fallback
    s = str(val).strip()
    # Remove common promotional tags
    s = re.sub(r'\s*-\s*MassTamilan\.(?:com|org|dev|in|fm|so)', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s*-\s*Isaimini\.(?:com|net|co|in)', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s*-\s*TamilWire\.(?:com|in)', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s*\[.*?\]', '', s)
    return s.strip() or fallback

def build_manifest():
    print(f"Scanning music directory: {MUSIC_DIR}")
    if not os.path.exists(MUSIC_DIR):
        print(f"ERROR: Music directory {MUSIC_DIR} does not exist!")
        return []

    manifest = []
    supported_exts = ('.mp3', '.opus', '.flac', '.wav', '.m4a')
    index = 1

    for root, dirs, files in os.walk(MUSIC_DIR):
        for f in sorted(files):
            ext = os.path.splitext(f)[1].lower()
            if ext not in supported_exts:
                continue

            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, MUSIC_DIR).replace('\\', '/')
            folder_name = os.path.dirname(rel_path) or 'Local Collection'

            # Default metadata from filename and directory
            raw_title = os.path.splitext(f)[0]
            cleaned_title = clean_tag(raw_title, raw_title)
            
            # Default artist from folder if it looks like an artist folder
            folder_artist = folder_name.split('/')[0] if folder_name else 'Tamil Artist'
            if 'Hit' in folder_artist or 'Special' in folder_artist or 'Track' in folder_artist or 'Melod' in folder_artist:
                default_artist = folder_artist.replace('Hits', '').replace('Special', '').replace('Tracks', '').strip() or 'Tamil Artist'
            else:
                default_artist = folder_artist

            duration = 180
            bitrate = 320
            artist = default_artist
            album = folder_name

            try:
                tag = TinyTag.get(full_path)
                if tag.title:
                    cleaned_title = clean_tag(tag.title, cleaned_title)
                if tag.artist:
                    artist = clean_tag(tag.artist, artist)
                if tag.album:
                    album = clean_tag(tag.album, album)
                if tag.duration and tag.duration > 0:
                    duration = int(round(tag.duration))
                if tag.bitrate and tag.bitrate > 0:
                    bitrate = int(round(tag.bitrate))
            except Exception as e:
                # If reading tags fails, keep the filename-based fallback
                pass

            file_size = 0
            try:
                file_size = os.path.getsize(full_path)
            except Exception:
                pass

            track_id = f"cloud_track_{index:04d}"
            
            song_record = {
                "id": track_id,
                "title": cleaned_title,
                "artist": artist,
                "album": album,
                "folder": folder_name,
                "duration": duration,
                "format": ext.replace('.', ''),
                "bitrate": bitrate,
                "fileSize": file_size,
                "cloudKey": rel_path,
                "path": rel_path,
                "fileName": f,
                "isOnline": False,
                "playCount": 0,
                "dateAdded": int(os.path.getmtime(full_path) * 1000) if os.path.exists(full_path) else 0,
                "isFavorite": False
            }

            manifest.append(song_record)
            index += 1
            if index % 50 == 0:
                print(f"Processed {index-1} tracks...")

    print(f"Total tracks in manifest: {len(manifest)}")
    with open(OUTPUT_MANIFEST, "w", encoding="utf-8") as out:
        json.dump(manifest, out, indent=2, ensure_ascii=False)
    print(f"Manifest written to {OUTPUT_MANIFEST}")
    return manifest

if __name__ == "__main__":
    build_manifest()
