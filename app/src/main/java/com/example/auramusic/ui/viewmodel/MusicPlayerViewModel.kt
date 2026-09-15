package com.example.auramusic.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.auramusic.data.model.EqualizerPreset
import com.example.auramusic.data.model.RepeatMode
import com.example.auramusic.data.model.Song
import com.example.auramusic.data.model.SongAiInsight
import com.example.auramusic.data.repository.MusicRepository
import com.example.auramusic.player.AuraPlayerController
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MusicPlayerViewModel(
    private val playerController: AuraPlayerController,
    private val repository: MusicRepository
) : ViewModel() {

    val currentSong = playerController.currentSong
    val isPlaying = playerController.isPlaying
    val currentPositionMs = playerController.currentPositionMs
    val durationMs = playerController.durationMs
    val queue = playerController.queue
    val repeatMode = playerController.repeatMode
    val isShuffled = playerController.isShuffled
    val playbackSpeed = playerController.playbackSpeed
    val currentPreset = playerController.currentPreset
    val bandGains = playerController.bandGains
    val isBuffering = playerController.isBuffering
    val sleepTimerMinutesLeft = playerController.sleepTimerMinutesLeft

    fun setSleepTimer(minutes: Int) {
        playerController.setSleepTimer(minutes)
    }

    private val _isNowPlayingExpanded = MutableStateFlow(false)
    val isNowPlayingExpanded: StateFlow<Boolean> = _isNowPlayingExpanded.asStateFlow()

    private val _isQueueExpanded = MutableStateFlow(false)
    val isQueueExpanded: StateFlow<Boolean> = _isQueueExpanded.asStateFlow()

    private val _isEqualizerExpanded = MutableStateFlow(false)
    val isEqualizerExpanded: StateFlow<Boolean> = _isEqualizerExpanded.asStateFlow()

    private val _isLyricsExpanded = MutableStateFlow(false)
    val isLyricsExpanded: StateFlow<Boolean> = _isLyricsExpanded.asStateFlow()

    private val _isAiInsightExpanded = MutableStateFlow(false)
    val isAiInsightExpanded: StateFlow<Boolean> = _isAiInsightExpanded.asStateFlow()

    private val _currentAiInsight = MutableStateFlow<SongAiInsight?>(null)
    val currentAiInsight: StateFlow<SongAiInsight?> = _currentAiInsight.asStateFlow()

    fun playSong(song: Song, queue: List<Song> = emptyList()) {
        playerController.playSong(song, queue)
        viewModelScope.launch {
            repository.incrementPlayCount(song.id)
            _currentAiInsight.value = repository.getAiInsightForSong(song.id)
        }
    }

    fun togglePlay() = playerController.togglePlay()
    fun pause() = playerController.pause()
    fun next() = playerController.next()
    fun previous() = playerController.previous()
    fun seekTo(positionMs: Long) = playerController.seekTo(positionMs)
    fun toggleRepeat() = playerController.toggleRepeatMode()
    fun toggleShuffle() = playerController.toggleShuffle()
    fun setPlaybackSpeed(speed: Float) = playerController.setPlaybackSpeed(speed)
    fun applyPreset(preset: EqualizerPreset) = playerController.applyPreset(preset)
    fun setBandGain(bandIndex: Int, gainDb: Float) = playerController.setBandGain(bandIndex, gainDb)

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            repository.toggleFavorite(song.id, song.isFavorite)
        }
    }

    fun setNowPlayingExpanded(expanded: Boolean) {
        _isNowPlayingExpanded.value = expanded
    }

    fun setQueueExpanded(expanded: Boolean) {
        _isQueueExpanded.value = expanded
    }

    fun setEqualizerExpanded(expanded: Boolean) {
        _isEqualizerExpanded.value = expanded
    }

    fun setLyricsExpanded(expanded: Boolean) {
        _isLyricsExpanded.value = expanded
    }

    fun setAiInsightExpanded(expanded: Boolean) {
        _isAiInsightExpanded.value = expanded
        val song = currentSong.value
        if (expanded && song != null) {
            _currentAiInsight.value = repository.getAiInsightForSong(song.id)
        }
    }

    private val _currentSongValue get() = currentSong.value
}
