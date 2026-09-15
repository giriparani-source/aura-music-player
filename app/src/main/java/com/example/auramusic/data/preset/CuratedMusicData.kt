package com.example.auramusic.data.preset

import com.example.auramusic.data.model.Playlist
import com.example.auramusic.data.model.RadioStation
import com.example.auramusic.data.model.Song
import com.example.auramusic.data.model.SongAiInsight

object CuratedMusicData {

    val STUDIO_MASTER_HITS: List<Song> = listOf(
        Song(
            id = "saavn_hukum",
            title = "Hukum - Thalaivar Alappara",
            artist = "Anirudh Ravichander",
            album = "Jailer (Original Motion Picture Soundtrack)",
            duration = 236,
            streamUrl = "https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4",
            artworkUrl = "https://c.saavncdn.com/435/Jailer-Telugu-2023-20230810132954-500x500.jpg",
            format = "320k AAC",
            bitrate = 320,
            genre = "Tamil High-Energy",
            lyrics = "[00:10.00] Thalaivar alappara start aana\n[00:15.00] Tiger ka hukum...\n[00:22.00] Padai nadunga adhirum kural\n[00:30.00] Hukum! Tiger ka hukum!\n[00:45.00] Singatha kandu adhirum kaadu\n[01:05.00] Hukum! Thalaivar ka hukum!"
        ),
        Song(
            id = "saavn_arabic_kuthu",
            title = "Arabic Kuthu - Halamithi Habibo",
            artist = "Anirudh Ravichander, Jonita Gandhi",
            album = "Beast",
            duration = 280,
            streamUrl = "https://aac.saavncdn.com/510/9d96fc7ddd4ffadb745f25aed86f7a4e_320.mp4",
            artworkUrl = "https://c.saavncdn.com/510/Beast-Tamil-2022-20220504184736-500x500.jpg",
            format = "320k AAC",
            bitrate = 320,
            genre = "Dance Pop",
            lyrics = "[00:12.00] Malama pitha pithadhe\n[00:16.00] Malama pitha pithadhe\n[00:20.00] Halamithi habibo habibo\n[00:28.00] Holo holo habibo\n[00:36.00] Jolly o gymkhana pole aaduvom!"
        ),
        Song(
            id = "saavn_naa_ready",
            title = "Naa Ready",
            artist = "Thalapathy Vijay, Anirudh Ravichander",
            album = "Leo",
            duration = 248,
            streamUrl = "https://aac.saavncdn.com/415/3789bee89b94522160f1e50b2266d2c4_320.mp4",
            artworkUrl = "https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg",
            format = "320k AAC",
            bitrate = 320,
            genre = "Mass Anthem",
            lyrics = "[00:14.00] Milligiradhu gun-u\n[00:18.00] En thalapathy vanthachu\n[00:25.00] Naa ready dhaan varavaa?\n[00:32.00] Annan erangi thaan adikkavaa?\n[00:48.00] Leo Das entry da!"
        ),
        Song(
            id = "saavn_illuminati",
            title = "Illuminati",
            artist = "Sushin Shyam, Dabzee",
            album = "Aavesham",
            duration = 194,
            streamUrl = "https://aac.saavncdn.com/202/ba6006006a2f40e6b20b5ced32cc2885_320.mp4",
            artworkUrl = "https://c.saavncdn.com/202/Aavesham-Original-Motion-Picture-Soundtrack-Malayalam-2024-20250910150630-500x500.jpg",
            format = "320k AAC",
            bitrate = 320,
            genre = "Electro Hip-Hop",
            lyrics = "[00:11.00] Illuminati... aahaa...\n[00:18.00] Ranga chettan swag in Bangalore!\n[00:25.00] Thaka thaka beat-u\n[00:32.00] Full on power vibe!"
        ),
        Song(
            id = "saavn_manasilaayo",
            title = "Manasilaayo",
            artist = "Anirudh Ravichander, Malaysia Vasudevan",
            album = "Vettaiyan",
            duration = 255,
            streamUrl = "https://aac.saavncdn.com/803/54aa7ee23bad8894b04c1250a64a2f0a_320.mp4",
            artworkUrl = "https://c.saavncdn.com/803/Vettaiyan-Original-Motion-Picture-Soundtrack-Tamil-2024-20241014154253-500x500.jpg",
            format = "320k AAC",
            bitrate = 320,
            genre = "Folk Fusion",
            lyrics = "[00:10.00] Manasilaayo manasilaayo?\n[00:16.00] Thalaivar style purinjidha!\n[00:24.00] Vettaiyan vettaiyaadum kalam idhu!"
        ),
        Song(
            id = "saavn_vaseegara",
            title = "Vaseegara",
            artist = "Bombay Jayashri, Harris Jayaraj",
            album = "Minnale",
            duration = 301,
            streamUrl = "https://aac.saavncdn.com/450/4f7b9da8e887586e60b11afb602befac_320.mp4",
            artworkUrl = "https://c.saavncdn.com/450/2-In-1-Hits-Of-Maddy-Tamil-2001-20190515150512-500x500.jpg",
            format = "320k AAC",
            bitrate = 320,
            genre = "Romantic Melody",
            lyrics = "[00:15.00] Vaseegara en nenjinikka\n[00:22.00] Un pon madiyil thoonginaal podhum\n[00:30.00] Adhey kanam en uyirum pirindhaal\n[00:38.00] Naan marana vedhanai ariyaene..."
        )
    )

