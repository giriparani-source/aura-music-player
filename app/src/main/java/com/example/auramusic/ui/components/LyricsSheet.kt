package com.example.auramusic.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.data.model.Song
import com.example.auramusic.ui.theme.AuraDarkBackground
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LyricsSheet(
    song: Song?,
    onDismiss: () -> Unit
) {
    if (song == null) return

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = AuraDarkBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 36.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Song Lyrics",
                        style = MaterialTheme.typography.titleLarge,
                        color = AuraTextPrimary
                    )
                    Text(
                        text = "${song.title} • ${song.artist}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AuraTextSecondary
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = AuraTextSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(380.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (song.lyrics.isNotBlank()) {
                    val lines = song.lyrics.split("\n")
                    lines.forEach { line ->
                        val cleaned = line.replace(Regex("\\[\\d{2}:\\d{2}\\.\\d{2}\\]"), "").trim()
                        if (cleaned.isNotBlank()) {
                            Text(
                                text = cleaned,
                                style = MaterialTheme.typography.bodyLarge.copy(
                                    fontSize = 18.sp,
                                    lineHeight = 26.sp,
                                    fontWeight = FontWeight.Medium
                                ),
                                color = AuraTextPrimary
                            )
                        }
                    }
                } else {
                    Text(
                        text = "No synchronized lyrics available for this audio stream.\nEnjoy the pure acoustic fidelity!",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AuraTextTertiary
                    )
                }
            }
        }
    }
}
