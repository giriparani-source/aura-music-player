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
      chunkSizeWarningLimit: 1500
    }
  };
});
