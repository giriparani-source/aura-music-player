package com.example.auramusic.player

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.audiofx.Equalizer
import android.net.Uri
import android.util.Log
import com.example.auramusic.data.model.EqualizerPreset
import com.example.auramusic.data.model.RepeatMode
import com.example.auramusic.data.model.Song
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class AuraPlayerController(private val context: Context) {

    private var mediaPlayer: MediaPlayer? = null
    private var equalizer: Equalizer? = null
    private val scope = CoroutineScope(Dispatchers.Main)
    private var progressJob: Job? = null

    private val _currentSong = MutableStateFlow<Song?>(null)
    val currentSong: StateFlow<Song?> = _currentSong.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPositionMs = MutableStateFlow(0L)
    val currentPositionMs: StateFlow<Long> = _currentPositionMs.asStateFlow()

    private val _durationMs = MutableStateFlow(0L)
    val durationMs: StateFlow<Long> = _durationMs.asStateFlow()

    private val _queue = MutableStateFlow<List<Song>>(emptyList())
    val queue: StateFlow<List<Song>> = _queue.asStateFlow()

    private val _currentIndex = MutableStateFlow(0)
    val currentIndex: StateFlow<Int> = _currentIndex.asStateFlow()

    private val _repeatMode = MutableStateFlow(RepeatMode.OFF)
    val repeatMode: StateFlow<RepeatMode> = _repeatMode.asStateFlow()

    private val _isShuffled = MutableStateFlow(false)
    val isShuffled: StateFlow<Boolean> = _isShuffled.asStateFlow()

    private val _playbackSpeed = MutableStateFlow(1.0f)
    val playbackSpeed: StateFlow<Float> = _playbackSpeed.asStateFlow()

    private val _currentPreset = MutableStateFlow(EqualizerPreset.FLAT)
    val currentPreset: StateFlow<EqualizerPreset> = _currentPreset.asStateFlow()

    private val _bandGains = MutableStateFlow(floatArrayOf(0f, 0f, 0f, 0f, 0f))
    val bandGains: StateFlow<FloatArray> = _bandGains.asStateFlow()

    private val _isBuffering = MutableStateFlow(false)
    val isBuffering: StateFlow<Boolean> = _isBuffering.asStateFlow()

    init {
        startProgressTracker()
    }

    private fun initMediaPlayer() {
        releasePlayer()
        mediaPlayer = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build()
            )
            setOnPreparedListener { mp ->
                _isBuffering.value = false
                val dur = if (mp.duration > 0) mp.duration.toLong() else (_currentSong.value?.duration ?: 0) * 1000L
                _durationMs.value = dur
                mp.start()
                _isPlaying.value = true
                applySpeed(_playbackSpeed.value)
                initEqualizer(mp.audioSessionId)
            }
            setOnCompletionListener {
                handlePlaybackComplete()
            }
            setOnErrorListener { _, what, extra ->
                Log.w("AuraPlayer", "MediaPlayer error: what=$what, extra=$extra")
                _isBuffering.value = false
                _isPlaying.value = false
                true
            }
            setOnBufferingUpdateListener { _, _ ->
                // buffering updates
            }
        }
    }

    private fun initEqualizer(sessionId: Int) {
        try {
            equalizer?.release()
            equalizer = Equalizer(0, sessionId).apply {
                enabled = true
                applyPreset(_currentPreset.value)
            }
        } catch (e: Exception) {
            Log.w("AuraPlayer", "Equalizer init exception: ${e.message}")
        }
    }

    fun playSong(song: Song, newQueue: List<Song> = emptyList()) {
        if (newQueue.isNotEmpty()) {
            _queue.value = newQueue
            val idx = newQueue.indexOfFirst { it.id == song.id }
            _currentIndex.value = if (idx >= 0) idx else 0
        } else if (_queue.value.none { it.id == song.id }) {
            _queue.value = _queue.value + song
            _currentIndex.value = _queue.value.size - 1
        }

        _currentSong.value = song
        _currentPositionMs.value = 0L
        _durationMs.value = song.duration * 1000L
        _isBuffering.value = true

        initMediaPlayer()

        try {
            mediaPlayer?.apply {
                reset()
                setDataSource(context, Uri.parse(song.streamUrl))
                prepareAsync()
            }
        } catch (e: Exception) {
            Log.e("AuraPlayer", "Error starting playback for ${song.title}: ${e.message}")
            _isBuffering.value = false
        }
    }

    fun togglePlay() {
        val player = mediaPlayer ?: return
        try {
            if (player.isPlaying) {
                player.pause()
                _isPlaying.value = false
            } else {
                player.start()
                _isPlaying.value = true
            }
        } catch (e: Exception) {
            Log.w("AuraPlayer", "togglePlay error: ${e.message}")
        }
    }

    fun pause() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.pause()
                    _isPlaying.value = false
                }
            }
        } catch (e: Exception) {
            Log.w("AuraPlayer", "pause error: ${e.message}")
        }
    }

    fun seekTo(positionMs: Long) {
        mediaPlayer?.let {
            val clamped = positionMs.coerceIn(0L, _durationMs.value.coerceAtLeast(1000L))
            it.seekTo(clamped.toInt())
            _currentPositionMs.value = clamped
        }
    }

    fun next() {
        val q = _queue.value
        if (q.isEmpty()) return

        var nextIdx = _currentIndex.value + 1
        if (nextIdx >= q.size) {
            if (_repeatMode.value == RepeatMode.ALL) {
                nextIdx = 0
            } else {
                return
            }
        }
        _currentIndex.value = nextIdx
        playSong(q[nextIdx])
    }

    fun previous() {
        val q = _queue.value
        if (q.isEmpty()) return

        // If played more than 3 seconds, rewind to start
        if (_currentPositionMs.value > 3000) {
            seekTo(0)
            return
        }

        var prevIdx = _currentIndex.value - 1
        if (prevIdx < 0) {
            prevIdx = if (_repeatMode.value == RepeatMode.ALL) q.size - 1 else 0
        }
        _currentIndex.value = prevIdx
        playSong(q[prevIdx])
    }

    fun toggleRepeatMode() {
        _repeatMode.value = when (_repeatMode.value) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
    }

    fun toggleShuffle() {
        val current = _isShuffled.value
        _isShuffled.value = !current
        if (!current) {
            val curSong = _currentSong.value
            val shuffled = _queue.value.shuffled().toMutableList()
            if (curSong != null) {
                shuffled.remove(curSong)
                shuffled.add(0, curSong)
            }
            _queue.value = shuffled
            _currentIndex.value = 0
        }
    }

    fun setPlaybackSpeed(speed: Float) {
        _playbackSpeed.value = speed
        applySpeed(speed)
    }

    private fun applySpeed(speed: Float) {
        try {
            mediaPlayer?.let { mp ->
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    val params = mp.playbackParams
                    params.speed = speed
                    mp.playbackParams = params
                }
            }
        } catch (e: Exception) {
            Log.w("AuraPlayer", "Unable to set playback speed: ${e.message}")
        }
    }

    fun applyPreset(preset: EqualizerPreset) {
        _currentPreset.value = preset
        _bandGains.value = preset.gains.copyOf()
        val eq = equalizer ?: return
        try {
            val range = eq.bandLevelRange
            val minEQLevel = range[0].toInt()
            val maxEQLevel = range[1].toInt()
            val diff = (maxEQLevel - minEQLevel).toFloat()

            val numberOfBands = eq.numberOfBands.toInt()
            for (i in 0 until minOf(numberOfBands, 5)) {
                val gainDb = preset.gains[i] // -12 to +12
                val level = (gainDb / 12f * (diff / 2f)).toInt().coerceIn(minEQLevel, maxEQLevel).toShort()
                eq.setBandLevel(i.toShort(), level)
            }
        } catch (e: Exception) {
            Log.w("AuraPlayer", "Failed to apply EQ: ${e.message}")
        }
    }

    fun setBandGain(bandIndex: Int, gainDb: Float) {
        val current = _bandGains.value.copyOf()
        if (bandIndex in current.indices) {
            current[bandIndex] = gainDb
            _bandGains.value = current
            _currentPreset.value = EqualizerPreset.CUSTOM
            try {
                equalizer?.let { eq ->
                    val range = eq.bandLevelRange
                    val minEQLevel = range[0].toInt()
                    val maxEQLevel = range[1].toInt()
                    val diff = (maxEQLevel - minEQLevel).toFloat()
                    val level = (gainDb / 12f * (diff / 2f)).toInt().coerceIn(minEQLevel, maxEQLevel).toShort()
                    eq.setBandLevel(bandIndex.toShort(), level)
                }
            } catch (e: Exception) {
                Log.w("AuraPlayer", "Failed to set band $bandIndex: ${e.message}")
            }
        }
    }

    private fun handlePlaybackComplete() {
        when (_repeatMode.value) {
            RepeatMode.ONE -> {
                seekTo(0)
                mediaPlayer?.start()
                _isPlaying.value = true
            }
            RepeatMode.ALL -> next()
            RepeatMode.OFF -> {
                if (_currentIndex.value < _queue.value.size - 1) {
                    next()
                } else {
                    _isPlaying.value = false
                    _currentPositionMs.value = 0
                }
            }
        }
    }

    private fun startProgressTracker() {
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive) {
                try {
                    mediaPlayer?.let { mp ->
                        if (mp.isPlaying) {
                            _currentPositionMs.value = mp.currentPosition.toLong()
                        }
                    }
                } catch (_: Exception) {
                    // Ignored if media player is resetting or in transient state
                }
                delay(300)
            }
        }
    }

    private var sleepTimerJob: Job? = null
    private val _sleepTimerMinutesLeft = MutableStateFlow<Int?>(null)
    val sleepTimerMinutesLeft: StateFlow<Int?> = _sleepTimerMinutesLeft.asStateFlow()

    fun setSleepTimer(minutes: Int) {
        sleepTimerJob?.cancel()
        if (minutes <= 0) {
            _sleepTimerMinutesLeft.value = null
            return
        }
        _sleepTimerMinutesLeft.value = minutes
        sleepTimerJob = scope.launch {
            var remaining = minutes
            while (remaining > 0) {
                delay(60_000L)
                remaining--
                _sleepTimerMinutesLeft.value = remaining
            }
            pause()
            _sleepTimerMinutesLeft.value = null
        }
    }

    fun releasePlayer() {
        try {
            sleepTimerJob?.cancel()
            equalizer?.release()
            equalizer = null
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            Log.w("AuraPlayer", "Player release error: ${e.message}")
        }
    }
}
