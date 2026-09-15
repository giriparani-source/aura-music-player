package com.example.auramusic.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.NightlightRound
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.data.model.Song
import com.example.auramusic.data.preset.CuratedMusicData
import com.example.auramusic.ui.components.ArtworkImage
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraDarkBackground
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraSurface
import com.example.auramusic.ui.theme.AuraSurfaceCard
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary
import com.example.auramusic.ui.theme.AuraVioletSecondary
import com.example.auramusic.ui.viewmodel.LibraryViewModel
import com.example.auramusic.ui.viewmodel.MusicPlayerViewModel

private data class ExploreGenreItem(
    val title: String,
    val subtitle: String,
    val searchKeyword: String,
    val gradient: Brush,
    val icon: ImageVector
)

private data class ExploreArtistItem(
    val name: String,
    val title: String,
    val searchKeyword: String,
    val avatarUrl: String,
    val badgeColor: Color
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: MusicPlayerViewModel,
    modifier: Modifier = Modifier
) {
    val searchQuery by libraryViewModel.searchQuery.collectAsState()
    val searchResults by libraryViewModel.searchResults.collectAsState()
    val allSongs by libraryViewModel.allSongs.collectAsState()
    val radioStations = libraryViewModel.radioStations

    var activeExploreTag by remember { mutableStateOf<String?>(null) }

    val trendingTags = listOf(
        "Hukum", "Arabic Kuthu", "Vaseegara", "Anirudh", "Jei FM", "Leo", "Illuminati", "Manasilaayo"
    )

    val genreItems = listOf(
        ExploreGenreItem(
            title = "Kollywood Mass",
            subtitle = "Anirudh, Vijay, Rajini Hits",
            searchKeyword = "Hukum",
            gradient = Brush.linearGradient(listOf(Color(0xFFDC2626), Color(0xFF7C3AED))),
            icon = Icons.Default.Whatshot
        ),
        ExploreGenreItem(
            title = "Soulful Melodies",
            subtitle = "Harris & 90s Romance",
            searchKeyword = "Vaseegara",
            gradient = Brush.linearGradient(listOf(Color(0xFF6366F1), Color(0xFFA855F7))),
            icon = Icons.Default.Favorite
        ),
        ExploreGenreItem(
            title = "South Hip-Hop",
            subtitle = "Illuminati & Fast Flows",
            searchKeyword = "Illuminati",
            gradient = Brush.linearGradient(listOf(Color(0xFF06B6D4), Color(0xFF2563EB))),
            icon = Icons.Default.MusicNote
        ),
        ExploreGenreItem(
            title = "24/7 Live Radio",
            subtitle = "Jei FM & Tamil Gold FM",
            searchKeyword = "FM",
            gradient = Brush.linearGradient(listOf(Color(0xFF10B981), Color(0xFF0D9488))),
            icon = Icons.Default.Radio
        ),
        ExploreGenreItem(
            title = "Lo-Fi & Study",
            subtitle = "Chillhop Cafe & Rainy Beats",
            searchKeyword = "Lo-Fi",
            gradient = Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))),
            icon = Icons.Default.Headphones
        ),
        ExploreGenreItem(
            title = "Club & EDM",
            subtitle = "Arabic Kuthu & Ibiza Dance",
            searchKeyword = "Arabic",
            gradient = Brush.linearGradient(listOf(Color(0xFFEC4899), Color(0xFF8B5CF6))),
            icon = Icons.Default.NightlightRound
        )
    )

    val spotlightArtists = listOf(
        ExploreArtistItem(
            name = "Anirudh",
            title = "Rockstar",
            searchKeyword = "Anirudh",
            avatarUrl = "https://c.saavncdn.com/435/Jailer-Telugu-2023-20230810132954-500x500.jpg",
            badgeColor = Color(0xFFEF4444)
        ),
        ExploreArtistItem(
            name = "Thalapathy Vijay",
            title = "Mass Vocals",
            searchKeyword = "Vijay",
            avatarUrl = "https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg",
            badgeColor = Color(0xFFF59E0B)
        ),
        ExploreArtistItem(
            name = "Harris Jayaraj",
            title = "Melody King",
            searchKeyword = "Harris",
            avatarUrl = "https://c.saavncdn.com/450/2-In-1-Hits-Of-Maddy-Tamil-2001-20190515150512-500x500.jpg",
            badgeColor = Color(0xFF8B5CF6)
        ),
        ExploreArtistItem(
            name = "Sushin Shyam",
            title = "Groove Maestro",
            searchKeyword = "Sushin",
            avatarUrl = "https://c.saavncdn.com/202/Aavesham-Original-Motion-Picture-Soundtrack-Malayalam-2024-20250910150630-500x500.jpg",
            badgeColor = Color(0xFF06B6D4)
        ),
        ExploreArtistItem(
            name = "Jonita Gandhi",
            title = "Pop Sensation",
            searchKeyword = "Jonita",
            avatarUrl = "https://c.saavncdn.com/510/Beast-Tamil-2022-20220504184736-500x500.jpg",
            badgeColor = Color(0xFFEC4899)
        )
    )

    val moodPills = listOf(
        Pair("🚗 Late Night Drive", "Hukum"),
        Pair("🔥 Gym Beast Workout", "Naa Ready"),
        Pair("🌧️ Monsoon Melodies", "Vaseegara"),
        Pair("⚡ High Voltage Bass", "Illuminati"),
        Pair("🌙 Relax & Chill", "Chillhop")
    )

    // Compute effective filtered songs if an explore tag or query is active
    val filteredSongs: List<Song> = when {
        searchQuery.isNotBlank() -> searchResults
        activeExploreTag != null -> {
            val kw = activeExploreTag!!.lowercase()
            allSongs.filter { song ->
                song.title.lowercase().contains(kw) ||
                song.artist.lowercase().contains(kw) ||
                song.genre.lowercase().contains(kw) ||
                song.album.lowercase().contains(kw)
            }
        }
        else -> emptyList()
    }

    val isFiltering = searchQuery.isNotBlank() || activeExploreTag != null

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("search_screen"),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // Search & Explore Header
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Explore,
                        contentDescription = null,
                        tint = AuraIndigoPrimary,
                        modifier = Modifier.size(26.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Explore Music",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = AuraTextPrimary
                    )
                }
                Text(
                    text = "Browse trending vibes, genres, artists & 24/7 radio",
                    style = MaterialTheme.typography.bodyMedium,
                    color = AuraTextSecondary
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Modern Search Input Bar
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = {
                        activeExploreTag = null
                        libraryViewModel.onSearchQueryChanged(it)
                    },
                    placeholder = {
                        Text(
                            text = "Search tracks, artists, genres, FM...",
                            color = AuraTextTertiary
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search",
                            tint = AuraIndigoPrimary
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { libraryViewModel.onSearchQueryChanged("") }) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = "Clear",
                                    tint = AuraTextSecondary
                                )
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = AuraSurfaceCard,
                        unfocusedContainerColor = AuraSurfaceCard,
                        focusedBorderColor = AuraIndigoPrimary,
                        unfocusedBorderColor = AuraBorder,
                        focusedTextColor = AuraTextPrimary,
                        unfocusedTextColor = AuraTextPrimary,
                        cursorColor = AuraCyanAccent
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("search_input")
                )
            }
        }

        // Active Filter Banner (if searching or exploring tag)
        if (isFiltering) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = if (searchQuery.isNotBlank()) "Search: \"$searchQuery\"" else "Exploring: $activeExploreTag",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = AuraCyanAccent
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(AuraIndigoPrimary.copy(alpha = 0.25f))
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "${filteredSongs.size} tracks",
                                style = MaterialTheme.typography.labelSmall,
                                color = AuraIndigoPrimary
                            )
                        }
                    }

                    IconButton(
                        onClick = {
                            libraryViewModel.onSearchQueryChanged("")
                            activeExploreTag = null
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Reset filter",
                            tint = AuraTextSecondary
                        )
                    }
                }
            }

            if (filteredSongs.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 48.dp, start = 20.dp, end = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "No tracks found matching your query",
                                style = MaterialTheme.typography.bodyLarge,
                                color = AuraTextSecondary
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Button(
                                onClick = {
                                    libraryViewModel.onSearchQueryChanged("")
                                    activeExploreTag = null
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = AuraIndigoPrimary),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Explore All Music")
                            }
                        }
                    }
                }
            } else {
                items(filteredSongs) { song ->
                    Box(modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)) {
                        SongListItem(
                            song = song,
                            onClick = { playerViewModel.playSong(song, filteredSongs) },
                            onToggleFavorite = { libraryViewModel.toggleFavorite(song) }
                        )
                    }
                }
            }
        } else {
            // === DEFAULT EXPLORE HUB ===

            // 1. Trending Pills
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.TrendingUp,
                            contentDescription = null,
                            tint = AuraCyanAccent,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "TRENDING NOW",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = AuraTextTertiary
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        trendingTags.forEach { tag ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(AuraSurfaceCard)
                                    .border(1.dp, AuraBorder, RoundedCornerShape(20.dp))
                                    .clickable {
                                        activeExploreTag = tag
                                    }
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = tag,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = AuraTextPrimary
                                )
                            }
                        }
                    }
                }
            }

            // 2. Hero Featured Discover Banner
            item {
                Spacer(modifier = Modifier.height(20.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color(0xFF4F46E5), Color(0xFF7C3AED), Color(0xFFDB2777))
                            )
                        )
                        .padding(18.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "FEATURED MIX",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                ),
                                color = Color.White.copy(alpha = 0.8f)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Kollywood 320k Studio Master",
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Jailer, Leo, Beast, Aavesham & Minnale",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.85f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    if (allSongs.isNotEmpty()) {
                                        playerViewModel.playSong(allSongs.first(), allSongs)
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White,
                                    contentColor = Color(0xFF4F46E5)
                                ),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Play All Hits",
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                }
            }

            // 3. Browse by Genre & Beats (2-column cards)
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                    Text(
                        text = "Browse Genres & Styles",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = AuraTextPrimary
                    )
                    Text(
                        text = "Curated soundscapes tailored for every mood",
                        style = MaterialTheme.typography.bodySmall,
                        color = AuraTextSecondary
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Column(
                    modifier = Modifier.padding(horizontal = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    for (i in genreItems.indices step 2) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            val item1 = genreItems[i]
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(90.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(item1.gradient)
                                    .clickable { activeExploreTag = item1.searchKeyword }
                                    .padding(12.dp)
                            ) {
                                Column(modifier = Modifier.align(Alignment.TopStart)) {
                                    Text(
                                        text = item1.title,
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        ),
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = item1.subtitle,
                                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                        color = Color.White.copy(alpha = 0.8f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                Icon(
                                    imageVector = item1.icon,
                                    contentDescription = null,
                                    tint = Color.White.copy(alpha = 0.6f),
                                    modifier = Modifier
                                        .size(28.dp)
                                        .align(Alignment.BottomEnd)
                                )
                            }

                            if (i + 1 < genreItems.size) {
                                val item2 = genreItems[i + 1]
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(90.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(item2.gradient)
                                    .clickable { activeExploreTag = item2.searchKeyword }
                                    .padding(12.dp)
                                ) {
                                    Column(modifier = Modifier.align(Alignment.TopStart)) {
                                        Text(
                                            text = item2.title,
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp
                                            ),
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = item2.subtitle,
                                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                            color = Color.White.copy(alpha = 0.8f),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Icon(
                                        imageVector = item2.icon,
                                        contentDescription = null,
                                        tint = Color.White.copy(alpha = 0.6f),
                                        modifier = Modifier
                                            .size(28.dp)
                                            .align(Alignment.BottomEnd)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 4. Artist Spotlight (Horizontal circular cards)
            item {
                Spacer(modifier = Modifier.height(26.dp))
                Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                    Text(
                        text = "Artist Spotlight",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = AuraTextPrimary
                    )
                    Text(
                        text = "Tap to explore signature tracks",
                        style = MaterialTheme.typography.bodySmall,
                        color = AuraTextSecondary
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    items(spotlightArtists) { artist ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .width(90.dp)
                                .clickable { activeExploreTag = artist.searchKeyword }
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(72.dp)
                                    .clip(CircleShape)
                                    .border(2.dp, artist.badgeColor, CircleShape)
                            ) {
                                ArtworkImage(
                                    url = artist.avatarUrl,
                                    contentDescription = artist.name,
                                    cornerRadius = 36.dp,
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = artist.name,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 12.sp
                                ),
                                color = AuraTextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = artist.title,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                color = AuraTextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }

            // 5. Explore by Mood
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                    Text(
                        text = "Moods & Activities",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = AuraTextPrimary
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(moodPills) { (label, keyword) ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(AuraSurfaceCard)
                                .border(1.dp, AuraBorder, RoundedCornerShape(12.dp))
                                .clickable { activeExploreTag = keyword }
                                .padding(horizontal = 16.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = AuraTextPrimary
                            )
                        }
                    }
                }
            }

            // 6. 24/7 Live Radio FM Stations Quick Row
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFEF4444))
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "24/7 Live Radio Stations",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = AuraTextPrimary
                        )
                    }
                    Text(
                        text = "HD Tamil, Bollywood, Lo-Fi & EDM broadcasts",
                        style = MaterialTheme.typography.bodySmall,
                        color = AuraTextSecondary
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(radioStations) { station ->
                        Box(
                            modifier = Modifier
                                .width(180.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(AuraSurfaceCard)
                                .border(1.dp, AuraBorder, RoundedCornerShape(14.dp))
                                .clickable {
                                    val song = station.toSong()
                                    playerViewModel.playSong(song, radioStations.map { it.toSong() })
                                }
                                .padding(12.dp)
                        ) {
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(Color(0xFFEF4444).copy(alpha = 0.2f))
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = station.frequencyTag,
                                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                            color = Color(0xFFEF4444)
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Default.Radio,
                                        contentDescription = null,
                                        tint = AuraCyanAccent,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = station.name,
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = AuraTextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = station.tagline,
                                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                    color = AuraTextSecondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
