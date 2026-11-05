package com.aura.musicplayer;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "AuraMedia")
public class AuraMediaPlugin extends Plugin {
    private static final String TAG = "AuraMediaPlugin";
    private static AuraMediaPlugin instance;

    // Embedded loopback HTTP receiver for streaming offline audio blobs to flash storage
    private ServerSocket localServerSocket;
    private int localServerPort = 0;
    private Thread localServerThread;

    @Override
    public void load() {
        super.load();
        instance = this;
        startLocalServer();
    }

    private synchronized void startLocalServer() {
        if (localServerSocket != null && !localServerSocket.isClosed()) return;
        localServerThread = new Thread(() -> {
            try {
                localServerSocket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
                localServerPort = localServerSocket.getLocalPort();
                Log.i(TAG, "Embedded offline audio receiver listening on 127.0.0.1:" + localServerPort);

                while (!localServerSocket.isClosed()) {
                    Socket clientSocket = localServerSocket.accept();
                    handleClientSocket(clientSocket);
                }
            } catch (Exception e) {
                if (localServerSocket != null && !localServerSocket.isClosed()) {
                    Log.w(TAG, "Local server socket encountered exception", e);
                }
            }
        });
        localServerThread.setDaemon(true);
        localServerThread.setName("Aura-OfflineAudioReceiver");
        localServerThread.start();
    }

