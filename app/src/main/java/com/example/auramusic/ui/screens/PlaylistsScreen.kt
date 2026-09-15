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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.example.auramusic.data.model.Playlist
import com.example.auramusic.ui.components.ArtworkImage
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraDarkBackground
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraSurfaceCard
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary
import com.example.auramusic.ui.viewmodel.LibraryViewModel
import com.example.auramusic.ui.viewmodel.MusicPlayerViewModel

@Composable
fun PlaylistsScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: MusicPlayerViewModel,
    modifier: Modifier = Modifier
) {
    val playlists by libraryViewModel.playlists.collectAsState()
    val allSongs by libraryViewModel.allSongs.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }
    var newPlaylistDesc by remember { mutableStateOf("") }

    var selectedPlaylist by remember { mutableStateOf<Playlist?>(null) }
    var showAddSongsDialog by remember { mutableStateOf(false) }

    val activePlaylist = playlists.find { it.id == selectedPlaylist?.id } ?: selectedPlaylist

    Scaffold(
        containerColor = AuraDarkBackground,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = AuraIndigoPrimary,
                contentColor = Color.White,
                modifier = Modifier
                    .padding(bottom = 70.dp)
                    .testTag("create_playlist_fab")
            ) {
                Icon(Icons.Default.Add, contentDescription = "Create Playlist")
            }
        },
        modifier = modifier.testTag("playlists_screen")
    ) { padding ->
        if (activePlaylist != null) {
            val pl = activePlaylist
            val songsInPlaylist = allSongs.filter { pl.songIds.contains(it.id) }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                // Detail Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ArtworkImage(
                        url = pl.artworkUrl,
                        contentDescription = pl.name,
                        modifier = Modifier
                            .size(70.dp)
                            .clip(RoundedCornerShape(12.dp))
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = pl.name,
                            style = MaterialTheme.typography.titleLarge,
                            color = AuraTextPrimary
                        )
                        Text(
                            text = pl.description.ifBlank { "${songsInPlaylist.size} songs" },
                            style = MaterialTheme.typography.bodyMedium,
                            color = AuraTextSecondary,
                            maxLines = 2
                        )
                    }

                    if (!pl.isInbuilt) {
                        IconButton(
                            onClick = {
                                libraryViewModel.deletePlaylist(pl.id)
                                selectedPlaylist = null
                            }
                        ) {
                            Icon(
                                Icons.Default.DeleteOutline,
                                contentDescription = "Delete Playlist",
                                tint = Color(0xFFEF4444)
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            if (songsInPlaylist.isNotEmpty()) {
                                playerViewModel.playSong(songsInPlaylist.first(), songsInPlaylist)
                            }
                        },
                        enabled = songsInPlaylist.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = AuraIndigoPrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Play All")
                    }

                    Button(
                        onClick = { showAddSongsDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = AuraSurfaceCard),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = AuraCyanAccent)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Songs", color = AuraTextPrimary)
                    }

                    Button(
                        onClick = { selectedPlaylist = null },
                        colors = ButtonDefaults.buttonColors(containerColor = AuraSurfaceCard),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Back", color = AuraTextPrimary)
                    }
                }

                if (songsInPlaylist.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(
                                Icons.Default.MusicNote,
                                contentDescription = null,
                                tint = AuraTextTertiary,
                                modifier = Modifier.size(56.dp)
                            )
                            Text(
                                text = "No songs in this playlist yet",
                                style = MaterialTheme.typography.titleMedium,
                                color = AuraTextSecondary
                            )
                            Button(
                                onClick = { showAddSongsDialog = true },
                                colors = ButtonDefaults.buttonColors(containerColor = AuraIndigoPrimary),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("Add Songs Now")
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 100.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(songsInPlaylist) { song ->
                            SongListItem(
                                song = song,
                                onClick = { playerViewModel.playSong(song, songsInPlaylist) },
                                onToggleFavorite = { libraryViewModel.toggleFavorite(song) }
                            )
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(bottom = 100.dp)
            ) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 16.dp)
                    ) {
                        Text(
                            text = "Playlists",
                            style = MaterialTheme.typography.headlineMedium,
                            color = AuraTextPrimary
                        )
                        Text(
                            text = "Curated collections & your custom mixtapes",
                            style = MaterialTheme.typography.bodyMedium,
                            color = AuraTextSecondary
                        )
                    }
                }

                item {
                    Text(
                        text = "CURATED BY AURA",
                        style = MaterialTheme.typography.labelSmall,
                        color = AuraTextTertiary,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                    )
                }

                items(playlists) { playlist ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 5.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(AuraSurfaceCard)
                            .border(1.dp, AuraBorder, RoundedCornerShape(14.dp))
                            .clickable { selectedPlaylist = playlist }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        ArtworkImage(
                            url = playlist.artworkUrl,
                            contentDescription = playlist.name,
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(10.dp))
                        )

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = playlist.name,
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = AuraTextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = playlist.description.ifBlank { "${playlist.songIds.size} songs" },
                                style = MaterialTheme.typography.bodyMedium,
                                color = AuraTextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        if (playlist.isInbuilt) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(AuraCyanAccent.copy(alpha = 0.15f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "OFFICIAL",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = AuraCyanAccent
                                )
                            }
                        }
                    }
                }
            }
        }

        // Create Playlist Dialog
        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                containerColor = AuraSurfaceCard,
                title = { Text("New Playlist", color = AuraTextPrimary) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = newPlaylistName,
                            onValueChange = { newPlaylistName = it },
                            label = { Text("Playlist Title") },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = AuraTextPrimary,
                                unfocusedTextColor = AuraTextPrimary,
                                focusedBorderColor = AuraIndigoPrimary,
                                unfocusedBorderColor = AuraBorder
                            ),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = newPlaylistDesc,
                            onValueChange = { newPlaylistDesc = it },
                            label = { Text("Description (optional)") },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = AuraTextPrimary,
                                unfocusedTextColor = AuraTextPrimary,
                                focusedBorderColor = AuraIndigoPrimary,
                                unfocusedBorderColor = AuraBorder
                            ),
                            singleLine = true
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newPlaylistName.isNotBlank()) {
                                libraryViewModel.createPlaylist(newPlaylistName, newPlaylistDesc)
                                newPlaylistName = ""
                                newPlaylistDesc = ""
                                showCreateDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = AuraIndigoPrimary)
                    ) {
                        Text("Create")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateDialog = false }) {
                        Text("Cancel", color = AuraTextSecondary)
                    }
                }
            )
        }

        // Add Songs to Playlist Dialog
        if (showAddSongsDialog && activePlaylist != null) {
            val pl = activePlaylist
            AlertDialog(
                onDismissRequest = { showAddSongsDialog = false },
                containerColor = AuraSurfaceCard,
                title = { Text("Add Songs to \"${pl.name}\"", color = AuraTextPrimary) },
                text = {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(350.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(allSongs) { song ->
                            val isAlreadyInPlaylist = pl.songIds.contains(song.id)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(AuraDarkBackground)
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                ArtworkImage(
                                    url = song.artworkUrl,
                                    contentDescription = song.title,
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = song.title,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                        color = AuraTextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = song.artist,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = AuraTextSecondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                if (isAlreadyInPlaylist) {
                                    Icon(
                                        Icons.Default.Check,
                                        contentDescription = "Added",
                                        tint = AuraCyanAccent,
                                        modifier = Modifier.size(24.dp)
                                    )
                                } else {
                                    IconButton(
                                        onClick = {
                                            libraryViewModel.addSongToPlaylist(pl.id, song.id)
                                        }
                                    ) {
                                        Icon(
                                            Icons.Default.Add,
                                            contentDescription = "Add to playlist",
                                            tint = AuraIndigoPrimary
                                        )
                                    }
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { showAddSongsDialog = false },
                        colors = ButtonDefaults.buttonColors(containerColor = AuraIndigoPrimary)
                    ) {
                        Text("Done")
                    }
                }
            )
        }
    }
}
