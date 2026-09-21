package com.aura.musicplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Drawable;
import android.media.AudioManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import com.bumptech.glide.Glide;
import com.bumptech.glide.request.target.CustomTarget;
import com.bumptech.glide.request.transition.Transition;

public class AuraAudioService extends Service {
    private static final String TAG = "AuraAudioService";
    public static final String CHANNEL_ID = "aura_music_playback_channel";
    public static final int NOTIFICATION_ID = 1001;

    // Actions
    public static final String ACTION_PLAY = "com.aura.musicplayer.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.aura.musicplayer.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.aura.musicplayer.ACTION_NEXT";
    public static final String ACTION_PREV = "com.aura.musicplayer.ACTION_PREV";
    public static final String ACTION_STOP = "com.aura.musicplayer.ACTION_STOP";
    public static final String ACTION_SEEK = "com.aura.musicplayer.ACTION_SEEK";
    public static final String ACTION_UPDATE_TRACK = "com.aura.musicplayer.ACTION_UPDATE_TRACK";

    // Track State
    private String trackId = "";
    private String trackTitle = "Aura Music";
    private String trackArtist = "Studio Master";
    private String trackAlbum = "Aura Collection";
    private String artworkUrl = "";
    private long trackDurationMs = 0;
    private long currentPositionMs = 0;
    private boolean isPlaying = false;
    private boolean isForegroundActive = false;
    private Bitmap currentArtworkBitmap = null;

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private AudioManager audioManager;

    // Call interruption monitoring without competing with Chromium WebView for AudioFocus
    private boolean wasInterruptedByCall = false;
    private final Runnable callStateCheckRunnable = new Runnable() {
        @Override
        public void run() {
            if (audioManager != null) {
                int mode = audioManager.getMode();
                boolean isCallActive = (mode == AudioManager.MODE_IN_CALL ||
                                        mode == AudioManager.MODE_RINGTONE ||
                                        mode == AudioManager.MODE_IN_COMMUNICATION);

                if (isCallActive) {
                    if (isPlaying) {
                        Log.d(TAG, "Phone call / ringtone detected (mode=" + mode + ") -> pausing music");
                        wasInterruptedByCall = true;
                        triggerMediaAction("pause", null);
                    }
                } else if (wasInterruptedByCall) {
                    Log.d(TAG, "Phone call ended (mode=MODE_NORMAL) -> auto-resuming music");
                    wasInterruptedByCall = false;
                    mainHandler.postDelayed(() -> {
                        triggerMediaAction("play", null);
                        acquireLocks();
                        startHeartbeat();
                    }, 600);
                }
            }

            if (isPlaying || wasInterruptedByCall) {
                mainHandler.postDelayed(this, 1000L);
            }
        }
    };

    private void startCallStateMonitoring() {
        mainHandler.removeCallbacks(callStateCheckRunnable);
        mainHandler.post(callStateCheckRunnable);
    }

    private void stopCallStateMonitoring() {
        mainHandler.removeCallbacks(callStateCheckRunnable);
        wasInterruptedByCall = false;
    }

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Heartbeat: fires every 20s to keep WakeLock, WifiLock, and foreground service alive.
    // Prevents Android Battery Optimizer and LMK from killing the service mid-playlist.
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL_MS = 20_000L;

