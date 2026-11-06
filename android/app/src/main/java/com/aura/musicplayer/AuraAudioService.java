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
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
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
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

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
    public static final String ACTION_PLAY_NATIVE = "com.aura.musicplayer.ACTION_PLAY_NATIVE";
    public static final String ACTION_STOP_NATIVE = "com.aura.musicplayer.ACTION_STOP_NATIVE";

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

    // Native ExoPlayer Engine
    private ExoPlayer exoPlayer;
    private boolean isNativePlayerActive = false;
    private String currentMediaUri = "";

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private AudioManager audioManager;

    // Audio Focus & Phone Call State Management
    private boolean wasPlayingBeforeCall = false;
    private boolean isPausedByCall = false;
    private long savedPositionBeforeCall = -1L;
    private long callStartTimeMs = 0L;
    private AudioFocusRequest audioFocusRequest;

    // Queue Transition State & Bounded Locks (Android Screen-Off Continuous Progression)
    private boolean isQueueTransitioning = false;
    private static final long QUEUE_TRANSITION_TIMEOUT_MS = 25_000L;
    private final Runnable transitionTimeoutRunnable = new Runnable() {
        @Override
        public void run() {
            if (isQueueTransitioning) {
                Log.w(TAG, "Queue transition timed out after " + QUEUE_TRANSITION_TIMEOUT_MS + "ms without next track -> releasing transition locks");
                isQueueTransitioning = false;
                releaseLocks();
            }
        }
    };

    private void startQueueTransition() {
        if (isQueueTransitioning) {
            Log.d(TAG, "Queue transition already active -> ignoring duplicate start");
            return;
        }
        Log.i(TAG, "Starting bounded queue transition window (" + QUEUE_TRANSITION_TIMEOUT_MS + "ms)");
        isQueueTransitioning = true;
        acquireTransitionLocks();
        mainHandler.removeCallbacks(transitionTimeoutRunnable);
        mainHandler.postDelayed(transitionTimeoutRunnable, QUEUE_TRANSITION_TIMEOUT_MS);
    }

    private void cancelQueueTransition() {
        if (isQueueTransitioning) {
            Log.d(TAG, "Cancelling queue transition window");
            isQueueTransitioning = false;
        }
        mainHandler.removeCallbacks(transitionTimeoutRunnable);
    }

    private void acquireTransitionLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(QUEUE_TRANSITION_TIMEOUT_MS + 5000);
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception e) {
            Log.w(TAG, "Error acquiring transition locks", e);
        }
    }

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Handler progressHandler = new Handler(Looper.getMainLooper());

    // Audio Focus Listener for Phone Calls & System Audio Interruptions
    private final AudioManager.OnAudioFocusChangeListener audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int focusChange) {
            switch (focusChange) {
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    handleTransientFocusLoss();
                    break;
                case AudioManager.AUDIOFOCUS_GAIN:
                    handleFocusGain();
                    break;
                case AudioManager.AUDIOFOCUS_LOSS:
                    handlePermanentFocusLoss();
                    break;
            }
        }
    };

    private void handleTransientFocusLoss() {
        Log.i(TAG, "Audio focus lost transiently (call/ringtone). isPlaying=" + isPlaying + ", isNativePlayerActive=" + isNativePlayerActive);

        long currentPos = (isNativePlayerActive && exoPlayer != null) ? exoPlayer.getCurrentPosition() : currentPositionMs;
        if (currentPos > 0) {
            savedPositionBeforeCall = currentPos;
        }

        if (isPlaying) {
            wasPlayingBeforeCall = true;
            isPausedByCall = true;
            callStartTimeMs = System.currentTimeMillis();

            Log.i(TAG, "Phone call active: auto-pausing music at " + savedPositionBeforeCall + "ms. Auto-resume queued for call completion.");

            if (isNativePlayerActive && exoPlayer != null) {
                exoPlayer.pause();
            }
            isPlaying = false;
            updatePlaybackStateCompat();
            publishNotification();

            if (savedPositionBeforeCall > 0) {
                AuraMediaPlugin.dispatchPlaybackProgress((double) savedPositionBeforeCall / 1000.0, (double) trackDurationMs / 1000.0, false);
            }
            triggerMediaAction("call_pause", savedPositionBeforeCall > 0 ? (double) (savedPositionBeforeCall / 1000.0) : null);
        } else {
            // Requirement 5: If manually paused before the call, do NOT automatically resume it!
            Log.i(TAG, "Audio focus lost transiently, but music was already paused by user -> do NOT mark for auto-resume.");
            wasPlayingBeforeCall = false;
            isPausedByCall = false;
        }
    }

    private void handleFocusGain() {
        Log.i(TAG, "Audio focus gained. wasPlayingBeforeCall=" + wasPlayingBeforeCall + ", isPausedByCall=" + isPausedByCall);

        if (isPausedByCall && wasPlayingBeforeCall) {
            long callDurationMs = (callStartTimeMs > 0) ? (System.currentTimeMillis() - callStartTimeMs) : 0L;
            Log.i(TAG, "Phone call ended (call duration: " + (callDurationMs / 1000) + "s) -> auto-resuming from exact position " + savedPositionBeforeCall + "ms");

            isPausedByCall = false;
            wasPlayingBeforeCall = false;
            callStartTimeMs = 0L;

            resumePlaybackAfterCall(savedPositionBeforeCall);
        } else {
            Log.i(TAG, "Audio focus gained, but user was paused before or during call -> preserving paused state");
            isPausedByCall = false;
            wasPlayingBeforeCall = false;
        }
    }

    private void handlePermanentFocusLoss() {
        Log.i(TAG, "Audio focus lost permanently (another media player took focus).");
        isPausedByCall = false;
        wasPlayingBeforeCall = false;
        if (isNativePlayerActive && exoPlayer != null) {
            exoPlayer.pause();
        }
        isPlaying = false;
        updatePlaybackStateCompat();
        publishNotification();
        releaseLocks();
        triggerMediaAction("pause", null);
    }

    private boolean requestAudioFocusInternal() {
        if (audioManager == null) return false;
        try {
            int result;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (audioFocusRequest == null) {
                    android.media.AudioAttributes playbackAttributes = new android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build();

                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                            .setAudioAttributes(playbackAttributes)
                            .setAcceptsDelayedFocusGain(false)
                            .setOnAudioFocusChangeListener(audioFocusChangeListener, mainHandler)
                            .setWillPauseWhenDucked(true)
                            .build();
                }
                result = audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                result = audioManager.requestAudioFocus(
                        audioFocusChangeListener,
                        AudioManager.STREAM_MUSIC,
                        AudioManager.AUDIOFOCUS_GAIN
                );
            }
            return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } catch (Exception e) {
            Log.w(TAG, "Error requesting audio focus", e);
            return false;
        }
    }

    private void abandonAudioFocusInternal() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                }
            } else {
                audioManager.abandonAudioFocus(audioFocusChangeListener);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error abandoning audio focus", e);
        }
    }

    private void resumePlaybackAfterCall(long targetPositionMs) {
        if (!isNativePlayerActive || exoPlayer == null) {
            triggerMediaAction("call_resume", targetPositionMs > 0 ? (double) (targetPositionMs / 1000.0) : null);
            return;
        }

        acquireLocks();
        startHeartbeat();
        requestAudioFocusInternal();

        int state = exoPlayer.getPlaybackState();
        Log.i(TAG, "Resuming native ExoPlayer after call. Current state=" + state + ", targetPosition=" + targetPositionMs + "ms");

        try {
            if (state == Player.STATE_IDLE || exoPlayer.getPlayerError() != null) {
                Log.w(TAG, "ExoPlayer idle/error after call -> re-preparing track at " + targetPositionMs + "ms");
                if (currentMediaUri != null && !currentMediaUri.trim().isEmpty()) {
                    String sanitized = sanitizeCapacitorUri(currentMediaUri);
                    Uri mediaUri = sanitized.startsWith("/")
                            ? Uri.parse("file://" + sanitized)
                            : Uri.parse(sanitized);
                    MediaItem mediaItem = MediaItem.fromUri(mediaUri);
                    exoPlayer.setMediaItem(mediaItem, false);
                }
                if (targetPositionMs > 0) {
                    exoPlayer.seekTo(targetPositionMs);
                }
                exoPlayer.prepare();
            } else {
                if (targetPositionMs > 0) {
                    long current = exoPlayer.getCurrentPosition();
                    if (Math.abs(current - targetPositionMs) > 1000) {
                        Log.i(TAG, "Correcting position drift: " + current + "ms -> " + targetPositionMs + "ms");
                        exoPlayer.seekTo(targetPositionMs);
                    }
                }
            }

            exoPlayer.play();
            isPlaying = true;
            updatePlaybackStateCompat();
            publishNotification();

            startCallStateMonitoring();
            progressHandler.removeCallbacks(progressRunnable);
            progressHandler.post(progressRunnable);

            if (targetPositionMs > 0) {
                AuraMediaPlugin.dispatchPlaybackProgress((double) targetPositionMs / 1000.0, (double) trackDurationMs / 1000.0, true);
            }
            triggerMediaAction("call_resume", targetPositionMs > 0 ? (double) (targetPositionMs / 1000.0) : null);
        } catch (Exception e) {
            Log.e(TAG, "Error resuming native playback after call", e);
            triggerMediaAction("call_recovery_reload", (double) (targetPositionMs / 1000.0));
        }
    }

    // Secondary Call State Monitor (Defense-in-depth polling)
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
                        Log.d(TAG, "Phone call / ringtone detected via audio mode polling (mode=" + mode + ")");
                        handleTransientFocusLoss();
                    }
                } else if (isPausedByCall && wasPlayingBeforeCall) {
                    Log.d(TAG, "Phone call ended detected via audio mode polling (mode=MODE_NORMAL)");
                    handleFocusGain();
                }
            }

            if (isPlaying || isPausedByCall) {
                mainHandler.postDelayed(this, 1000L);
            }
        }
    };

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (isNativePlayerActive && exoPlayer != null && isPlaying) {
                long pos = exoPlayer.getCurrentPosition();
                long dur = exoPlayer.getDuration();
                if (dur <= 0) dur = trackDurationMs;
                currentPositionMs = pos;
                AuraMediaPlugin.dispatchPlaybackProgress((double) pos / 1000.0, (double) dur / 1000.0, isPlaying);
                updatePlaybackStateCompat();
                progressHandler.postDelayed(this, 500L);
            }
        }
    };

    private void startCallStateMonitoring() {
        mainHandler.removeCallbacks(callStateCheckRunnable);
        mainHandler.post(callStateCheckRunnable);
    }

    private void stopCallStateMonitoring() {
        mainHandler.removeCallbacks(callStateCheckRunnable);
    }

    // Heartbeat: fires every 20s to keep WakeLock, WifiLock, and foreground service alive
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL_MS = 20_000L;

    private final BroadcastReceiver noisyAudioReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                Log.d(TAG, "Audio becoming noisy (headphone/bluetooth disconnected) -> pausing playback");
                wasPlayingBeforeCall = false;
                isPausedByCall = false;
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.pause();
                }
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
        initExoPlayer();

        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(noisyAudioReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(noisyAudioReceiver, filter);
        }
    }

    private void initExoPlayer() {
        if (exoPlayer != null) return;
        try {
            DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                    .setAllowCrossProtocolRedirects(true)
                    .setConnectTimeoutMs(15000)
                    .setReadTimeoutMs(15000)
                    .setUserAgent("Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36");

            java.util.Map<String, String> defaultHeaders = new java.util.HashMap<>();
            defaultHeaders.put("Referer", "https://www.youtube.com/");
            defaultHeaders.put("Origin", "https://www.youtube.com");
            httpDataSourceFactory.setDefaultRequestProperties(defaultHeaders);

            DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this, httpDataSourceFactory);
            exoPlayer = new ExoPlayer.Builder(this)
                    .setMediaSourceFactory(new DefaultMediaSourceFactory(dataSourceFactory))
                    .build();
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build();
            // Handle audio focus explicitly in AuraAudioService to ensure custom long-call recovery & manual-pause protection
            exoPlayer.setAudioAttributes(audioAttributes, /* handleAudioFocus= */ false);
            exoPlayer.setWakeMode(C.WAKE_MODE_NETWORK);

            exoPlayer.addListener(new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int playbackState) {
                    if (playbackState == Player.STATE_READY) {
                        long dur = exoPlayer.getDuration();
                        if (dur > 0) {
                            trackDurationMs = dur;
                        }
                        updatePlaybackStateCompat();
                        publishNotification();
                    } else if (playbackState == Player.STATE_ENDED) {
                        if (isQueueTransitioning) {
                            Log.d(TAG, "Player.STATE_ENDED ignored: queue transition already in progress");
                            return;
                        }

                        // GUARD 1: If paused by call or call interruption is active, STATE_ENDED is a connection drop, NOT end of song
                        if (isPausedByCall || wasPlayingBeforeCall) {
                            Log.w(TAG, "Player.STATE_ENDED ignored during phone call interruption");
                            return;
                        }

                        // GUARD 2: Premature STATE_ENDED check (socket timeout after long pause)
                        long curPos = exoPlayer.getCurrentPosition();
                        if (trackDurationMs > 5000 && curPos < (trackDurationMs - 2500)) {
                            Log.w(TAG, "Premature STATE_ENDED at " + curPos + "ms / " + trackDurationMs + "ms -> socket dropped, re-preparing at current position");
                            resumePlaybackAfterCall(curPos > 0 ? curPos : savedPositionBeforeCall);
                            return;
                        }

                        Log.i(TAG, "Track ended naturally (STATE_ENDED at " + curPos + "ms) -> starting queue transition window");
                        isPlaying = false;
                        updatePlaybackStateCompat();
                        publishNotification();
                        startQueueTransition();
                        triggerMediaAction("next", null);
                    }
                }

                @Override
                public void onIsPlayingChanged(boolean isPlayingNow) {
                    isPlaying = isPlayingNow;
                    updatePlaybackStateCompat();
                    publishNotification();

                    long pos = exoPlayer.getCurrentPosition();
                    long dur = exoPlayer.getDuration();
                    if (dur <= 0) dur = trackDurationMs;
                    AuraMediaPlugin.dispatchPlaybackProgress((double) pos / 1000.0, (double) dur / 1000.0, isPlayingNow);

                    if (isPlayingNow) {
                        cancelQueueTransition();
                        acquireLocks();
                        startCallStateMonitoring();
                        startHeartbeat();
                        progressHandler.removeCallbacks(progressRunnable);
                        progressHandler.post(progressRunnable);
                    } else {
                        progressHandler.removeCallbacks(progressRunnable);
                        stopHeartbeat();
                        if (!isQueueTransitioning) {
                            releaseLocks();
                        } else {
                            Log.i(TAG, "onIsPlayingChanged(false) while queue transitioning: retaining locks for seamless next track");
                        }
                    }
                }

                @Override
                public void onPlayerError(@NonNull PlaybackException error) {
                    Log.e(TAG, "ExoPlayer error: " + error.getMessage(), error);
                    if (isPausedByCall || wasPlayingBeforeCall || savedPositionBeforeCall > 0) {
                        Log.w(TAG, "ExoPlayer error encountered during call recovery -> notifying JS layer for stream reload");
                        triggerMediaAction("call_recovery_reload", (double) (savedPositionBeforeCall / 1000.0));
                        return;
                    }
                    cancelQueueTransition();
                    isPlaying = false;
                    updatePlaybackStateCompat();
                    publishNotification();
                    releaseLocks();
                    triggerMediaAction("playbackError", null);
                }
            });
            Log.i(TAG, "ExoPlayer initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize ExoPlayer", e);
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
            if (wakeLock != null) {
                if (!wakeLock.isHeld()) {
                    wakeLock.acquire();
                } else if (isQueueTransitioning) {
                    wakeLock.acquire();
                }
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
                cancelQueueTransition();
                wasPlayingBeforeCall = false;
                isPausedByCall = false;
                requestAudioFocusInternal();
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.play();
                }
                triggerMediaAction("play", null);
            }

            @Override
            public void onPause() {
                cancelQueueTransition();
                wasPlayingBeforeCall = false;
                isPausedByCall = false;
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.pause();
                }
                releaseLocks();
                triggerMediaAction("pause", null);
            }

            @Override
            public void onSkipToNext() {
                startQueueTransition();
                triggerMediaAction("next", null);
            }

            @Override
            public void onSkipToPrevious() {
                if (isNativePlayerActive && exoPlayer != null && exoPlayer.getCurrentPosition() > 3000) {
                    exoPlayer.seekTo(0);
                    triggerMediaAction("seek", 0.0);
                } else {
                    startQueueTransition();
                    triggerMediaAction("previous", null);
                }
            }

            @Override
            public void onSeekTo(long pos) {
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.seekTo(pos);
                }
                triggerMediaAction("seek", (double) (pos / 1000.0));
            }

            @Override
            public void onStop() {
                cancelQueueTransition();
                wasPlayingBeforeCall = false;
                isPausedByCall = false;
                abandonAudioFocusInternal();
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.stop();
                    isNativePlayerActive = false;
                }
                releaseLocks();
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
                cancelQueueTransition();
                wasPlayingBeforeCall = false;
                isPausedByCall = false;
                requestAudioFocusInternal();
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.play();
                }
                triggerMediaAction("play", null);
                break;
            case ACTION_PAUSE:
                cancelQueueTransition();
                wasPlayingBeforeCall = false;
                isPausedByCall = false;
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.pause();
                }
                releaseLocks();
                triggerMediaAction("pause", null);
                break;
            case ACTION_NEXT:
                startQueueTransition();
                triggerMediaAction("next", null);
                break;
            case ACTION_PREV:
                if (isNativePlayerActive && exoPlayer != null && exoPlayer.getCurrentPosition() > 3000) {
                    exoPlayer.seekTo(0);
                    triggerMediaAction("seek", 0.0);
                } else {
                    startQueueTransition();
                    triggerMediaAction("previous", null);
                }
                break;
            case ACTION_STOP:
                cancelQueueTransition();
                wasPlayingBeforeCall = false;
                isPausedByCall = false;
                abandonAudioFocusInternal();
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.stop();
                    isNativePlayerActive = false;
                }
                releaseLocks();
                triggerMediaAction("pause", null);
                stopServiceInternal();
                break;
            case ACTION_STOP_NATIVE:
                if (exoPlayer != null) {
                    exoPlayer.stop();
                }
                isNativePlayerActive = false;
                if (!isQueueTransitioning) {
                    releaseLocks();
                } else {
                    Log.i(TAG, "ACTION_STOP_NATIVE received during queue transition: retaining locks for next track");
                }
                break;
            case ACTION_SEEK:
                long seekPos = intent.getLongExtra("position", 0);
                if (isNativePlayerActive && exoPlayer != null) {
                    exoPlayer.seekTo(seekPos);
                    if (isPlaying) {
                        exoPlayer.play();
                    }
                }
                break;
            case ACTION_UPDATE_TRACK:
                handleTrackUpdate(intent);
                break;
            case ACTION_PLAY_NATIVE:
                handlePlayNative(intent);
                break;
        }

        return START_STICKY;
    }

    private String sanitizeCapacitorUri(String uri) {
        if (uri == null) return "";
        if (uri.contains("/_capacitor_content_/")) {
            uri = "content://" + uri.substring(uri.indexOf("/_capacitor_content_/") + "/_capacitor_content_/".length());
        }
        if (uri.contains("/_capacitor_file_/")) {
            uri = uri.substring(uri.indexOf("/_capacitor_file_/") + "/_capacitor_file_".length());
        }
        if (uri.startsWith("https://localhost/") || uri.startsWith("http://localhost/")) {
            int slashAfterHost = uri.indexOf('/', uri.indexOf("localhost/"));
            if (slashAfterHost >= 0) {
                String path = uri.substring(slashAfterHost);
                if (path.startsWith("/_capacitor_content_/")) {
                    uri = "content://" + path.substring("/_capacitor_content_/".length());
                } else if (path.startsWith("/_capacitor_file_/")) {
                    uri = path.substring("/_capacitor_file_/".length());
                }
            }
        }
        return uri.trim();
    }

    private void handlePlayNative(Intent intent) {
        cancelQueueTransition();
        initExoPlayer();
        wasPlayingBeforeCall = false;
        isPausedByCall = false;
        savedPositionBeforeCall = -1L;

        String newId = intent.getStringExtra("id");
        String newTitle = intent.getStringExtra("title");
        String newArtist = intent.getStringExtra("artist");
        String newAlbum = intent.getStringExtra("album");
        String newArtwork = intent.getStringExtra("artwork");
        String uriString = intent.getStringExtra("uri");
        long newDuration = intent.getLongExtra("duration", 0);
        long newPosition = intent.getLongExtra("position", 0);

        if (newTitle != null) this.trackTitle = newTitle;
        if (newArtist != null) this.trackArtist = newArtist;
        if (newAlbum != null) this.trackAlbum = newAlbum;
        if (newDuration > 0) this.trackDurationMs = newDuration;
        this.currentPositionMs = newPosition;
        if (uriString != null) this.currentMediaUri = uriString;

        boolean artworkChanged = (newArtwork != null && !newArtwork.equals(this.artworkUrl)) || (newId != null && !newId.equals(this.trackId));
        if (newId != null) this.trackId = newId;

        if (artworkChanged) {
            this.artworkUrl = newArtwork != null ? newArtwork : "";
            loadArtworkAndPublishNotification();
        } else {
            publishNotification();
        }

        if (uriString != null && !uriString.trim().isEmpty() && exoPlayer != null) {
            try {
                uriString = sanitizeCapacitorUri(uriString);

                Uri mediaUri = uriString.startsWith("/")
                        ? Uri.parse("file://" + uriString)
                        : Uri.parse(uriString);

                Log.i(TAG, "Playing track via Native ExoPlayer: " + mediaUri + " (scheme=" + mediaUri.getScheme() + ")");
                MediaItem mediaItem = MediaItem.fromUri(mediaUri);
                exoPlayer.setMediaItem(mediaItem, true);
                exoPlayer.seekTo(newPosition > 0 ? newPosition : 0);
                exoPlayer.prepare();

                requestAudioFocusInternal();
                exoPlayer.play();
                isNativePlayerActive = true;
                isPlaying = true;

                acquireLocks();
                startCallStateMonitoring();
                startHeartbeat();
                progressHandler.removeCallbacks(progressRunnable);
                progressHandler.post(progressRunnable);
                updatePlaybackStateCompat();
            } catch (Exception e) {
                Log.e(TAG, "Failed to play native media item: " + uriString, e);
            }
        }
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
        if (newDuration > 0) this.trackDurationMs = newDuration;
        if (newPosition > 0) this.currentPositionMs = newPosition;

        // CRITICAL GUARD: Never let a metadata sync override isPlaying=true or release locks while ExoPlayer is actively playing audio
        if (isNativePlayerActive && exoPlayer != null && exoPlayer.isPlaying()) {
            Log.d(TAG, "handleTrackUpdate: ExoPlayer is actively playing, ignoring isPlaying=" + newIsPlaying + " from metadata sync");
        } else if (isQueueTransitioning) {
            Log.d(TAG, "handleTrackUpdate: Queue transition in progress, retaining transition locks");
        } else if (isPausedByCall) {
            Log.d(TAG, "handleTrackUpdate: Currently paused by phone call, retaining call pause state");
        } else {
            this.isPlaying = newIsPlaying;

            if (isPlaying) {
                startCallStateMonitoring();
                acquireLocks();
                startHeartbeat();
            } else {
                stopHeartbeat();
                releaseLocks();
            }
        }

        updatePlaybackStateCompat();

        boolean artworkChanged = (newArtwork != null && !newArtwork.equals(this.artworkUrl)) || (newId != null && !newId.equals(this.trackId));
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
                        .override(256, 256)
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
        stopHeartbeat();
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (isPlaying) {
                    acquireLocks();
                    if (isForegroundActive && notificationManager != null) {
                        notificationManager.notify(NOTIFICATION_ID, buildNotification());
                    }
                    mainHandler.postDelayed(this, HEARTBEAT_INTERVAL_MS);
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
        cancelQueueTransition();
        stopCallStateMonitoring();
        stopHeartbeat();
        progressHandler.removeCallbacks(progressRunnable);
        abandonAudioFocusInternal();
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
        cancelQueueTransition();
        try {
            unregisterReceiver(noisyAudioReceiver);
        } catch (Exception ignored) {}

        stopCallStateMonitoring();
        stopHeartbeat();
        progressHandler.removeCallbacks(progressRunnable);
        abandonAudioFocusInternal();
        releaseLocks();

        if (exoPlayer != null) {
            try {
                exoPlayer.stop();
                exoPlayer.release();
            } catch (Exception ignored) {}
            exoPlayer = null;
        }

        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }

        super.onDestroy();
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= TRIM_MEMORY_MODERATE) {
            try {
                Glide.get(this).clearMemory();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        try {
            Glide.get(this).clearMemory();
        } catch (Exception ignored) {}
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