    val RADIO_STATIONS: List<RadioStation> = listOf(
        RadioStation(
            id = "jei_fm_tamil",
            name = "Jei FM Tamil 320k HD",
            tagline = "Non-stop Kollywood 320kbps HD Hits",
            genre = "Tamil Cinema",
            streamUrl = "https://usa3.fastcast4u.com/proxy/jeifm?mp=/1",
            logoUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
            bitrate = 320,
            frequencyTag = "320k Live"
        ),
        RadioStation(
            id = "tamil_panpalai_gold",
            name = "Tamil Panpalai Gold",
            tagline = "Evergreen Ilaiyaraaja & Rahman Classics",
            genre = "Tamil Classics",
            streamUrl = "https://tamilpanpalai.radioca.st/ind",
            logoUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300",
            bitrate = 128,
            frequencyTag = "Gold FM"
        ),
        RadioStation(
            id = "american_tamil_radio",
            name = "American Tamil Radio",
            tagline = "Global Tamil Hits & Live Shows",
            genre = "Global Tamil",
            streamUrl = "https://cp11.serverse.com/proxy/hgsmgluv?mp=/stream",
            logoUrl = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300",
            bitrate = 128,
            frequencyTag = "Global FM"
        ),
        RadioStation(
            id = "bombay_beats_bollywood",
            name = "1.FM Bombay Beats HD",
            tagline = "Latest Bollywood & Punjabi Hits",
            genre = "Bollywood Hits",
            streamUrl = "https://strm112.1.fm/bombaybeats_mobile_mp3",
            logoUrl = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300",
            bitrate = 256,
            frequencyTag = "256k HD"
        ),
        RadioStation(
            id = "radio_aashiqanaa",
            name = "Radio Aashiqanaa",
            tagline = "Romantic Bollywood Melodies 24/7",
            genre = "Romantic Melodies",
            streamUrl = "https://sonic.onlineaudience.co.uk/8114/stream",
            logoUrl = "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300",
            bitrate = 208,
            frequencyTag = "Romantic FM"
        ),
        RadioStation(
            id = "lofi_chillhop_cafe",
            name = "Lo-Fi Chillhop Cafe",
            tagline = "24/7 Study, Relax & Sleep Beats",
            genre = "Lo-Fi Beats",
            streamUrl = "https://streams.ilovemusic.de/iloveradio17.mp3",
            logoUrl = "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300",
            bitrate = 192,
            frequencyTag = "24/7 Chill"
        ),
        RadioStation(
            id = "dance_wave_ibiza",
            name = "Dance Wave Ibiza Club",
            tagline = "Non-stop Club Anthems & Festival EDM",
            genre = "EDM & Club",
            streamUrl = "https://dancewave.online/dance.mp3",
            logoUrl = "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300",
            bitrate = 192,
            frequencyTag = "Ibiza Club"
        ),
        RadioStation(
            id = "bbc_world_live",
            name = "BBC World Service Live",
            tagline = "Global Stories & Live Broadcast",
            genre = "News & Culture",
            streamUrl = "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
            logoUrl = "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300",
            bitrate = 128,
            frequencyTag = "BBC Live"
        ),
        RadioStation(
            id = "groove_salad_ambient",
            name = "Groove Salad Ambient",
            tagline = "Deep Relaxation, Downtempo & Waves",
            genre = "Ambient Downtempo",
            streamUrl = "https://ice1.somafm.com/groovesalad-128-mp3",
            logoUrl = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300",
            bitrate = 128,
            frequencyTag = "Ambient FM"
        )
    )