    private final BroadcastReceiver noisyAudioReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                Log.d(TAG, "Audio becoming noisy (headphone/bluetooth disconnected) -> pausing playback");
                triggerMediaAction("pause", null);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        createNotificationChannel();
        initMediaSession();
        initLocks();

        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(noisyAudioReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(noisyAudioReceiver, filter);
        }
    }

    private void initLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AuraMusic:PlaybackWakeLock");
                wakeLock.setReferenceCounted(false);
            }

            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "AuraMusic:WifiLock");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to initialize wake/wifi locks", e);
        }
    }

    private void acquireLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(); // Continuous wakelock held for active playback
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception e) {
            Log.w(TAG, "Error acquiring locks", e);
        }
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Error releasing locks", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Aura Music Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active playback controls, track title, and album art");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, TAG);
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                triggerMediaAction("play", null);
            }

            @Override
            public void onPause() {
                triggerMediaAction("pause", null);
            }

            @Override
            public void onSkipToNext() {
                triggerMediaAction("next", null);
            }

            @Override
            public void onSkipToPrevious() {
                triggerMediaAction("previous", null);
            }

            @Override
            public void onSeekTo(long pos) {
                triggerMediaAction("seek", (double) (pos / 1000.0));
            }

            @Override
            public void onStop() {
                triggerMediaAction("pause", null);
                stopServiceInternal();
            }
        });

        mediaSession.setActive(true);
    }

    private void triggerMediaAction(String action, Double position) {
        AuraMediaPlugin.dispatchMediaAction(action, position);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (action == null) return START_STICKY;

        switch (action) {
            case ACTION_PLAY:
                triggerMediaAction("play", null);
                break;
            case ACTION_PAUSE:
                triggerMediaAction("pause", null);
                break;
            case ACTION_NEXT:
                triggerMediaAction("next", null);
                break;
            case ACTION_PREV:
                triggerMediaAction("previous", null);
                break;
            case ACTION_STOP:
                triggerMediaAction("pause", null);
                stopServiceInternal();
                break;
            case ACTION_SEEK:
                long seekPos = intent.getLongExtra("position", 0);
                triggerMediaAction("seek", (double) (seekPos / 1000.0));
                break;
            case ACTION_UPDATE_TRACK:
                handleTrackUpdate(intent);
                break;
        }

        return START_STICKY;
    }

    private void handleTrackUpdate(Intent intent) {
        String newId = intent.getStringExtra("id");
        String newTitle = intent.getStringExtra("title");
        String newArtist = intent.getStringExtra("artist");
        String newAlbum = intent.getStringExtra("album");
        String newArtwork = intent.getStringExtra("artwork");
        long newDuration = intent.getLongExtra("duration", 0);
        long newPosition = intent.getLongExtra("position", 0);
        boolean newIsPlaying = intent.getBooleanExtra("isPlaying", false);

        if (newTitle != null) this.trackTitle = newTitle;
        if (newArtist != null) this.trackArtist = newArtist;
        if (newAlbum != null) this.trackAlbum = newAlbum;
        this.trackDurationMs = newDuration;
        this.currentPositionMs = newPosition;
        this.isPlaying = newIsPlaying;

        if (isPlaying) {
            startCallStateMonitoring();
            acquireLocks();
            startHeartbeat();
        } else {
            // Do NOT release locks or stop heartbeat on temporary pauses.
            // The heartbeat will keep the service alive during song transitions.
            // Only stopServiceInternal() should tear down everything.
            stopHeartbeat();
            releaseLocks();
        }

        updatePlaybackStateCompat();

        // Check if artwork changed
        boolean artworkChanged = (newArtwork != null && !newArtwork.equals(this.artworkUrl)) || !this.trackId.equals(newId);
        if (newId != null) this.trackId = newId;

        if (artworkChanged) {
            this.artworkUrl = newArtwork != null ? newArtwork : "";
            loadArtworkAndPublishNotification();
        } else {
            publishNotification();
        }
    }

    private void updatePlaybackStateCompat() {
        if (mediaSession == null) return;

        long actions = PlaybackStateCompat.ACTION_PLAY |
                       PlaybackStateCompat.ACTION_PAUSE |
                       PlaybackStateCompat.ACTION_PLAY_PAUSE |
                       PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                       PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                       PlaybackStateCompat.ACTION_SEEK_TO;

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, currentPositionMs, 1.0f);

        mediaSession.setPlaybackState(stateBuilder.build());
    }

    private void loadArtworkAndPublishNotification() {
        // Immediately publish notification with current/placeholder art to satisfy startForeground() within 5s!
        publishNotification();

        if (artworkUrl == null || artworkUrl.trim().isEmpty()) {
            currentArtworkBitmap = null;
            return;
        }

        mainHandler.post(() -> {
            try {
                Glide.with(getApplicationContext())
                        .asBitmap()
                        .load(artworkUrl)
                        .into(new CustomTarget<Bitmap>() {
                            @Override
                            public void onResourceReady(@NonNull Bitmap resource, @Nullable Transition<? super Bitmap> transition) {
                                currentArtworkBitmap = resource;
                                updateMediaMetadataCompat();
                                publishNotification();
                            }

                            @Override
                            public void onLoadCleared(@Nullable Drawable placeholder) {
                                currentArtworkBitmap = null;
                            }

                            @Override
                            public void onLoadFailed(@Nullable Drawable errorDrawable) {
                                currentArtworkBitmap = null;
                                updateMediaMetadataCompat();
                                publishNotification();
                            }
                        });
            } catch (Exception e) {
                Log.w(TAG, "Error loading notification artwork", e);
            }
        });
    }

    private void updateMediaMetadataCompat() {
        if (mediaSession == null) return;

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, trackTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, trackArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, trackAlbum)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, trackDurationMs);

        if (currentArtworkBitmap != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtworkBitmap);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, currentArtworkBitmap);
        }

        mediaSession.setMetadata(metaBuilder.build());
    }

    private void publishNotification() {
        updateMediaMetadataCompat();
        Notification notification = buildNotification();

        // Always keep the service in foreground while a song is loaded (even when briefly paused).
        // Dropping foreground during a song transition gives Android's LMK a window to kill us,
        // which is why playback stops after ~3 songs. We only drop foreground when user fully stops.
        try {
            if (!isForegroundActive) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
                isForegroundActive = true;
            } else if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.w(TAG, "Foreground notification notice: " + e.getMessage());
            if (notificationManager != null) {
                try {
                    notificationManager.notify(NOTIFICATION_ID, notification);
                } catch (Exception ignored) {}
            }
        }
    }

    private Notification buildNotification() {
        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingContentIntent = PendingIntent.getActivity(
                this, 0, contentIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent prevIntent = PendingIntent.getService(
                this, 1, new Intent(this, AuraAudioService.class).setAction(ACTION_PREV),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent playPauseIntent = PendingIntent.getService(
                this, 2, new Intent(this, AuraAudioService.class).setAction(isPlaying ? ACTION_PAUSE : ACTION_PLAY),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent nextIntent = PendingIntent.getService(
                this, 3, new Intent(this, AuraAudioService.class).setAction(ACTION_NEXT),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int playPauseIcon = isPlaying ? R.drawable.ic_action_pause : R.drawable.ic_action_play;
        String playPauseTitle = isPlaying ? "Pause" : "Play";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_music)
                .setContentTitle(trackTitle)
                .setContentText(trackArtist + " • " + trackAlbum)
                .setContentIntent(pendingContentIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .addAction(R.drawable.ic_action_previous, "Previous", prevIntent)
                .addAction(playPauseIcon, playPauseTitle, playPauseIntent)
                .addAction(R.drawable.ic_action_next, "Next", nextIntent)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2)
                );

        if (currentArtworkBitmap != null) {
            builder.setLargeIcon(currentArtworkBitmap);
        } else {
            try {
                Bitmap fallbackLogo = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
                if (fallbackLogo != null) {
                    builder.setLargeIcon(fallbackLogo);
                }
            } catch (Exception ignored) {}
        }

        return builder.build();
    }

    private void startHeartbeat() {
        stopHeartbeat(); // Clear any existing heartbeat first
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (isPlaying) {
                    Log.d(TAG, "Heartbeat: keeping wakelock and foreground service alive");
                    acquireLocks();
                    // Re-post the notification to prevent Android from marking service as stale
                    if (isForegroundActive && notificationManager != null) {
                        notificationManager.notify(NOTIFICATION_ID, buildNotification());
                    }
                    mainHandler.postDelayed(this, HEARTBEAT_INTERVAL_MS);
                } else {
                    Log.d(TAG, "Heartbeat: playback stopped, halting heartbeat");
                }
            }
        };
        mainHandler.postDelayed(heartbeatRunnable, HEARTBEAT_INTERVAL_MS);
    }

    private void stopHeartbeat() {
        if (heartbeatRunnable != null) {
            mainHandler.removeCallbacks(heartbeatRunnable);
            heartbeatRunnable = null;
        }
    }

    private void stopServiceInternal() {
        stopCallStateMonitoring();
        stopHeartbeat();
        releaseLocks();
        isPlaying = false;
        isForegroundActive = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(noisyAudioReceiver);
        } catch (Exception ignored) {}

        stopCallStateMonitoring();
        stopHeartbeat();
        releaseLocks();

        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }

        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
