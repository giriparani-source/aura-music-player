import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  onlineSearchHandler,
  onlineStreamHandler,
  aiRouterHandler,
  jamRoomHandler,
  startJamRoomCleanup,
  localAudioHandler,
  cloudManifestHandler,
  radioStreamHandler,
  spotifyPlaylistHandler,
  initPythonCheck
} from './server/middleware/index.ts';

function localMusicServerPlugin() {
  return {
    name: 'local-music-server',
    configureServer(server: any) {
      // Check Python availability once on startup (non-blocking)
      initPythonCheck();

      // 1. Online YouTube Search Endpoint (Fast Native + Python Fallback)
      server.middlewares.use('/api/online/search', onlineSearchHandler);

      // 2. Online Stream Proxy Endpoint
      server.middlewares.use('/api/online/stream', onlineStreamHandler);

      // 3. AI Unified Router (DJ / Insights / Chat)
      server.middlewares.use('/api/ai', aiRouterHandler);

      // 4. WebRTC Social Jam (Listen Together) Backend
      startJamRoomCleanup();
      server.middlewares.use('/api/jam', jamRoomHandler);

      // 5. Local / Cloud Library Audio Endpoint
      server.middlewares.use('/api/audio', localAudioHandler);

      // 6. Cloud Library Manifest Endpoint
      server.middlewares.use('/api/library/cloud-songs', cloudManifestHandler);

      // 7. Live Radio FM Stream Proxy (Shoutcast / Icecast / Mixed Content bypass)
      server.middlewares.use('/api/radio/stream', radioStreamHandler);

      // 8. Universal Spotify Playlist Extractor Endpoint
      server.middlewares.use('/api/playlist/spotify', spotifyPlaylistHandler);
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.MUSIC_DIR) {
    process.env.MUSIC_DIR = env.MUSIC_DIR;
  }

  return {
    plugins: [react(), tailwindcss(), localMusicServerPlugin()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      open: false,
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('peerjs')) {
                return 'vendor-peerjs';
              }
              if (id.includes('zustand')) {
                return 'vendor-store';
              }
            }
          }
        }
      }
    }
  };
});
