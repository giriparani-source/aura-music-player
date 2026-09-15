package com.example.auramusic.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.auramusic.data.model.Playlist

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String,
    val artworkUrl: String,
    val songIdsCsv: String,
    val createdAt: Long,
    val isInbuilt: Boolean
) {
    fun toPlaylist(): Playlist = Playlist(
        id = id,
        name = name,
        description = description,
        artworkUrl = artworkUrl,
        songIds = if (songIdsCsv.isBlank()) emptyList() else songIdsCsv.split(",").filter { it.isNotBlank() },
        createdAt = createdAt,
        isInbuilt = isInbuilt
    )

    companion object {
        fun fromPlaylist(playlist: Playlist): PlaylistEntity = PlaylistEntity(
            id = playlist.id,
            name = playlist.name,
            description = playlist.description,
            artworkUrl = playlist.artworkUrl,
            songIdsCsv = playlist.songIds.joinToString(","),
            createdAt = playlist.createdAt,
            isInbuilt = playlist.isInbuilt
        )
    }
}
