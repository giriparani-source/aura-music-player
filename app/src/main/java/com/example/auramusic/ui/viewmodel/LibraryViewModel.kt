package com.example.auramusic.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.auramusic.data.model.Album
import com.example.auramusic.data.model.Artist
import com.example.auramusic.data.model.Playlist
import com.example.auramusic.data.model.RadioStation
import com.example.auramusic.data.model.Song
import com.example.auramusic.data.preset.CuratedMusicData
import com.example.auramusic.data.repository.MusicRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Calendar

class LibraryViewModel(
    private val repository: MusicRepository
) : ViewModel() {

    val allSongs: StateFlow<List<Song>> = repository.allSongs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CuratedMusicData.STUDIO_MASTER_HITS)

    val favoriteSongs: StateFlow<List<Song>> = repository.favoriteSongs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val playlists: StateFlow<List<Playlist>> = repository.playlists
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CuratedMusicData.INBUILT_PLAYLISTS)

    val radioStations: List<RadioStation> = repository.radioStations

    private val _homeFilter = MutableStateFlow("all") // all, playlists, radio
    val homeFilter: StateFlow<String> = _homeFilter.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _searchResults = MutableStateFlow<List<Song>>(emptyList())
    val searchResults: StateFlow<List<Song>> = _searchResults.asStateFlow()

    private val _libraryTab = MutableStateFlow("songs") // songs, albums, artists, favorites
    val libraryTab: StateFlow<String> = _libraryTab.asStateFlow()

    val albums: StateFlow<List<Album>> = allSongs.combine(allSongs) { list, _ ->
        list.groupBy { it.album }
            .map { (albumTitle, songsInAlbum) ->
                Album(
                    id = "album_${albumTitle.hashCode()}",
                    title = albumTitle,
                    artist = songsInAlbum.firstOrNull()?.artist ?: "Various Artists",
                    artworkUrl = songsInAlbum.firstOrNull()?.artworkUrl ?: "",
                    songCount = songsInAlbum.size
                )
            }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val artists: StateFlow<List<Artist>> = allSongs.combine(allSongs) { list, _ ->
        list.groupBy { it.artist }
            .map { (artistName, songsForArtist) ->
                Artist(
                    id = "artist_${artistName.hashCode()}",
                    name = artistName,
                    artworkUrl = songsForArtist.firstOrNull()?.artworkUrl ?: "",
                    songCount = songsForArtist.size
                )
            }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun setHomeFilter(filter: String) {
        _homeFilter.value = filter
    }

    fun setLibraryTab(tab: String) {
        _libraryTab.value = tab
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        viewModelScope.launch {
            if (query.isBlank()) {
                _searchResults.value = emptyList()
            } else {
                _searchResults.value = repository.searchMusic(query)
            }
        }
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            repository.toggleFavorite(song.id, song.isFavorite)
        }
    }

    fun createPlaylist(name: String, description: String = "") {
        viewModelScope.launch {
            repository.createPlaylist(name, description)
        }
    }

    fun addSongToPlaylist(playlistId: String, songId: String) {
        viewModelScope.launch {
            repository.addSongToPlaylist(playlistId, songId)
        }
    }

    fun deletePlaylist(playlistId: String) {
        viewModelScope.launch {
            repository.deletePlaylist(playlistId)
        }
    }

    fun getGreeting(): Pair<String, String> {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour in 4..11 -> "Good morning" to "Start your day with vibrant acoustic vibes"
            hour in 12..16 -> "Good afternoon" to "Energize your afternoon focus and rhythm"
            hour in 17..21 -> "Good evening" to "Wind down with studio quality master tracks"
            else -> "Late night vibes" to "Immersive midnight audio lounge"
        }
    }
}
