package com.example.auramusic

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.auramusic.ui.components.AiInsightSheet
import com.example.auramusic.ui.components.BottomPlayerBar
import com.example.auramusic.ui.components.EqualizerDialog
import com.example.auramusic.ui.components.LyricsSheet
import com.example.auramusic.ui.components.NowPlayingSheet
import com.example.auramusic.ui.components.QueueSheet
import com.example.auramusic.ui.navigation.NavigationItem
import com.example.auramusic.ui.screens.AiStudioScreen
import com.example.auramusic.ui.screens.HomeScreen
import com.example.auramusic.ui.screens.LibraryScreen
import com.example.auramusic.ui.screens.PlaylistsScreen
import com.example.auramusic.ui.screens.SearchScreen
import com.example.auramusic.ui.screens.SettingsScreen
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraDarkBackground
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraSurface
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary
import com.example.auramusic.ui.theme.AuraMusicTheme
import com.example.auramusic.ui.viewmodel.LibraryViewModel
import com.example.auramusic.ui.viewmodel.MusicPlayerViewModel

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as AuraApplication
        val repository = app.repository
        val playerController = app.playerController

        val playerViewModel = ViewModelProvider(this, object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return MusicPlayerViewModel(playerController, repository) as T
            }
        })[MusicPlayerViewModel::class.java]

        val libraryViewModel = ViewModelProvider(this, object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return LibraryViewModel(repository) as T
            }
        })[LibraryViewModel::class.java]

        setContent {
            AuraMusicTheme {
                AuraAppShell(
                    libraryViewModel = libraryViewModel,
                    playerViewModel = playerViewModel
                )
            }
        }
    }
}

