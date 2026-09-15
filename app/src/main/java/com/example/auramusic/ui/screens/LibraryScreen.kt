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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.data.model.Album
import com.example.auramusic.data.model.Artist
import com.example.auramusic.data.model.Song
import com.example.auramusic.ui.components.ArtworkImage
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraRoseAccent
import com.example.auramusic.ui.theme.AuraSurface
import com.example.auramusic.ui.theme.AuraSurfaceCard
import com.example.auramusic.ui.theme.AuraSurfaceElevated
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary
import com.example.auramusic.ui.viewmodel.LibraryViewModel
import com.example.auramusic.ui.viewmodel.MusicPlayerViewModel

@Composable
fun LibraryScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: MusicPlayerViewModel,
    modifier: Modifier = Modifier
) {
    val allSongs by libraryViewModel.allSongs.collectAsState()
    val favoriteSongs by libraryViewModel.favoriteSongs.collectAsState()
    val albums by libraryViewModel.albums.collectAsState()
    val artists by libraryViewModel.artists.collectAsState()
    val activeTab by libraryViewModel.libraryTab.collectAsState()

    val tabs = listOf("songs" to "Songs", "albums" to "Albums", "artists" to "Artists", "favorites" to "Favorites")
    val selectedTabIndex = tabs.indexOfFirst { it.first == activeTab }.coerceAtLeast(0)

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("library_screen")
    ) {
        // Top Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            Text(
                text = "Your Library",
                style = MaterialTheme.typography.headlineMedium,
                color = AuraTextPrimary
            )
            Text(
                text = "${allSongs.size} tracks • Studio Master collection",
                style = MaterialTheme.typography.bodyMedium,
                color = AuraTextSecondary
            )
        }

        // Sub Tabs
        TabRow(
            selectedTabIndex = selectedTabIndex,
            containerColor = AuraSurface,
            contentColor = AuraIndigoPrimary,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                    color = AuraIndigoPrimary
                )
            }
        ) {
            tabs.forEachIndexed { index, (key, label) ->
                Tab(
                    selected = selectedTabIndex == index,
                    onClick = { libraryViewModel.setLibraryTab(key) },
                    text = {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 14.sp,
                                fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal
                            ),
                            color = if (selectedTabIndex == index) AuraIndigoPrimary else AuraTextSecondary
                        )
                    }
                )
            }
        }

        // Quick Shuffle / Play all row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val currentList = when (activeTab) {
                "favorites" -> favoriteSongs
                else -> allSongs
            }

            Button(
                onClick = {
                    if (currentList.isNotEmpty()) {
                        playerViewModel.playSong(currentList.first(), currentList)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = AuraIndigoPrimary),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("Play All")
            }

            Button(
                onClick = {
                    if (currentList.isNotEmpty()) {
                        val shuffled = currentList.shuffled()
                        playerViewModel.playSong(shuffled.first(), shuffled)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = AuraSurfaceCard),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Shuffle,
                    contentDescription = null,
                    tint = AuraTextPrimary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("Shuffle", color = AuraTextPrimary)
            }
        }

        // Content Body
        when (activeTab) {
            "songs" -> {
                SongList(
                    songs = allSongs,
                    onSongClick = { song -> playerViewModel.playSong(song, allSongs) },
                    onToggleFavorite = { song -> libraryViewModel.toggleFavorite(song) }
                )
            }
            "favorites" -> {
                if (favoriteSongs.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = 100.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.FavoriteBorder,
                                contentDescription = null,
                                tint = AuraTextTertiary,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "No favorites yet",
                                style = MaterialTheme.typography.titleMedium,
                                color = AuraTextSecondary
                            )
                            Text(
                                text = "Heart your favorite tracks to access them here",
                                style = MaterialTheme.typography.bodyMedium,
                                color = AuraTextTertiary
                            )
                        }
                    }
                } else {
                    SongList(
                        songs = favoriteSongs,
                        onSongClick = { song -> playerViewModel.playSong(song, favoriteSongs) },
                        onToggleFavorite = { song -> libraryViewModel.toggleFavorite(song) }
                    )
                }
            }
            "albums" -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 100.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(albums) { album ->
                        AlbumRow(
                            album = album,
                            onClick = {
                                val songsInAlbum = allSongs.filter { it.album == album.title }
                                if (songsInAlbum.isNotEmpty()) {
                                    playerViewModel.playSong(songsInAlbum.first(), songsInAlbum)
                                }
                            }
                        )
                    }
                }
            }
            "artists" -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 100.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(artists) { artist ->
                        ArtistRow(
                            artist = artist,
                            onClick = {
                                val songsForArtist = allSongs.filter { it.artist == artist.name }
                                if (songsForArtist.isNotEmpty()) {
                                    playerViewModel.playSong(songsForArtist.first(), songsForArtist)
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
private fun SongList(
    songs: List<Song>,
    onSongClick: (Song) -> Unit,
    onToggleFavorite: (Song) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(songs) { song ->
            SongListItem(
                song = song,
                onClick = { onSongClick(song) },
                onToggleFavorite = { onToggleFavorite(song) }
            )
        }
    }
}

@Composable
fun SongListItem(
    song: Song,
    onClick: () -> Unit,
    onToggleFavorite: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AuraSurfaceCard)
            .border(1.dp, AuraBorder, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ArtworkImage(
            url = song.artworkUrl,
            contentDescription = song.title,
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(10.dp))
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = song.title,
                style = MaterialTheme.typography.titleMedium.copy(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
                color = AuraTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = song.artist,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                    color = AuraTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )

                Spacer(modifier = Modifier.width(6.dp))

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(AuraIndigoPrimary.copy(alpha = 0.15f))
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = if (song.isLiveRadio) "LIVE" else "${song.bitrate}k",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = AuraCyanAccent
                    )
                }
            }
        }

        IconButton(
            onClick = onToggleFavorite,
            modifier = Modifier.size(48.dp)
        ) {
            Icon(
                imageVector = if (song.isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                contentDescription = "Favorite",
                tint = if (song.isFavorite) AuraRoseAccent else AuraTextTertiary,
                modifier = Modifier.size(20.dp)
            )
        }

        Box {
            IconButton(
                onClick = { showMenu = true },
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = "More Options",
                    tint = AuraTextTertiary,
                    modifier = Modifier.size(20.dp)
                )
            }

            DropdownMenu(
                expanded = showMenu,
                onDismissRequest = { showMenu = false },
                modifier = Modifier.background(AuraSurfaceElevated)
            ) {
                DropdownMenuItem(
                    text = { Text("Play Now", color = AuraTextPrimary) },
                    onClick = {
                        showMenu = false
                        onClick()
                    }
                )
                DropdownMenuItem(
                    text = { Text(if (song.isFavorite) "Remove from Favorites" else "Add to Favorites", color = AuraTextPrimary) },
                    onClick = {
                        showMenu = false
                        onToggleFavorite()
                    }
                )
            }
        }
    }
}

@Composable
private fun AlbumRow(
    album: Album,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AuraSurfaceCard)
            .border(1.dp, AuraBorder, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ArtworkImage(
            url = album.artworkUrl,
            contentDescription = album.title,
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(10.dp))
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = album.title,
                style = MaterialTheme.typography.titleMedium,
                color = AuraTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${album.artist} • ${album.songCount} songs",
                style = MaterialTheme.typography.bodyMedium,
                color = AuraTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Icon(
            imageVector = Icons.Default.Album,
            contentDescription = null,
            tint = AuraIndigoPrimary,
            modifier = Modifier.size(24.dp)
        )
    }
}

@Composable
private fun ArtistRow(
    artist: Artist,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AuraSurfaceCard)
            .border(1.dp, AuraBorder, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(AuraIndigoPrimary.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = null,
                tint = AuraIndigoPrimary,
                modifier = Modifier.size(26.dp)
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = artist.name,
                style = MaterialTheme.typography.titleMedium,
                color = AuraTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${artist.songCount} songs in library",
                style = MaterialTheme.typography.bodyMedium,
                color = AuraTextSecondary
            )
        }
    }
}
