package com.example.auramusic.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Hearing
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.data.model.Song
import com.example.auramusic.data.model.SongAiInsight
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraDarkBackground
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraSurfaceCard
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary
import com.example.auramusic.ui.theme.AuraVioletSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiInsightSheet(
    song: Song?,
    insight: SongAiInsight?,
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
                .verticalScroll(rememberScrollState())
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(AuraVioletSecondary.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            tint = AuraVioletSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "AI Song Insights",
                            style = MaterialTheme.typography.titleLarge,
                            color = AuraTextPrimary
                        )
                        Text(
                            text = song.title,
                            style = MaterialTheme.typography.bodyMedium,
                            color = AuraTextSecondary
                        )
                    }
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

            if (insight != null) {
                InsightCard(
                    icon = Icons.Default.Psychology,
                    label = "MUSICAL THEME & VIBE",
                    title = insight.theme,
                    description = insight.emotion
                )

                Spacer(modifier = Modifier.height(12.dp))

                InsightCard(
                    icon = Icons.Default.RecordVoiceOver,
                    label = "COMPOSER STORY & PRODUCTION",
                    title = "Production Nuance",
                    description = insight.story
                )

                Spacer(modifier = Modifier.height(12.dp))

                InsightCard(
                    icon = Icons.Default.Hearing,
                    label = "LYRIC METAPHORS & MEANING",
                    title = "Poetic Breakdown",
                    description = insight.lyricsMeaning
                )

                Spacer(modifier = Modifier.height(12.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(AuraIndigoPrimary.copy(alpha = 0.15f))
                        .border(1.dp, AuraIndigoPrimary.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Column {
                        Text(
                            text = "OPTIMAL AUDIO PROFILE",
                            style = MaterialTheme.typography.labelSmall,
                            color = AuraCyanAccent,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = insight.recommendedEq,
                            style = MaterialTheme.typography.titleMedium,
                            color = AuraTextPrimary
                        )
                    }
                }
            } else {
                Text(
                    text = "Analyzing audio harmonics and lyrical structure...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = AuraTextTertiary
                )
            }
        }
    }
}

@Composable
private fun InsightCard(
    icon: ImageVector,
    label: String,
    title: String,
    description: String
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AuraSurfaceCard)
            .border(1.dp, AuraBorder, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = AuraVioletSecondary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = AuraTextTertiary
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                color = AuraTextPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp, lineHeight = 19.sp),
                color = AuraTextSecondary
            )
        }
    }
}
