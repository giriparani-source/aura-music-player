# Aura Music Player (Android)

A modern, high-fidelity music streaming and library player written in **Kotlin** and **Jetpack Compose**, rewritten from `giriparani-source/aura-music-player`.

## Features

- **320kbps Studio Master Playback**: High dynamic range, lossless AAC streams of hit tracks (Anirudh, Harris Jayaraj, Sushin Shyam, and more).
- **24/7 Global Live Radio FM**: Integrated live radio streaming stations (Jei FM Tamil, Bombay Beats HD, Tamil Panpalai Gold, Lo-Fi Chillhop Cafe, Dance Wave Ibiza, BBC World).
- **5-Band Hardware Equalizer & Audio Profiles**: Custom frequency curve adjustment (-12dB to +12dB across 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz) with presets (Bass Boost, Treble, Vocal, Pop, Rock, Electronic, Classical).
- **Full Player Controls**: Scrubber seek bar, continuous play queue, shuffle, loop one / loop all, playback speed adjustments (0.75x – 1.5x), and synced lyrics viewer.
- **Aura AI Studio**:
  - **AI DJ Smart Playlists**: Instant mood-based curation (Late Night Drive, High Energy Mass, Lo-Fi Chill & Focus, Romantic Acoustic, Gym Workout).
  - **AI Song Insights**: Deep structural breakdown of musical themes, emotional arc, production nuance, and optimal EQ recommendations.
  - **Aura Music Assistant**: Interactive AI assistant for music trivia, recommendations, and listening tips.
- **Local Persistence via Room Database**: Offline caching of songs, playlists, play history, and user favorites.
- **Modern Jetpack Compose UI**: Deep midnight aesthetic (`#090B10`), dynamic sinusoidal audio spectrum visualizer, glassmorphism card surfaces, and fluid transitions.

## Tech Stack

- **Framework**: Kotlin & Jetpack Compose (Material 3)
- **Audio Engine**: Android MediaPlayer with AudioAttributes and hardware Equalizer
- **Local Database**: Android Room with KSP
- **Image Loading**: Coil 3 with Compose integration
- **Architecture**: MVVM with Kotlin Coroutines & StateFlow