    val INBUILT_PLAYLISTS: List<Playlist> = listOf(
        Playlist(
            id = "mudhal_kaadhal",
            name = "Mudhal Kaadhal",
            description = "Nostalgic romantic ballads & unforgettable melodies",
            artworkUrl = "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400",
            songIds = listOf("saavn_vaseegara", "saavn_arabic_kuthu"),
            isInbuilt = true
        ),
        Playlist(
            id = "kollywood_energy",
            name = "Kollywood 320k Mass",
            description = "High-octane theater celebration tracks and anthems",
            artworkUrl = "https://c.saavncdn.com/435/Jailer-Telugu-2023-20230810132954-500x500.jpg",
            songIds = listOf("saavn_hukum", "saavn_naa_ready", "saavn_manasilaayo"),
            isInbuilt = true
        ),
        Playlist(
            id = "chill_night_drive",
            name = "Late Night Chill Drive",
            description = "Deep bass, electro beats, and calming downtempo tracks",
            artworkUrl = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400",
            songIds = listOf("saavn_illuminati", "saavn_vaseegara"),
            isInbuilt = true
        ),
        Playlist(
            id = "global_fm_favorites",
            name = "Global FM Live Radio",
            description = "Top live streaming radio stations from around the world",
            artworkUrl = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
            songIds = listOf("radio_jei_fm_tamil", "radio_lofi_chillhop_cafe", "radio_bombay_beats_bollywood"),
            isInbuilt = true
        )
    )

    val AI_INSIGHTS: Map<String, SongAiInsight> = mapOf(
        "saavn_hukum" to SongAiInsight(
            songId = "saavn_hukum",
            theme = "Authority, Resilience and Legacy",
            emotion = "Electrifying, commanding adrenaline rush",
            story = "Crafted by Anirudh for Rajinikanth's Jailer, Hukum captures an undisputed leader returning to assert his law with thumping percussion and brass horns.",
            lyricsMeaning = "'Alappara' signifies unstoppable roar; 'Hukum' is the lion's decree that silences the storm.",
            recommendedEq = "Bass Boost & Club Spatial Reverb"
        ),
        "saavn_arabic_kuthu" to SongAiInsight(
            songId = "saavn_arabic_kuthu",
            theme = "Middle Eastern Oud meets Chennai Gaana",
            emotion = "Infectious joyful groove",
            story = "A genre-bending masterclass combining Arabic scales with South Indian kuthu dance rhythms that broke international streaming records.",
            lyricsMeaning = "Gibberish Arabic-Tamil wordplay crafted by Sivakarthikeyan expressing intoxicating romantic happiness.",
            recommendedEq = "Electronic / Pop Preset"
        ),
        "saavn_vaseegara" to SongAiInsight(
            songId = "saavn_vaseegara",
            theme = "Eternal Intimacy & Yearning",
            emotion = "Poignant, soothing tenderness",
            story = "Harris Jayaraj and Bombay Jayashri created one of Indian cinema's most intimate romantic songs featuring acoustic fingerpicking and flute flourishes.",
            lyricsMeaning = "'Vaseegara' means enchanter. The lyrics reflect a soul longing to rest peacefully in the embrace of true love.",
            recommendedEq = "Vocal / Classical Preset with Cathedral Reverb"
        )
    )
}
