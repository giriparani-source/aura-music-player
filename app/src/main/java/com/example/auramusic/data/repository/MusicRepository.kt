package com.example.auramusic.data.repository

import com.example.auramusic.data.local.MusicDao
import com.example.auramusic.data.local.PlaylistEntity
import com.example.auramusic.data.local.SongEntity
import com.example.auramusic.data.model.Album
import com.example.auramusic.data.model.Artist
import com.example.auramusic.data.model.Playlist
import com.example.auramusic.data.model.RadioStation
import com.example.auramusic.data.model.Song
import com.example.auramusic.data.model.SongAiInsight
import com.example.auramusic.data.preset.CuratedMusicData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

class MusicRepository(
    private val musicDao: MusicDao,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) {

    val allSongs: Flow<List<Song>> = musicDao.getAllSongs().map { list ->
        list.map { it.toSong() }
    }

    val favoriteSongs: Flow<List<Song>> = musicDao.getFavoriteSongs().map { list ->
        list.map { it.toSong() }
    }

    val playlists: Flow<List<Playlist>> = musicDao.getAllPlaylists().map { list ->
        list.map { it.toPlaylist() }
    }

    val radioStations: List<RadioStation> = CuratedMusicData.RADIO_STATIONS

    init {
        scope.launch {
            seedInitialDataIfNeeded()
        }
    }

    private suspend fun seedInitialDataIfNeeded() = withContext(Dispatchers.IO) {
        val initialSongs = mutableListOf<SongEntity>()

        // Add 320k hits
        CuratedMusicData.STUDIO_MASTER_HITS.forEach { song ->
            initialSongs.add(SongEntity.fromSong(song))
        }

        // Add Radio stations as playable songs
        CuratedMusicData.RADIO_STATIONS.forEach { station ->
            initialSongs.add(SongEntity.fromSong(station.toSong()))
        }

        musicDao.insertSongs(initialSongs)

        // Seed Inbuilt Playlists
        val playlistEntities = CuratedMusicData.INBUILT_PLAYLISTS.map {
            PlaylistEntity.fromPlaylist(it)
        }
        musicDao.insertPlaylists(playlistEntities)
    }

    suspend fun toggleFavorite(songId: String, currentFavoriteState: Boolean) = withContext(Dispatchers.IO) {
        musicDao.updateFavorite(songId, !currentFavoriteState)
    }

    suspend fun incrementPlayCount(songId: String) = withContext(Dispatchers.IO) {
        musicDao.incrementPlayCount(songId)
    }

    suspend fun createPlaylist(name: String, description: String = ""): String = withContext(Dispatchers.IO) {
        val id = "playlist_${UUID.randomUUID()}"
        val newPlaylist = Playlist(
            id = id,
            name = name,
            description = description,
            artworkUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400",
            songIds = emptyList(),
            createdAt = System.currentTimeMillis(),
            isInbuilt = false
        )
        musicDao.insertPlaylist(PlaylistEntity.fromPlaylist(newPlaylist))
        id
    }

    suspend fun addSongToPlaylist(playlistId: String, songId: String) = withContext(Dispatchers.IO) {
        val existing = musicDao.getPlaylistById(playlistId)
        if (existing != null) {
            val playlist = existing.toPlaylist()
            val currentIds = playlist.songIds.toMutableList()
            if (!currentIds.contains(songId)) {
                currentIds.add(songId)
                val updated = playlist.copy(songIds = currentIds)
                musicDao.insertPlaylist(PlaylistEntity.fromPlaylist(updated))
            }
        }
    }

    suspend fun deletePlaylist(playlistId: String) = withContext(Dispatchers.IO) {
        musicDao.deletePlaylist(playlistId)
    }

    fun getAiInsightForSong(songId: String): SongAiInsight? {
        return CuratedMusicData.AI_INSIGHTS[songId] ?: SongAiInsight(
            songId = songId,
            theme = "Melodic Journey & Sonic Resonance",
            emotion = "Uplifting, immersive musical experience",
            story = "Engineered with dynamic range and crystal high frequencies to deliver an intimate acoustic space.",
            lyricsMeaning = "Universal expressions of human emotion, perseverance, and passion.",
            recommendedEq = "Flat / Balanced Preset with Studio Soundstage"
        )
    }

    suspend fun searchMusic(query: String): List<Song> = withContext(Dispatchers.IO) {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return@withContext emptyList()

        val allCombined = CuratedMusicData.STUDIO_MASTER_HITS + CuratedMusicData.RADIO_STATIONS.map { it.toSong() }
        allCombined.filter {
            it.title.lowercase().contains(q) ||
            it.artist.lowercase().contains(q) ||
            it.album.lowercase().contains(q) ||
            it.genre.lowercase().contains(q)
        }
    }
}
