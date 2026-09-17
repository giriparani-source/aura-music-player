package com.aura.musicplayer;

import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AuraMedia")
public class AuraMediaPlugin extends Plugin {
    private static AuraMediaPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
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
                android.provider.MediaStore.Audio.Media.DURATION,
                android.provider.MediaStore.Audio.Media.DATA,
                android.provider.MediaStore.Audio.Media.SIZE,
                android.provider.MediaStore.Audio.Media.DATE_ADDED
            };

            com.getcapacitor.JSArray tracks = new com.getcapacitor.JSArray();

            try (android.database.Cursor cursor = resolver.query(uri, projection, selection, null, sortOrder)) {
                if (cursor != null) {
                    int idCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media._ID);
                    int titleCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.TITLE);
                    int artistCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.ARTIST);
                    int albumCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.ALBUM);
                    int durCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.DURATION);
                    int dataCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.DATA);
                    int sizeCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.SIZE);
                    int dateCol = cursor.getColumnIndexOrThrow(android.provider.MediaStore.Audio.Media.DATE_ADDED);

                    while (cursor.moveToNext()) {
                        long id = cursor.getLong(idCol);
                        String title = cursor.getString(titleCol);
                        String artist = cursor.getString(artistCol);
                        String album = cursor.getString(albumCol);
                        long durationMs = cursor.getLong(durCol);
                        String path = cursor.getString(dataCol);
                        long size = cursor.getLong(sizeCol);
                        long dateAdded = cursor.getLong(dateCol);

                        android.net.Uri contentUri = android.content.ContentUris.withAppendedId(
                            android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id
                        );

                        com.getcapacitor.JSObject track = new com.getcapacitor.JSObject();
                        track.put("id", "device_" + id);
                        track.put("title", title != null ? title : "Unknown Title");
                        track.put("artist", (artist != null && !artist.contains("<unknown>")) ? artist : "Unknown Artist");
                        track.put("album", (album != null && !album.contains("<unknown>")) ? album : "Device Storage");
                        track.put("duration", Math.round(durationMs / 1000.0));
                        track.put("path", path != null ? path : contentUri.toString());
                        track.put("contentUri", contentUri.toString());
                        track.put("fileSize", size);
                        track.put("dateAdded", dateAdded * 1000L);
                        tracks.put(track);
                    }
                }
            }

            com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
            result.put("total", tracks.length());
            result.put("tracks", tracks);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to scan device audio: " + e.getMessage(), e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        instance = null;
        super.handleOnDestroy();
    }
}
