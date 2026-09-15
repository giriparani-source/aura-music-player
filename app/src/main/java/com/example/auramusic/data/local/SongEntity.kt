package com.example.auramusic.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.auramusic.data.model.Song

@Entity(tableName = "songs")
data class SongEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val duration: Int,
    val streamUrl: String,
    val artworkUrl: String,
    val isOnline: Boolean,
    val isLiveRadio: Boolean,
    val format: String,
    val bitrate: Int,
    val dateAdded: Long,
    val playCount: Int,
    val isFavorite: Boolean,
    val lyrics: String,
    val genre: String
) {
    fun toSong(): Song = Song(
        id = id,
        title = title,
        artist = artist,
        album = album,
        duration = duration,
        streamUrl = streamUrl,
        artworkUrl = artworkUrl,
        isOnline = isOnline,
        isLiveRadio = isLiveRadio,
        format = format,
        bitrate = bitrate,
        dateAdded = dateAdded,
        playCount = playCount,
        isFavorite = isFavorite,
        lyrics = lyrics,
        genre = genre
    )

    companion object {
        fun fromSong(song: Song): SongEntity = SongEntity(
            id = song.id,
            title = song.title,
            artist = song.artist,
            album = song.album,
            duration = song.duration,
            streamUrl = song.streamUrl,
            artworkUrl = song.artworkUrl,
            isOnline = song.isOnline,
            isLiveRadio = song.isLiveRadio,
            format = song.format,
            bitrate = song.bitrate,
            dateAdded = song.dateAdded,
            playCount = song.playCount,
            isFavorite = song.isFavorite,
            lyrics = song.lyrics,
            genre = song.genre
        )
    }
}
