package com.example.auramusic.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.data.model.Playlist
import com.example.auramusic.data.model.RadioStation
import com.example.auramusic.data.model.Song
import com.example.auramusic.ui.components.ArtworkImage
import com.example.auramusic.ui.theme.AuraAmberAccent
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraIndigoDark
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraRoseAccent
import com.example.auramusic.ui.theme.AuraSurfaceCard
import com.example.auramusic.ui.theme.AuraSurfaceElevated
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary
import com.example.auramusic.ui.theme.AuraVioletSecondary
import com.example.auramusic.ui.viewmodel.LibraryViewModel
import com.example.auramusic.ui.viewmodel.MusicPlayerViewModel

@Composable
fun HomeScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: MusicPlayerViewModel,
    onNavigateToPlaylists: () -> Unit,
    modifier: Modifier = Modifier
) {
    val allSongs by libraryViewModel.allSongs.collectAsState()
    val favoriteSongs by libraryViewModel.favoriteSongs.collectAsState()
    val playlists by libraryViewModel.playlists.collectAsState()
    val radioStations = libraryViewModel.radioStations
    val activeFilter by libraryViewModel.homeFilter.collectAsState()

    val (greetingTitle, greetingSubtitle) = libraryViewModel.getGreeting()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("home_screen"),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        // Dynamic Contextual Greeting & Hero Header
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = greetingTitle,
                                style = MaterialTheme.typography.headlineMedium,
                                color = AuraTextPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = AuraAmberAccent,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Text(
                            text = greetingSubtitle,
                            style = MaterialTheme.typography.bodyMedium,
                            color = AuraTextSecondary
                        )
                    }

                    // Quality Badge
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(AuraIndigoDark)
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "320K HD",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = AuraCyanAccent
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Filter Chips
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all" to "All", "playlists" to "Playlists", "radio" to "Live Radio").forEach { (key, label) ->
                        val isSelected = activeFilter == key
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(if (isSelected) AuraIndigoPrimary else AuraSurfaceCard)
                                .border(1.dp, if (isSelected) AuraIndigoPrimary else AuraBorder, RoundedCornerShape(20.dp))
                                .clickable { libraryViewModel.setHomeFilter(key) }
                                .padding(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                ),
                                color = if (isSelected) Color.White else AuraTextSecondary
                            )
                        }
                    }
                }
            }
        }

        // Quick Access 4-Card Grid
        if (activeFilter == "all" || activeFilter == "playlists") {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = "QUICK ACCESS",
                        style = MaterialTheme.typography.labelSmall,
                        color = AuraTextTertiary
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Liked Songs Quick Card
                        QuickAccessCard(
                            title = "Liked Songs",
                            subtitle = "${favoriteSongs.size} tracks",
                            gradient = listOf(AuraRoseAccent, Color(0xFF831843)),
                            icon = Icons.Default.Favorite,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                if (favoriteSongs.isNotEmpty()) {
                                    playerViewModel.playSong(favoriteSongs.first(), favoriteSongs)
                                }
                            }
                        )

                        // Mudhal Kaadhal Card
                        val mudhal = playlists.find { it.id == "mudhal_kaadhal" }
                        QuickAccessCard(
                            title = "Mudhal Kaadhal",
                            subtitle = "Romantic Ballads",
                            gradient = listOf(AuraIndigoPrimary, Color(0xFF312E81)),
                            icon = Icons.Default.PlayArrow,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                val songsInPlaylist = allSongs.filter { mudhal?.songIds?.contains(it.id) == true }
                                if (songsInPlaylist.isNotEmpty()) {
                                    playerViewModel.playSong(songsInPlaylist.first(), songsInPlaylist)
                                }
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Kollywood 320k Mass Card
                        val mass = playlists.find { it.id == "kollywood_energy" }
                        QuickAccessCard(
                            title = "Kollywood Mass",
                            subtitle = "High Energy Anthems",
                            gradient = listOf(AuraVioletSecondary, Color(0xFF4C1D95)),
                            icon = Icons.Default.PlayArrow,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                val songsInPlaylist = allSongs.filter { mass?.songIds?.contains(it.id) == true }
                                if (songsInPlaylist.isNotEmpty()) {
                                    playerViewModel.playSong(songsInPlaylist.first(), songsInPlaylist)
                                }
                            }
                        )

                        // 24/7 Live Radio Card
                        QuickAccessCard(
                            title = "Global FM Live",
                            subtitle = "Continuous Radio",
                            gradient = listOf(AuraCyanAccent, Color(0xFF164E63)),
                            icon = Icons.Default.Radio,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                if (radioStations.isNotEmpty()) {
                                    val stationSong = radioStations.first().toSong()
                                    playerViewModel.playSong(stationSong, radioStations.map { it.toSong() })
                                }
                            }
                        )
                    }
                }
            }
        }

        // Section: Studio Master 320k Hits
        if (activeFilter == "all") {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                SectionHeader(
                    title = "Studio Master 320k Hits",
                    subtitle = "Lossless acoustic fidelity direct streams"
                )

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.padding(top = 12.dp)
                ) {
                    val studioSongs = allSongs.filter { !it.isLiveRadio }
                    items(studioSongs) { song ->
                        SongCard(
                            song = song,
                            onClick = { playerViewModel.playSong(song, studioSongs) }
                        )
                    }
                }
            }
        }

        // Section: 24/7 Live Radio FM
        if (activeFilter == "all" || activeFilter == "radio") {
            item {
                Spacer(modifier = Modifier.height(24.dp))
                SectionHeader(
                    title = "24/7 Live Radio FM",
                    subtitle = "HD online broadcasts from global stations"
                )

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.padding(top = 12.dp)
                ) {
                    items(radioStations) { station ->
                        RadioStationCard(
                            station = station,
                            onClick = {
                                val song = station.toSong()
                                playerViewModel.playSong(song, radioStations.map { it.toSong() })
                            }
                        )
                    }
                }
            }
        }

        // Section: Curated Playlists
        if (activeFilter == "all" || activeFilter == "playlists") {
            item {
                Spacer(modifier = Modifier.height(24.dp))
                SectionHeader(
                    title = "Curated Playlists",
                    subtitle = "Handcrafted collections tailored for every vibe",
                    actionText = "See All",
                    onActionClick = onNavigateToPlaylists
                )

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.padding(top = 12.dp)
                ) {
                    items(playlists) { playlist ->
                        PlaylistCard(
                            playlist = playlist,
                            onClick = {
                                val songsInPlaylist = allSongs.filter { playlist.songIds.contains(it.id) }
                                if (songsInPlaylist.isNotEmpty()) {
                                    playerViewModel.playSong(songsInPlaylist.first(), songsInPlaylist)
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    subtitle: String,
    actionText: String? = null,
    onActionClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = AuraTextPrimary
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = AuraTextSecondary
            )
        }
        if (actionText != null && onActionClick != null) {
            Text(
                text = actionText,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                color = AuraIndigoPrimary,
                modifier = Modifier.clickable(onClick = onActionClick)
            )
        }
    }
}

@Composable
private fun QuickAccessCard(
    title: String,
    subtitle: String,
    gradient: List<Color>,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .height(72.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.horizontalGradient(gradient))
            .clickable(onClick = onClick)
            .padding(12.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp),
                    color = Color.White.copy(alpha = 0.8f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun SongCard(
    song: Song,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(140.dp)
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .size(140.dp)
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, AuraBorder, RoundedCornerShape(16.dp))
        ) {
            ArtworkImage(
                url = song.artworkUrl,
                contentDescription = song.title,
                cornerRadius = 16.dp,
                modifier = Modifier.fillMaxSize()
            )

            // Play floating icon
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(AuraIndigoPrimary.copy(alpha = 0.9f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = song.title,
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            color = AuraTextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = song.artist,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp),
            color = AuraTextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun RadioStationCard(
    station: RadioStation,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .width(200.dp)
            .height(110.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(AuraSurfaceCard)
            .border(1.dp, AuraBorder, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(AuraCyanAccent.copy(alpha = 0.2f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = station.frequencyTag,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = AuraCyanAccent
                    )
                }

                Icon(
                    imageVector = Icons.Default.Radio,
                    contentDescription = null,
                    tint = AuraCyanAccent,
                    modifier = Modifier.size(18.dp)
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = station.name,
                style = MaterialTheme.typography.titleMedium.copy(fontSize = 14.sp, fontWeight = FontWeight.Bold),
                color = AuraTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = station.tagline,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp),
                color = AuraTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun PlaylistCard(
    playlist: Playlist,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(140.dp)
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .size(140.dp)
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, AuraBorder, RoundedCornerShape(16.dp))
        ) {
            ArtworkImage(
                url = playlist.artworkUrl,
                contentDescription = playlist.name,
                cornerRadius = 16.dp,
                modifier = Modifier.fillMaxSize()
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = playlist.name,
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            color = AuraTextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = "${playlist.songIds.size} songs",
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp),
            color = AuraTextSecondary
        )
    }
}