@Composable
fun AuraAppShell(
    libraryViewModel: LibraryViewModel,
    playerViewModel: MusicPlayerViewModel
) {
    var currentNavRoute by remember { mutableStateOf("home") }

    val currentSong by playerViewModel.currentSong.collectAsState()
    val isPlaying by playerViewModel.isPlaying.collectAsState()
    val isBuffering by playerViewModel.isBuffering.collectAsState()
    val currentPositionMs by playerViewModel.currentPositionMs.collectAsState()
    val durationMs by playerViewModel.durationMs.collectAsState()
    val queue by playerViewModel.queue.collectAsState()
    val repeatMode by playerViewModel.repeatMode.collectAsState()
    val isShuffled by playerViewModel.isShuffled.collectAsState()
    val playbackSpeed by playerViewModel.playbackSpeed.collectAsState()
    val currentPreset by playerViewModel.currentPreset.collectAsState()
    val bandGains by playerViewModel.bandGains.collectAsState()

    val isNowPlayingExpanded by playerViewModel.isNowPlayingExpanded.collectAsState()
    val isQueueExpanded by playerViewModel.isQueueExpanded.collectAsState()
    val isEqualizerExpanded by playerViewModel.isEqualizerExpanded.collectAsState()
    val isLyricsExpanded by playerViewModel.isLyricsExpanded.collectAsState()
    val isAiInsightExpanded by playerViewModel.isAiInsightExpanded.collectAsState()
    val currentAiInsight by playerViewModel.currentAiInsight.collectAsState()

    val navItems = listOf(
        NavigationItem.HOME,
        NavigationItem.LIBRARY,
        NavigationItem.SEARCH,
        NavigationItem.PLAYLISTS,
        NavigationItem.AI_STUDIO,
        NavigationItem.SETTINGS
    )

    Scaffold(
        containerColor = AuraDarkBackground,
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
            ) {
                // Persistent Mini Player
                BottomPlayerBar(
                    currentSong = currentSong,
                    isPlaying = isPlaying,
                    isBuffering = isBuffering,
                    currentPositionMs = currentPositionMs,
                    durationMs = durationMs,
                    onTogglePlay = { playerViewModel.togglePlay() },
                    onNext = { playerViewModel.next() },
                    onClick = { playerViewModel.setNowPlayingExpanded(true) }
                )

                // Navigation Bar
                NavigationBar(
                    containerColor = AuraSurface,
                    contentColor = AuraIndigoPrimary,
                    tonalElevation = 0.dp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(68.dp)
                        .border(1.dp, AuraBorder)
                        .testTag("bottom_nav_bar")
                ) {
                    navItems.forEach { item ->
                        val selected = currentNavRoute == item.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = { currentNavRoute = item.route },
                            icon = {
                                Icon(
                                    imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.title,
                                    modifier = Modifier.size(22.dp)
                                )
                            },
                            label = {
                                Text(
                                    text = item.title,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 10.sp,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                    )
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = AuraIndigoPrimary,
                                selectedTextColor = AuraIndigoPrimary,
                                unselectedIconColor = AuraTextTertiary,
                                unselectedTextColor = AuraTextTertiary,
                                indicatorColor = Color.Transparent
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentNavRoute) {
                "home" -> HomeScreen(
                    libraryViewModel = libraryViewModel,
                    playerViewModel = playerViewModel,
                    onNavigateToPlaylists = { currentNavRoute = "playlists" }
                )
                "library" -> LibraryScreen(
                    libraryViewModel = libraryViewModel,
                    playerViewModel = playerViewModel
                )
                "search" -> SearchScreen(
                    libraryViewModel = libraryViewModel,
                    playerViewModel = playerViewModel
                )
                "playlists" -> PlaylistsScreen(
                    libraryViewModel = libraryViewModel,
                    playerViewModel = playerViewModel
                )
                "ai_studio" -> AiStudioScreen(
                    libraryViewModel = libraryViewModel,
                    playerViewModel = playerViewModel
                )
                "settings" -> SettingsScreen(
                    playerViewModel = playerViewModel
                )
            }
        }

        // Fullscreen Overlays / Sheets
        if (isNowPlayingExpanded) {
            NowPlayingSheet(
                song = currentSong,
                isPlaying = isPlaying,
                isBuffering = isBuffering,
                currentPositionMs = currentPositionMs,
                durationMs = durationMs,
                isShuffled = isShuffled,
                repeatMode = repeatMode,
                playbackSpeed = playbackSpeed,
                onDismiss = { playerViewModel.setNowPlayingExpanded(false) },
                onTogglePlay = { playerViewModel.togglePlay() },
                onNext = { playerViewModel.next() },
                onPrevious = { playerViewModel.previous() },
                onSeekTo = { playerViewModel.seekTo(it) },
                onToggleShuffle = { playerViewModel.toggleShuffle() },
                onToggleRepeat = { playerViewModel.toggleRepeat() },
                onToggleFavorite = { playerViewModel.toggleFavorite(it) },
                onPlaybackSpeedChange = { playerViewModel.setPlaybackSpeed(it) },
                onOpenEqualizer = { playerViewModel.setEqualizerExpanded(true) },
                onOpenLyrics = { playerViewModel.setLyricsExpanded(true) },
                onOpenAiInsights = { playerViewModel.setAiInsightExpanded(true) },
                onOpenQueue = { playerViewModel.setQueueExpanded(true) }
            )
        }

        if (isEqualizerExpanded) {
            EqualizerDialog(
                currentPreset = currentPreset,
                bandGains = bandGains,
                onPresetSelected = { playerViewModel.applyPreset(it) },
                onBandGainChange = { index, gain -> playerViewModel.setBandGain(index, gain) },
                onDismiss = { playerViewModel.setEqualizerExpanded(false) }
            )
        }

        if (isLyricsExpanded) {
            LyricsSheet(
                song = currentSong,
                onDismiss = { playerViewModel.setLyricsExpanded(false) }
            )
        }

        if (isQueueExpanded) {
            QueueSheet(
                queue = queue,
                currentSong = currentSong,
                onSongSelected = { song -> playerViewModel.playSong(song) },
                onDismiss = { playerViewModel.setQueueExpanded(false) }
            )
        }

        if (isAiInsightExpanded) {
            AiInsightSheet(
                song = currentSong,
                insight = currentAiInsight,
                onDismiss = { playerViewModel.setAiInsightExpanded(false) }
            )
        }
    }
}
