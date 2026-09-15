package com.example.auramusic.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Song(
    val id: String,
    val title: String,
    val artist: String,
    val album: String = "Single",
    val duration: Int = 0, // in seconds
    val streamUrl: String,
    val artworkUrl: String = "",
    val isOnline: Boolean = true,
    val isLiveRadio: Boolean = false,
    val format: String = "320k AAC",
    val bitrate: Int = 320,
    val dateAdded: Long = System.currentTimeMillis(),
    val playCount: Int = 0,
    val isFavorite: Boolean = false,
    val lyrics: String = "",
    val genre: String = "All"
)

@Serializable
data class Album(
    val id: String,
    val title: String,
    val artist: String,
    val artworkUrl: String = "",
    val songCount: Int = 0,
    val year: Int = 2024
)

@Serializable
data class Artist(
    val id: String,
    val name: String,
    val artworkUrl: String = "",
    val songCount: Int = 0
)

@Serializable
data class Playlist(
    val id: String,
    val name: String,
    val description: String = "",
    val artworkUrl: String = "",
    val songIds: List<String> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val isInbuilt: Boolean = false
)

@Serializable
data class RadioStation(
    val id: String,
    val name: String,
    val tagline: String,
    val genre: String,
    val streamUrl: String,
    val logoUrl: String,
    val bitrate: Int = 320,
    val frequencyTag: String = "Live HD"
) {
    fun toSong(): Song = Song(
        id = "radio_$id",
        title = name,
        artist = tagline,
        album = "24/7 Live Radio FM",
        duration = 0,
        streamUrl = streamUrl,
        artworkUrl = logoUrl,
        isOnline = true,
        isLiveRadio = true,
        format = "LIVE FM",
        bitrate = bitrate,
        genre = genre
    )
}

@Serializable
data class SongAiInsight(
    val songId: String,
    val theme: String,
    val emotion: String,
    val story: String,
    val lyricsMeaning: String,
    val recommendedEq: String
)

enum class RepeatMode {
    OFF,
    ALL,
    ONE
}

enum class EqualizerPreset(val displayName: String, val gains: FloatArray) {
    FLAT("Flat", floatArrayOf(0f, 0f, 0f, 0f, 0f)),
    BASS_BOOST("Bass Boost", floatArrayOf(8f, 5f, 1f, 0f, 0f)),
    TREBLE_BOOST("Treble Boost", floatArrayOf(-2f, 0f, 2f, 6f, 8f)),
    VOCAL("Vocal", floatArrayOf(-3f, 2f, 6f, 3f, -2f)),
    POP("Pop", floatArrayOf(2f, 4f, 6f, 3f, 1f)),
    ROCK("Rock", floatArrayOf(5f, 3f, -1f, 3f, 6f)),
    ELECTRONIC("Electronic", floatArrayOf(6f, 4f, 0f, 3f, 5f)),
    CLASSICAL("Classical", floatArrayOf(4f, 3f, 2f, 3f, -1f)),
    CUSTOM("Custom", floatArrayOf(0f, 0f, 0f, 0f, 0f))
}
