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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Equalizer
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraRoseAccent
import com.example.auramusic.ui.theme.AuraSurfaceCard
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary
import com.example.auramusic.ui.theme.AuraVioletSecondary
import com.example.auramusic.ui.viewmodel.MusicPlayerViewModel

@Composable
fun SettingsScreen(
    playerViewModel: MusicPlayerViewModel,
    modifier: Modifier = Modifier
) {
    var selectedQuality by remember { mutableStateOf("320k") }
    var selectedSleepTimer by remember { mutableStateOf("Off") }
    val sleepTimerMinutesLeft by playerViewModel.sleepTimerMinutesLeft.collectAsState()
    var cacheCleared by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("settings_screen"),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Text(
                    text = "Settings",
                    style = MaterialTheme.typography.headlineMedium,
                    color = AuraTextPrimary
                )
                Text(
                    text = "Audio quality, playback preferences & cache",
                    style = MaterialTheme.typography.bodyMedium,
                    color = AuraTextSecondary
                )
            }
        }

        // Section: Audio Quality
        item {
            SettingsCategoryHeader(title = "AUDIO ENGINE & STREAMING")
            SettingsCard {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.HighQuality, contentDescription = null, tint = AuraIndigoPrimary)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "Streaming Quality",
                            style = MaterialTheme.typography.titleMedium,
                            color = AuraTextPrimary
                        )
                    }

                    listOf(
                        "320k" to "Studio Master 320 kbps (Lossless AAC)",
                        "192k" to "High Fidelity 192 kbps",
                        "128k" to "Standard 128 kbps (Data Saver)"
                    ).forEach { (qualityKey, label) ->
                        val isSelected = selectedQuality == qualityKey
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { selectedQuality = qualityKey }
                                .padding(vertical = 8.dp, horizontal = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (isSelected) AuraCyanAccent else AuraTextSecondary
                            )
                            if (isSelected) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = AuraCyanAccent, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }

        // Section: Equalizer Shortcut
        item {
            Spacer(modifier = Modifier.height(16.dp))
            SettingsCategoryHeader(title = "ACOUSTIC ENHANCER")
            SettingsCard {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { playerViewModel.setEqualizerExpanded(true) },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Equalizer, contentDescription = null, tint = AuraVioletSecondary)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "5-Band Hardware Equalizer",
                                style = MaterialTheme.typography.titleMedium,
                                color = AuraTextPrimary
                            )
                            Text(
                                text = "Customize frequency spectrum curves & presets",
                                style = MaterialTheme.typography.bodyMedium,
                                color = AuraTextSecondary
                            )
                        }
                    }
                    Text(
                        text = "Open",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = AuraIndigoPrimary
                    )
                }
            }
        }

        // Section: Sleep Timer
        item {
            Spacer(modifier = Modifier.height(16.dp))
            SettingsCategoryHeader(title = "PLAYBACK TIMERS")
            SettingsCard {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Bedtime, contentDescription = null, tint = AuraCyanAccent)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Sleep Timer",
                                style = MaterialTheme.typography.titleMedium,
                                color = AuraTextPrimary
                            )
                            val remaining = sleepTimerMinutesLeft
                            if (remaining != null && remaining > 0) {
                                Text(
                                    text = "Auto pause in $remaining min",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = AuraCyanAccent
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("Off", "15m", "30m", "45m", "60m").forEach { timerOption ->
                            val isSelected = (sleepTimerMinutesLeft == null && timerOption == "Off") ||
                                    (timerOption == selectedSleepTimer && sleepTimerMinutesLeft != null)
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) AuraIndigoPrimary else AuraSurfaceCard)
                                    .border(1.dp, if (isSelected) AuraIndigoPrimary else AuraBorder, RoundedCornerShape(10.dp))
                                    .clickable {
                                        selectedSleepTimer = timerOption
                                        val minutes = when (timerOption) {
                                            "15m" -> 15
                                            "30m" -> 30
                                            "45m" -> 45
                                            "60m" -> 60
                                            else -> 0
                                        }
                                        playerViewModel.setSleepTimer(minutes)
                                    }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = timerOption,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                                    color = if (isSelected) AuraTextPrimary else AuraTextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }

        // Section: Storage and Cache
        item {
            Spacer(modifier = Modifier.height(16.dp))
            SettingsCategoryHeader(title = "STORAGE & CACHE")
            SettingsCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Delete, contentDescription = null, tint = AuraRoseAccent)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Artwork & Audio Buffer",
                                style = MaterialTheme.typography.titleMedium,
                                color = AuraTextPrimary
                            )
                            Text(
                                text = if (cacheCleared) "Cache cleared (0 MB)" else "Cached audio: ~12.4 MB",
                                style = MaterialTheme.typography.bodyMedium,
                                color = AuraTextSecondary
                            )
                        }
                    }

                    Button(
                        onClick = { cacheCleared = true },
                        colors = ButtonDefaults.buttonColors(containerColor = AuraSurfaceCard),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(if (cacheCleared) "Cleared" else "Clear", color = AuraTextPrimary)
                    }
                }
            }
        }

        // Section: About
        item {
            Spacer(modifier = Modifier.height(16.dp))
            SettingsCategoryHeader(title = "ABOUT")
            SettingsCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Info, contentDescription = null, tint = AuraTextSecondary)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Aura Music Player v1.0.0",
                            style = MaterialTheme.typography.titleMedium,
                            color = AuraTextPrimary
                        )
                        Text(
                            text = "Built with Jetpack Compose & Android Media3 engine. Rewritten from giriparani-source/aura-music-player.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = AuraTextSecondary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsCategoryHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelSmall,
        color = AuraTextTertiary,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp)
    )
}

@Composable
private fun SettingsCard(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(AuraSurfaceCard)
            .border(1.dp, AuraBorder, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        content()
    }
}
