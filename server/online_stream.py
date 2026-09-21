#!/usr/bin/env python3
import sys
import json
import subprocess

# Ensure UTF-8 standard output on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def search_tracks(query, limit=12):
    """
    Fast search for audio tracks on YouTube / YouTube Music.
    Uses --flat-playlist to return results in ~1-2 seconds without downloading video pages.
    """
    cmd = [
        sys.executable, '-m', 'yt_dlp',
        f'ytsearch{limit}:{query}',
        '--flat-playlist',
        '--dump-single-json',
        '--no-warnings',
        '--quiet'
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        if proc.returncode != 0 and not proc.stdout:
            return {'error': proc.stderr.strip() or 'Search failed'}
        
        data = json.loads(proc.stdout)
        entries = data.get('entries', [])
        results = []
        for e in entries:
            if not e:
                continue
            vid = e.get('id')
            if not vid:
                continue
            
            raw_title = e.get('title', 'Unknown Title')
            artist = e.get('uploader') or e.get('channel') or 'Artist'
            duration = int(e.get('duration') or 0)
            thumbnail = f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg'
            
            results.append({
                'id': vid,
                'title': raw_title,
                'artist': artist,
                'duration': duration,
                'thumbnail': thumbnail
            })
        return {'results': results}
    except Exception as err:
        return {'error': str(err)}

def get_stream_url(video_id):
    """
    Extracts the direct high-quality audio stream URL for a given video ID.
    Prefers m4a/AAC for universal hardware playback across Android/iOS/Web.
    """
    url = f'https://www.youtube.com/watch?v={video_id}'
    cmd = [
        sys.executable, '-m', 'yt_dlp',
        '-f', 'ba[ext=m4a]/ba/b',
        '-g',
        url,
        '--no-warnings',
        '--quiet'
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        if proc.returncode != 0 and not proc.stdout:
            return {'error': proc.stderr.strip() or 'Failed to extract stream URL'}
        
        lines = [line.strip() for line in proc.stdout.strip().split('\n') if line.strip().startswith('http')]
        if not lines:
            return {'error': 'No stream URL returned'}
        
        stream_url = lines[-1]
        return {'streamUrl': stream_url}
    except Exception as err:
        return {'error': str(err)}

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: online_stream.py [search|get_url] [args...]'}))
        sys.exit(1)
    
    action = sys.argv[1]
    if action == 'search':
        query = sys.argv[2]
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 12
        output = search_tracks(query, limit)
        print(json.dumps(output))
    elif action == 'get_url':
        video_id = sys.argv[2]
        output = get_stream_url(video_id)
        print(json.dumps(output))
    else:
        print(json.dumps({'error': f'Unknown action: {action}'}))
        sys.exit(1)

if __name__ == '__main__':
    main()
