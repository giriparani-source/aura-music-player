/**
 * server.js
 *
 * Production Express Server for Aura Music Player.
 * Mounts the modular server middlewares and serves the static production build.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  onlineSearchHandler,
  onlineStreamHandler,
  aiRouterHandler,
  jamRoomHandler,
  localAudioHandler,
  cloudManifestHandler,
  radioStreamHandler,
  spotifyPlaylistHandler,
  startJamRoomCleanup,
  initPythonCheck
} from './server/middleware/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize non-blocking Python check & Jam room cleanup timer
initPythonCheck();
startJamRoomCleanup();

// 1. Online Search Endpoint
app.use('/api/online/search', onlineSearchHandler);

// 2. Online Stream Proxy
app.use('/api/online/stream', onlineStreamHandler);

// 3. AI Unified Router (DJ / Insights / Chat)
app.use('/api/ai', aiRouterHandler);

// 4. WebRTC Jam Session Signaling
app.use('/api/jam', jamRoomHandler);

// 5. Audio Streaming Endpoint (Cloud Object Storage + Local Range Streaming)
app.use('/api/audio', localAudioHandler);

// 6. Cloud Library Manifest Catalog
app.use('/api/library/cloud-songs', cloudManifestHandler);

// 7. Live Radio FM Stream Proxy
app.use('/api/radio/stream', radioStreamHandler);

// 8. Universal Spotify Playlist Extractor Endpoint
app.use('/api/playlist/spotify', spotifyPlaylistHandler);

// Serve Static Frontend Bundle
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Aura Server] Running on http://0.0.0.0:${PORT} (Storage: ${process.env.STORAGE_PROVIDER || 'local'})`);
});
