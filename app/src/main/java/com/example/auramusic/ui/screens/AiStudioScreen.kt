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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Send
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
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.data.model.Song
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraEmeraldAccent
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

data class ChatMessage(
    val sender: String, // "user" or "aura"
    val text: String
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AiStudioScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: MusicPlayerViewModel,
    modifier: Modifier = Modifier
) {
    val allSongs by libraryViewModel.allSongs.collectAsState()
    val currentSong by playerViewModel.currentSong.collectAsState()

    var userPrompt by remember { mutableStateOf("") }
    val chatMessages = remember {
        mutableStateListOf(
            ChatMessage(
                sender = "aura",
                text = "Welcome to Aura AI Studio! I can analyze musical frequency patterns, craft custom mood queues, and uncover lyric stories for any song in your library."
            )
        )
    }

    val vibes = listOf(
        "Late Night Drive" to listOf(AuraIndigoPrimary, Color(0xFF1E1B4B)),
        "High Energy Mass" to listOf(AuraVioletSecondary, Color(0xFF581C87)),
        "Lo-Fi Chill & Focus" to listOf(AuraCyanAccent, Color(0xFF0E7490)),
        "Romantic Acoustic" to listOf(AuraRoseAccent, Color(0xFF881337)),
        "Gym Workout Beast" to listOf(AuraEmeraldAccent, Color(0xFF064E3B))
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("ai_studio_screen"),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // Hero Header
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(AuraIndigoPrimary.copy(alpha = 0.4f), AuraVioletSecondary.copy(alpha = 0.4f))
                        )
                    )
                    .border(1.dp, AuraBorder, RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(AuraVioletSecondary),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Aura AI Studio",
                                style = MaterialTheme.typography.titleLarge,
                                color = AuraTextPrimary
                            )
                            Text(
                                text = "Harmonic intelligence & acoustic curation",
                                style = MaterialTheme.typography.bodyMedium,
                                color = AuraTextSecondary
                            )
                        }
                    }

                    if (currentSong != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { playerViewModel.setAiInsightExpanded(true) },
                            colors = ButtonDefaults.buttonColors(containerColor = AuraIndigoPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("View AI Insights for '${currentSong?.title}'")
                        }
                    }
                }
            }
        }

        // AI DJ Mood Selector
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
            ) {
                Text(
                    text = "AI DJ SMART QUEUES",
                    style = MaterialTheme.typography.labelSmall,
                    color = AuraTextTertiary
                )
                Spacer(modifier = Modifier.height(10.dp))

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    vibes.forEach { (vibeName, colors) ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(Brush.horizontalGradient(colors))
                                .clickable {
                                    val filteredSongs = when {
                                        vibeName.contains("Energy") -> allSongs.filter { it.genre.contains("Mass") || it.title.contains("Hukum") || it.title.contains("Naa") }
                                        vibeName.contains("Chill") -> allSongs.filter { it.genre.contains("Chill") || it.genre.contains("Electro") }
                                        vibeName.contains("Romantic") -> allSongs.filter { it.genre.contains("Melody") || it.genre.contains("Romantic") }
                                        else -> allSongs.shuffled()
                                    }
                                    if (filteredSongs.isNotEmpty()) {
                                        playerViewModel.playSong(filteredSongs.first(), filteredSongs)
                                    }
                                    chatMessages.add(
                                        ChatMessage(
                                            sender = "aura",
                                            text = "Crafted and playing an exclusive AI queue for '$vibeName' featuring ${filteredSongs.size} high fidelity tracks."
                                        )
                                    )
                                }
                                .padding(horizontal = 16.dp, vertical = 12.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = vibeName,
                                    style = MaterialTheme.typography.titleMedium.copy(fontSize = 13.sp),
                                    color = Color.White
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "AURA MUSIC ASSISTANT",
                style = MaterialTheme.typography.labelSmall,
                color = AuraTextTertiary,
                modifier = Modifier.padding(horizontal = 20.dp)
            )
            Spacer(modifier = Modifier.height(10.dp))
        }

        // Chat conversation
        items(chatMessages) { msg ->
            val isAura = msg.sender == "aura"
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 4.dp),
                horizontalArrangement = if (isAura) Arrangement.Start else Arrangement.End
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (isAura) AuraSurfaceCard else AuraIndigoPrimary)
                        .border(1.dp, if (isAura) AuraBorder else Color.Transparent, RoundedCornerShape(16.dp))
                        .padding(14.dp)
                ) {
                    Text(
                        text = msg.text,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            color = if (isAura) AuraTextPrimary else Color.White,
                            lineHeight = 20.sp
                        )
                    )
                }
            }
        }

        // Chat Input Box
        item {
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = userPrompt,
                    onValueChange = { userPrompt = it },
                    placeholder = { Text("Ask Aura about songs, genres, or EQ...", color = AuraTextTertiary) },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = AuraSurfaceElevated,
                        unfocusedContainerColor = AuraSurfaceCard,
                        focusedBorderColor = AuraIndigoPrimary,
                        unfocusedBorderColor = AuraBorder,
                        focusedTextColor = AuraTextPrimary,
                        unfocusedTextColor = AuraTextPrimary
                    ),
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = {
                        if (userPrompt.isNotBlank()) {
                            val question = userPrompt.trim()
                            chatMessages.add(ChatMessage(sender = "user", text = question))
                            userPrompt = ""

                            val answer = when {
                                question.contains("eq", ignoreCase = true) || question.contains("equalizer", ignoreCase = true) ->
                                    "For Indian film music and acoustic tracks like Minnale or Beast, I recommend the 'Vocal' or 'Bass Boost' equalizer preset with +5dB at 60Hz and +3dB at 3.6kHz for crystal punch."
                                question.contains("hukum", ignoreCase = true) ->
                                    "Hukum by Anirudh was engineered around a heavy 808 sub-bass pulse and brass stabs designed specifically for high-SPL theater audio systems."
                                question.contains("radio", ignoreCase = true) ->
                                    "Aura supports live 24/7 radio streams including Jei FM Tamil (320kbps), Bombay Beats Bollywood, and Lo-Fi Chillhop Cafe."
                                else ->
                                    "Great inquiry! Based on your listening patterns, you appreciate rich dynamics and high bitrate production. Check out our 320k Studio Master hits on the Home tab."
                            }
                            chatMessages.add(ChatMessage(sender = "aura", text = answer))
                        }
                    },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(AuraIndigoPrimary)
                ) {
                    Icon(
                        imageVector = Icons.Default.Send,
                        contentDescription = "Send",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
