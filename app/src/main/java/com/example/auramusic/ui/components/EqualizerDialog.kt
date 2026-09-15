package com.example.auramusic.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.auramusic.data.model.EqualizerPreset
import com.example.auramusic.ui.theme.AuraBorder
import com.example.auramusic.ui.theme.AuraCyanAccent
import com.example.auramusic.ui.theme.AuraDarkBackground
import com.example.auramusic.ui.theme.AuraIndigoPrimary
import com.example.auramusic.ui.theme.AuraSurfaceCard
import com.example.auramusic.ui.theme.AuraSurfaceElevated
import com.example.auramusic.ui.theme.AuraTextPrimary
import com.example.auramusic.ui.theme.AuraTextSecondary
import com.example.auramusic.ui.theme.AuraTextTertiary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EqualizerDialog(
    currentPreset: EqualizerPreset,
    bandGains: FloatArray,
    onPresetSelected: (EqualizerPreset) -> Unit,
    onBandGainChange: (Int, Float) -> Unit,
    onDismiss: () -> Unit
) {
    val bandLabels = listOf("60 Hz", "230 Hz", "910 Hz", "3.6 kHz", "14 kHz")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = AuraDarkBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "5-Band Audio Equalizer",
                        style = MaterialTheme.typography.titleLarge,
                        color = AuraTextPrimary
                    )
                    Text(
                        text = "Studio Soundstage & Frequency Curve",
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

            Spacer(modifier = Modifier.height(16.dp))

            // Presets Horizontal Carousel
            Text(
                text = "SOUND PROFILES",
                style = MaterialTheme.typography.labelSmall,
                color = AuraTextTertiary
            )
            Spacer(modifier = Modifier.height(8.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(EqualizerPreset.entries) { preset ->
                    val isSelected = currentPreset == preset
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) AuraIndigoPrimary else AuraSurfaceCard)
                            .border(1.dp, if (isSelected) AuraIndigoPrimary else AuraBorder, RoundedCornerShape(20.dp))
                            .clickable { onPresetSelected(preset) }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = preset.displayName,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            ),
                            color = if (isSelected) Color.White else AuraTextSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // 5 Band Sliders
            Text(
                text = "FREQUENCY BANDS (-12 dB to +12 dB)",
                style = MaterialTheme.typography.labelSmall,
                color = AuraTextTertiary
            )
            Spacer(modifier = Modifier.height(12.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(AuraSurfaceCard)
                    .border(1.dp, AuraBorder, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                bandLabels.forEachIndexed { index, label ->
                    val gain = bandGains.getOrElse(index) { 0f }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                            color = AuraTextSecondary,
                            modifier = Modifier.width(64.dp)
                        )

                        Slider(
                            value = gain,
                            onValueChange = { onBandGainChange(index, it) },
                            valueRange = -12f..12f,
                            colors = SliderDefaults.colors(
                                thumbColor = AuraCyanAccent,
                                activeTrackColor = AuraIndigoPrimary,
                                inactiveTrackColor = Color.White.copy(alpha = 0.1f)
                            ),
                            modifier = Modifier.weight(1f)
                        )

                        Text(
                            text = "${if (gain > 0) "+" else ""}${gain.toInt()} dB",
                            style = MaterialTheme.typography.labelSmall,
                            color = AuraTextPrimary,
                            modifier = Modifier.width(48.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Spatial Audio Mode Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("Studio Reverb", "Club Dynamic", "Vocal Isolation").forEach { mode ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(AuraSurfaceElevated)
                            .border(1.dp, AuraBorder, RoundedCornerShape(12.dp))
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = mode,
                            style = MaterialTheme.typography.labelSmall,
                            color = AuraCyanAccent,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}
