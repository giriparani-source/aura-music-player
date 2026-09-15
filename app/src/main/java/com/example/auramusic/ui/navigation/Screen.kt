package com.example.auramusic.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material.icons.outlined.QueueMusic
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.Serializable

sealed interface Screen {

    @Serializable
    data object Home : Screen

    @Serializable
    data object Library : Screen

    @Serializable
    data object Search : Screen

    @Serializable
    data object Playlists : Screen

    @Serializable
    data object AiStudio : Screen

    @Serializable
    data object Settings : Screen
}

enum class NavigationItem(
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val route: String
) {
    HOME("Home", Icons.Filled.Home, Icons.Outlined.Home, "home"),
    LIBRARY("Library", Icons.Filled.LibraryMusic, Icons.Outlined.LibraryMusic, "library"),
    SEARCH("Explore", Icons.Filled.Explore, Icons.Outlined.Explore, "search"),
    PLAYLISTS("Playlists", Icons.Filled.QueueMusic, Icons.Outlined.QueueMusic, "playlists"),
    AI_STUDIO("AI Studio", Icons.Filled.AutoAwesome, Icons.Outlined.AutoAwesome, "ai_studio"),
    SETTINGS("Settings", Icons.Filled.Settings, Icons.Outlined.Settings, "settings")
}