    private void handleClientSocket(Socket socket) {
        new Thread(() -> {
            try {
                InputStream in = socket.getInputStream();
                OutputStream out = socket.getOutputStream();

                // Read HTTP header line by line until double CRLF
                ByteArrayOutputStream headerBytes = new ByteArrayOutputStream();
                int b;
                boolean matchedEnd = false;
                while ((b = in.read()) != -1) {
                    headerBytes.write(b);
                    byte[] raw = headerBytes.toByteArray();
                    int len = raw.length;
                    if (len >= 4 && raw[len - 4] == '\r' && raw[len - 3] == '\n' && raw[len - 2] == '\r' && raw[len - 1] == '\n') {
                        matchedEnd = true;
                        break;
                    }
                    if (len >= 2 && raw[len - 2] == '\n' && raw[len - 1] == '\n') {
                        matchedEnd = true;
                        break;
                    }
                    if (len > 8192) {
                        break; // header too large
                    }
                }

                if (!matchedEnd) {
                    socket.close();
                    return;
                }

                String headerStr = headerBytes.toString("UTF-8");
                String[] lines = headerStr.split("\r?\n");
                if (lines.length == 0) {
                    socket.close();
                    return;
                }

                String requestLine = lines[0];
                String[] parts = requestLine.split(" ");
                String method = parts.length > 0 ? parts[0] : "";
                String path = parts.length > 1 ? parts[1] : "";

                // CORS preflight
                if ("OPTIONS".equalsIgnoreCase(method)) {
                    String corsResponse = "HTTP/1.1 204 No Content\r\n" +
                            "Access-Control-Allow-Origin: *\r\n" +
                            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                            "Access-Control-Allow-Headers: *\r\n\r\n";
                    out.write(corsResponse.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    socket.close();
                    return;
                }

                long contentLength = -1;
                for (String line : lines) {
                    if (line.toLowerCase().startsWith("content-length:")) {
                        try {
                            contentLength = Long.parseLong(line.substring(15).trim());
                        } catch (Exception ignored) {}
                    }
                }

                if (path.startsWith("/save-offline") && "POST".equalsIgnoreCase(method)) {
                    String songId = "";
                    int qIdx = path.indexOf("id=");
                    if (qIdx != -1) {
                        songId = path.substring(qIdx + 3);
                        int ampIdx = songId.indexOf('&');
                        if (ampIdx != -1) {
                            songId = songId.substring(0, ampIdx);
                        }
                        songId = URLDecoder.decode(songId, "UTF-8");
                    }

                    if (!songId.isEmpty()) {
                        File offlineDir = new File(getContext().getFilesDir(), "offline_audio");
                        if (!offlineDir.exists()) offlineDir.mkdirs();
                        String safeId = songId.replaceAll("[^a-zA-Z0-9_-]", "_");
                        File tempFile = new File(offlineDir, safeId + ".tmp");
                        File targetFile = new File(offlineDir, safeId + ".audio");

                        FileOutputStream fos = new FileOutputStream(tempFile);
                        byte[] buffer = new byte[65536];

                        if (contentLength > 0) {
                            long remaining = contentLength;
                            while (remaining > 0) {
                                int toRead = (int) Math.min(buffer.length, remaining);
                                int read = in.read(buffer, 0, toRead);
                                if (read == -1) break;
                                fos.write(buffer, 0, read);
                                remaining -= read;
                            }
                        } else {
                            int read;
                            while ((read = in.read(buffer)) != -1) {
                                fos.write(buffer, 0, read);
                            }
                        }

                        fos.flush();
                        fos.close();

                        if (tempFile.length() > 0) {
                            if (targetFile.exists()) targetFile.delete();
                            tempFile.renameTo(targetFile);
                            Log.i(TAG, "Successfully cached offline audio file: " + targetFile.getAbsolutePath() + " (" + targetFile.length() + " bytes)");
                        } else {
                            tempFile.delete();
                        }

                        String okResp = "HTTP/1.1 200 OK\r\n" +
                                "Access-Control-Allow-Origin: *\r\n" +
                                "Content-Type: application/json\r\n" +
                                "Content-Length: 22\r\n\r\n" +
                                "{\"status\":\"ok\",\"saved\":true}";
                        out.write(okResp.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    } else {
                        String badResp = "HTTP/1.1 400 Bad Request\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 0\r\n\r\n";
                        out.write(badResp.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    }
                } else {
                    String notFoundResp = "HTTP/1.1 404 Not Found\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 0\r\n\r\n";
                    out.write(notFoundResp.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                }

                socket.close();
            } catch (Exception e) {
                Log.w(TAG, "Error handling offline audio sync socket: " + e.getMessage());
                try { socket.close(); } catch (Exception ignored) {}
            }
        }).start();
    }

    public static void dispatchMediaAction(String action, Double position) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("action", action);
            if (position != null) {
                data.put("position", position);
            }
            instance.notifyListeners("mediaAction", data);
        }
    }

    public static void dispatchPlaybackProgress(double position, double duration, boolean isPlaying) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("position", position);
            data.put("duration", duration);
            data.put("isPlaying", isPlaying);
            instance.notifyListeners("nativePlaybackProgress", data);
        }
    }

    @PluginMethod
    public void getOfflineServerPort(PluginCall call) {
        if (localServerPort <= 0) {
            startLocalServer();
        }
        JSObject ret = new JSObject();
        ret.put("port", localServerPort);
        call.resolve(ret);
    }

    @PluginMethod
    public void isOfflineTrackSaved(PluginCall call) {
        String id = call.getString("id", "");
        File offlineDir = new File(getContext().getFilesDir(), "offline_audio");
        String safeId = id.replaceAll("[^a-zA-Z0-9_-]", "_");
        File file = new File(offlineDir, safeId + ".audio");
        boolean exists = file.exists() && file.length() > 0;

        JSObject ret = new JSObject();
        ret.put("saved", exists);
        ret.put("filePath", exists ? file.getAbsolutePath() : "");
        ret.put("uri", exists ? "file://" + file.getAbsolutePath() : "");
        call.resolve(ret);
    }

    @PluginMethod
    public void playNativeTrack(PluginCall call) {
        String id = call.getString("id", "");
        String title = call.getString("title", "Aura Music");
        String artist = call.getString("artist", "Studio Master");
        String album = call.getString("album", "Aura Collection");
        String artwork = call.getString("artwork", "");
        String uri = call.getString("uri", "");
        Double durationSec = call.getDouble("duration", 0.0);
        Double positionSec = call.getDouble("position", 0.0);

        long durationMs = durationSec != null ? (long) (durationSec * 1000) : 0L;
        long positionMs = positionSec != null ? (long) (positionSec * 1000) : 0L;

        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_PLAY_NATIVE);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("artwork", artwork);
        intent.putExtra("uri", uri);
        intent.putExtra("duration", durationMs);
        intent.putExtra("position", positionMs);

        try {
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start native playback in AuraAudioService: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void pauseNative(PluginCall call) {
        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_PAUSE);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to pause native playback: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void resumeNative(PluginCall call) {
        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_PLAY);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to resume native playback: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void seekNative(PluginCall call) {
        Double positionSec = call.getDouble("position", 0.0);
        long posMs = positionSec != null ? (long) (positionSec * 1000) : 0L;

        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_SEEK);
        intent.putExtra("position", posMs);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to seek native playback: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopNative(PluginCall call) {
        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_STOP_NATIVE);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop native playback: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateTrack(PluginCall call) {
        String id = call.getString("id", "");
        String title = call.getString("title", "Aura Music");
        String artist = call.getString("artist", "Studio Master");
        String album = call.getString("album", "Aura Collection");
        String artwork = call.getString("artwork", "");
        Double durationSec = call.getDouble("duration", 0.0);
        Double positionSec = call.getDouble("position", 0.0);
        Boolean isPlaying = call.getBoolean("isPlaying", false);

        long durationMs = durationSec != null ? (long) (durationSec * 1000) : 0L;
        long positionMs = positionSec != null ? (long) (positionSec * 1000) : 0L;

        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_UPDATE_TRACK);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("artwork", artwork);
        intent.putExtra("duration", durationMs);
        intent.putExtra("position", positionMs);
        intent.putExtra("isPlaying", Boolean.TRUE.equals(isPlaying));

        try {
            if (Boolean.TRUE.equals(isPlaying)) {
                ContextCompat.startForegroundService(getContext(), intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start or update AuraAudioService: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        Boolean isPlaying = call.getBoolean("isPlaying", false);
        Double positionSec = call.getDouble("position", 0.0);
        Double durationSec = call.getDouble("duration", 0.0);

        long positionMs = positionSec != null ? (long) (positionSec * 1000) : 0L;
        long durationMs = durationSec != null ? (long) (durationSec * 1000) : 0L;

        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_UPDATE_TRACK);
        intent.putExtra("isPlaying", Boolean.TRUE.equals(isPlaying));
        intent.putExtra("position", positionMs);
        intent.putExtra("duration", durationMs);

        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update playback state: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), AuraAudioService.class);
        intent.setAction(AuraAudioService.ACTION_STOP);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void minimizeApp(PluginCall call) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                getActivity().moveTaskToBack(true);
            });
            call.resolve();
        } else {
            call.reject("Activity unavailable");
        }
    }

    @PluginMethod
    public void scanDeviceAudio(PluginCall call) {
        try {
            android.content.ContentResolver resolver = getContext().getContentResolver();
            android.net.Uri uri = android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            String selection = android.provider.MediaStore.Audio.Media.IS_MUSIC + " != 0";
            String sortOrder = android.provider.MediaStore.Audio.Media.TITLE + " ASC";

            String[] projection = new String[] {
                android.provider.MediaStore.Audio.Media._ID,
                android.provider.MediaStore.Audio.Media.TITLE,
                android.provider.MediaStore.Audio.Media.ARTIST,
                android.provider.MediaStore.Audio.Media.ALBUM,
                "album_id",
                android.provider.MediaStore.Audio.Media.DURATION,
                android.provider.MediaStore.Audio.Media.DATA,
                android.provider.MediaStore.Audio.Media.SIZE,
                android.provider.MediaStore.Audio.Media.DATE_ADDED,
                android.provider.MediaStore.Audio.Media.DATE_MODIFIED
            };

            JSArray tracks = new JSArray();

            try (android.database.Cursor cursor = resolver.query(uri, projection, selection, null, sortOrder)) {
                if (cursor != null) {
                    int idCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media._ID);
                    int titleCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.TITLE);
                    int artistCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.ARTIST);
                    int albumCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.ALBUM);
                    int albumIdCol = cursor.getColumnIndex("album_id");
                    int durCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.DURATION);
                    int dataCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.DATA);
                    int sizeCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.SIZE);
                    int dateCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.DATE_ADDED);
                    int dateModCol = cursor.getColumnIndex(android.provider.MediaStore.Audio.Media.DATE_MODIFIED);

                    while (cursor.moveToNext()) {
                        long id = cursor.getLong(idCol);
                        String title = cursor.getString(titleCol);
                        String artist = cursor.getString(artistCol);
                        String album = cursor.getString(albumCol);
                        long albumId = albumIdCol >= 0 ? cursor.getLong(albumIdCol) : 0;
                        long durationMs = cursor.getLong(durCol);
                        String rawPath = cursor.getString(dataCol);
                        long size = cursor.getLong(sizeCol);
                        long dateAdded = cursor.getLong(dateCol);
                        long dateModified = dateModCol >= 0 ? cursor.getLong(dateModCol) : 0;

                        android.net.Uri contentUri = android.content.ContentUris.withAppendedId(
                            android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id
                        );

                        // Extract real album artwork (deprecated albumart content URI broken on Android 10+)
                        String artworkPath = extractAndCacheArtwork(resolver, contentUri, albumId, id);

                        String folder = "Phone Audio";
                        if (rawPath != null) {
                            try {
                                java.io.File file = new java.io.File(rawPath);
                                java.io.File parent = file.getParentFile();
                                if (parent != null && parent.getName() != null && !parent.getName().isEmpty()) {
                                    folder = parent.getName();
                                }
                            } catch (Exception ignored) {}
                        }

                        JSObject track = new JSObject();
                        track.put("id", "device_" + id);
                        track.put("title", title != null ? title : "Unknown Title");
                        track.put("artist", (artist != null && !artist.contains("<unknown>")) ? artist : "Unknown Artist");
                        track.put("album", (album != null && !album.contains("<unknown>")) ? album : "Device Storage");
                        track.put("duration", Math.round(durationMs / 1000.0));
                        // Always provide contentUri so Scoped Storage permission errors never occur
                        track.put("path", contentUri.toString());
                        track.put("filePath", contentUri.toString());
                        track.put("rawFileSystemPath", rawPath != null ? rawPath : "");
                        track.put("contentUri", contentUri.toString());
                        track.put("artwork", artworkPath);
                        track.put("coverArt", artworkPath);
                        track.put("folder", folder);
                        track.put("fileSize", size);
                        track.put("dateAdded", dateAdded * 1000L);
                        track.put("dateModified", dateModified * 1000L);
                        tracks.put(track);
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("total", tracks.length());
            result.put("tracks", tracks);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to scan device audio: " + e.getMessage(), e);
        }
    }

    // LRU Cache: albumId -> cached file path, bounded to 500 entries to prevent memory leaks on 2GB RAM devices
    private final java.util.Map<Long, String> artworkCache = java.util.Collections.synchronizedMap(
        new java.util.LinkedHashMap<Long, String>(128, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(java.util.Map.Entry<Long, String> eldest) {
                return size() > 500;
            }
        }
    );

    /**
     * Extract album artwork using Android 10+ loadThumbnail API with MediaMetadataRetriever fallback.
     * Caches artwork per album as WebP files in app cache directory.
     * Returns a file:// path usable by Capacitor.convertFileSrc(), or empty string for fallback.
     */
    private String extractAndCacheArtwork(android.content.ContentResolver resolver,
                                           android.net.Uri contentUri, long albumId, long trackId) {
        // Check in-memory cache first (per album to avoid re-extracting for every track)
        if (artworkCache.containsKey(albumId)) {
            return artworkCache.get(albumId);
        }

        String result = "";
        java.io.File cacheDir = new java.io.File(getContext().getCacheDir(), "album_art");
        if (!cacheDir.exists()) cacheDir.mkdirs();
        java.io.File artFile = new java.io.File(cacheDir, "album_" + albumId + ".webp");

        // If already cached on disk from a previous session, reuse it
        if (artFile.exists() && artFile.length() > 0) {
            result = artFile.getAbsolutePath();
            artworkCache.put(albumId, result);
            return result;
        }

        android.graphics.Bitmap bitmap = null;

        // Method 1: Android 10+ ContentResolver.loadThumbnail (bounded to 256x256 for 2GB low-end devices)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                bitmap = resolver.loadThumbnail(contentUri,
                        new android.util.Size(256, 256), null);
            } catch (Exception e) {
                Log.d(TAG, "loadThumbnail failed for track " + trackId + ": " + e.getMessage());
            }
        }

        // Method 2: MediaMetadataRetriever (with inSampleSize downsampling and RGB_565 50% RAM savings)
        if (bitmap == null) {
            android.media.MediaMetadataRetriever mmr = new android.media.MediaMetadataRetriever();
            try {
                mmr.setDataSource(getContext(), contentUri);
                byte[] artBytes = mmr.getEmbeddedPicture();
                if (artBytes != null && artBytes.length > 0) {
                    android.graphics.BitmapFactory.Options opts = new android.graphics.BitmapFactory.Options();
                    opts.inJustDecodeBounds = true;
                    android.graphics.BitmapFactory.decodeByteArray(artBytes, 0, artBytes.length, opts);

                    int targetDim = 256;
                    int sampleSize = 1;
                    if (opts.outHeight > targetDim || opts.outWidth > targetDim) {
                        int halfH = opts.outHeight / 2;
                        int halfW = opts.outWidth / 2;
                        while ((halfH / sampleSize) >= targetDim && (halfW / sampleSize) >= targetDim) {
                            sampleSize *= 2;
                        }
                    }
                    opts.inSampleSize = sampleSize;
                    opts.inJustDecodeBounds = false;
                    opts.inPreferredConfig = android.graphics.Bitmap.Config.RGB_565; // 2 bytes/px instead of 4
                    bitmap = android.graphics.BitmapFactory.decodeByteArray(artBytes, 0, artBytes.length, opts);
                }
            } catch (Exception e) {
                Log.d(TAG, "MediaMetadataRetriever failed for track " + trackId + ": " + e.getMessage());
            } finally {
                try { mmr.release(); } catch (Exception ignored) {}
            }
        }

        // Save to cache file if we got a bitmap
        if (bitmap != null) {
            try (FileOutputStream fos = new FileOutputStream(artFile)) {
                // Compress as WebP for smaller file size
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    bitmap.compress(android.graphics.Bitmap.CompressFormat.WEBP_LOSSY, 80, fos);
                } else {
                    bitmap.compress(android.graphics.Bitmap.CompressFormat.WEBP, 80, fos);
                }
                fos.flush();
                result = artFile.getAbsolutePath();
            } catch (Exception e) {
                Log.w(TAG, "Failed to cache artwork for album " + albumId, e);
            } finally {
                bitmap.recycle();
            }
        }

        artworkCache.put(albumId, result);
        return result;
    }

    @Override
    protected void handleOnDestroy() {
        if (localServerSocket != null) {
            try {
                localServerSocket.close();
            } catch (Exception ignored) {}
        }
        artworkCache.clear();
        instance = null;
        super.handleOnDestroy();
    }
}
