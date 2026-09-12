"""
server/ai_engine.py
Aura AI Engine: Local semantic intelligence for music vibe generation,
lyric insights, AI chat assistant, and smart equalizer tuning.
"""

import sys
import json
import re

# Comprehensive Vibe, Artist, and Mood Knowledge Base
MOOD_PRESETS = {
    "late night drive": {
        "title": "Midnight City Cruise 🌙",
        "intro": "Vera level chill mix nanba! Midnight drive-ku smooth bass and atmospheric synth melodies pick panniruken. Enjoy the vibe!",
        "vibe": "Smooth • Atmospheric • Melodic",
        "suggested_eq": "Late Night Warmth",
        "tracks": [
            {"title": "Vaseegara", "artist": "Bombay Jayashri • Minnale"},
            {"title": "Venmathi Venmathiye", "artist": "Roop Kumar Rathod, Tipu • Minnale"},
            {"title": "Porkanda Singam", "artist": "Anirudh Ravichander • Vikram"},
            {"title": "Starboy", "artist": "The Weeknd, Daft Punk"},
            {"title": "Nenjame", "artist": "Anirudh Ravichander • Doctor"},
            {"title": "Enna Sona", "artist": "A.R. Rahman, Arijit Singh • OK Jaanu"},
            {"title": "Blinding Lights", "artist": "The Weeknd"},
            {"title": "Munbe Vaa", "artist": "Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal"}
        ]
    },
    "gym": {
        "title": "Gym Beast Mode 💥🔥",
        "intro": "Adra sakkai! Heavy bass drops and max adrenaline tracks ready! Workout-la PR break panna idho unga high-energy booster mix!",
        "vibe": "High Energy • Punchy Bass • Aggressive",
        "suggested_eq": "Bass Monster",
        "tracks": [
            {"title": "Badass", "artist": "Anirudh Ravichander • Leo"},
            {"title": "Hukum - Thalaivar Alappara", "artist": "Anirudh Ravichander • Jailer"},
            {"title": "Naa Ready", "artist": "Thalapathy Vijay, Anirudh • Leo"},
            {"title": "Vikram Title Track", "artist": "Anirudh Ravichander • Vikram"},
            {"title": "Arabic Kuthu", "artist": "Anirudh Ravichander • Beast"},
            {"title": "Illuminati", "artist": "Sushin Shyam • Aavesham"},
            {"title": "Believer", "artist": "Imagine Dragons"},
            {"title": "The Monster", "artist": "Eminem ft. Rihanna"}
        ]
    },
    "party": {
        "title": "Full Kuthu Party Blast 🥳🎉",
        "intro": "Speaker blast aagura maadhiri instant celebration mode on! Dance floor-ah kalaka porom, volume-ah yethunga!",
        "vibe": "Festival Beats • Fast Tempo • Dance",
        "suggested_eq": "Club EDM",
        "tracks": [
            {"title": "Arabic Kuthu", "artist": "Anirudh Ravichander • Beast"},
            {"title": "Kaavaalaa", "artist": "Anirudh Ravichander, Shilpa Rao • Jailer"},
            {"title": "Illuminati", "artist": "Sushin Shyam • Aavesham"},
            {"title": "Manasilaayo", "artist": "Anirudh Ravichander • Vettaiyan"},
            {"title": "Vaathi Coming", "artist": "Anirudh Ravichander • Master"},
            {"title": "Jalabulanjangu", "artist": "Anirudh Ravichander • Don"},
            {"title": "Rowdy Baby", "artist": "Dhanush, Dhee • Maari 2"},
            {"title": "Aaluma Doluma", "artist": "Anirudh Ravichander • Vedalam"}
        ]
    },
    "rainy": {
        "title": "Rainy Day Nostalgia Melodies 🌧️☕",
        "intro": "Kadalai/Coffee kooda mazhai peiyumpothu kekka vendiya soothing soul melodies. Mind-ah peace aakidum nanba.",
        "vibe": "Acoustic • Melodic • Nostalgic",
        "suggested_eq": "Acoustic Clarity",
        "tracks": [
            {"title": "Mazhai Kuruvi", "artist": "A.R. Rahman • Chekka Chivantha Vaanam"},
            {"title": "Vaseegara", "artist": "Bombay Jayashri • Minnale"},
            {"title": "Pookkal Pookkum", "artist": "Roop Kumar Rathod, Harini • Madrasapattinam"},
            {"title": "Unakkul Naane", "artist": "Pradeep Kumar • Pachaikili Muthucharam"},
            {"title": "New York Nagaram", "artist": "A.R. Rahman • Sillunu Oru Kaadhal"},
            {"title": "Kannazhaga", "artist": "Anirudh Ravichander, Shruti Haasan • 3"},
            {"title": "Anbil Avan", "artist": "Devan Ekambaram, Chinmayi • Vinnaithaandi Varuvaayaa"}
        ]
    },
    "breakup": {
        "title": "Soulful Heartbreak & Healing 💔🌧️",
        "intro": "Vali kooda oru azhagu dhaan nanba. Heart-la irukura baaram kuraiya indha deep emotional melodies help pannum.",
        "vibe": "Deep Soul • Slow Tempo • Melancholic",
        "suggested_eq": "Vocal Brilliance",
        "tracks": [
            {"title": "Porkanda Singam", "artist": "Anirudh Ravichander • Vikram"},
            {"title": "Nenjame", "artist": "Anirudh Ravichander • Doctor"},
            {"title": "Po Nee Po", "artist": "Mohit Chauhan, Anirudh • 3"},
            {"title": "Kanave Kanave", "artist": "Anirudh Ravichander • David"},
            {"title": "En Iniya Pon Nilave", "artist": "K.J. Yesudas • Moodu Pani"},
            {"title": "Someone Like You", "artist": "Adele"},
            {"title": "Maruvarthai", "artist": "Sid Sriram • Enai Noki Paayum Thota"}
        ]
    },
    "90s": {
        "title": "90s Golden Era Nostalgia 📻✨",
        "intro": "Isaignani Ilaiyaraaja and Maestro A.R. Rahman magical era! Live instruments and everlasting lyrics combo!",
        "vibe": "Vintage • Maestro Melody • Warm Vinyl",
        "suggested_eq": "Maestro Vinyl",
        "tracks": [
            {"title": "Sundari Kannal Oru Sethi", "artist": "S.P. Balasubrahmanyam, S. Janaki • Thalapathi"},
            {"title": "Rakkamma Kaiya Thattu", "artist": "S.P. Balasubrahmanyam, Swarnalatha • Thalapathi"},
            {"title": "Thenpandi Cheemayile", "artist": "Kamal Haasan, Ilaiyaraaja • Nayagan"},
            {"title": "Chinna Chinna Aasai", "artist": "Minmini • Roja"},
            {"title": "Kannalane", "artist": "K.S. Chithra • Bombay"},
            {"title": "Kaadhal Rojave", "artist": "S.P. Balasubrahmanyam • Roja"},
            {"title": "Mandram Vandha Thendralukku", "artist": "S.P. Balasubrahmanyam • Mouna Ragam"}
        ]
    },
    "study": {
        "title": "Deep Focus & Study Flow 🎧📚",
        "intro": "Distraction-e illama deep work and study panna perfect lo-fi and instrumental acoustic calm beats.",
        "vibe": "Ambient • Lo-Fi • Zero Distraction",
        "suggested_eq": "Acoustic Clarity",
        "tracks": [
            {"title": "Minnale BGM Theme", "artist": "Harris Jayaraj • Minnale"},
            {"title": "Vinnaithaandi Varuvaayaa Background Score", "artist": "A.R. Rahman"},
            {"title": "Lofi Fruit Chill Beats", "artist": "Lofi Chillhop"},
            {"title": "Interstellar Main Theme", "artist": "Hans Zimmer"},
            {"title": "96 Life of Ram Melody Instrumental", "artist": "Govind Vasantha"},
            {"title": "Doctor BGM Score", "artist": "Anirudh Ravichander"}
        ]
    }
}

# Song Insights Knowledge Base (Lyric breakdown, story & meaning)
SONG_INSIGHTS_DB = {
    "arabic kuthu": {
        "theme": "Cross-cultural Mediterranean folk dance & Tamil mass kuthu fusion.",
        "emotion": "Ecstatic, playful, upbeat dance energy.",
        "story": "Director Nelson Dilipkumar & Anirudh Ravichander wanted an unconventional party anthem featuring invented Arabic-rhyming gibberish words ('Halamithi Habibo', 'Malama Pitha Pithadhe') written by actor Sivakarthikeyan. It quickly became a worldwide viral sensation with over 500M+ streams.",
        "lines": [
            {"tamil": "Halamithi Habibo", "meaning": "A rhythmic invented phrase blending Arabic affectionate slang ('Habibi' meaning beloved) with Tamil kuthu rhythm."},
            {"tamil": "Malama Pitha Pithadhe", "meaning": "Playful freestyle hook expressing irresistible urge to dance under the lover's charm."},
            {"tamil": "Azhagana ponnu siricha, adhirumada heart-u", "meaning": "When a beautiful girl smiles, your heart beats like thunder!"}
        ],
        "composer_notes": "Anirudh combined Arabic Oud and Darbuka percussion with Tamil Thavil and electronic synth bass drops.",
        "recommended_eq": "Bass Monster (+6dB at 64Hz for thunderous bass drums)"
    },
    "hukum": {
        "theme": "Unyielding dominance, superstar legacy, and lionhearted authority.",
        "emotion": "Fierce, commanding, adrenaline-pumping goosebumps.",
        "story": "Written by Super Subu for Superstar Rajinikanth in 'Jailer'. 'Hukum' is an Urdu/Hindi derived word for 'Order / Command'. The song establishes that no matter who enters the game, the King remains the King.",
        "lines": [
            {"tamil": "Hukum... Tiger Ka Hukum", "meaning": "Order... This is the Tiger's absolute decree!"},
            {"tamil": "Alapparai kelapparom, thalaiyila vaipom", "meaning": "We make the grandest noise and wear our pride on our head."},
            {"tamil": "Kodi parakkudha, thalaivan irukkanda", "meaning": "Is our flag flying high? Know that the undisputed leader is here!"}
        ],
        "composer_notes": "Features heavy distorted electric guitar riffs, deep punchy brass sections, and Anirudh's raw vocal delivery.",
        "recommended_eq": "Rock Punch (+5dB at 125Hz, +4dB at 4kHz)"
    },
    "illuminati": {
        "theme": "Retro synthwave club celebration of wild friendship and carefree swagger.",
        "emotion": "Addictive, hypnotic, stylish cool vibe.",
        "story": "Composed by Sushin Shyam and sung by Dabzee for the Malayalam superhit 'Aavesham' starring Fahadh Faasil (Ranga Annan). Became an all-India viral dance craze across TikTok, Reels, and clubs.",
        "lines": [
            {"tamil": "Illuminati... athirum ivan varum vazhi", "meaning": "The mysterious power that shakes whatever road he walks upon."},
            {"tamil": "Koodave ninnu kalakkum namma gang", "meaning": "Standing shoulder to shoulder, our crew owns the town!"}
        ],
        "composer_notes": "Built on an 80s analog synth bass arpeggio, 808 trap snares, and Malayalam rap cadence.",
        "recommended_eq": "Club EDM (+5dB at 64Hz, +4dB at 16kHz)"
    },
    "vaseegara": {
        "theme": "Sensual, tender romantic surrender and eternal longing.",
        "emotion": "Intimate, poetic, deeply emotional love.",
        "story": "Written by lyricist Thamarai and composed by Harris Jayaraj in his debut blockbuster 'Minnale' (2001). Sung with timeless grace by Carnatic maestro Bombay Jayashri.",
        "lines": [
            {"tamil": "Vaseegara... en nenjinikka un pon madiyil thoonginal podhum", "meaning": "Enchanter... it is enough for my heart if I can rest my head and sleep in your golden lap."},
            {"tamil": "Adhe kanam en kannuranga, mun jenmangalin aakkangal serum", "meaning": "The moment my eyes close in your embrace, the blessings of all my past lives unite."}
        ],
        "composer_notes": "Minimalistic nylon-string acoustic guitar and flute accompanying pure acoustic vocal resonance.",
        "recommended_eq": "Acoustic Clarity (+4dB at 1kHz - 2kHz for intimate vocal breath)"
    }
}

def detect_vibe(prompt: str) -> dict:
    p = prompt.lower()
    if any(w in p for w in ["gym", "workout", "fitness", "beast", "energy", "pump", "power", "heavy"]):
        return MOOD_PRESETS["gym"]
    elif any(w in p for w in ["drive", "car", "night", "midnight", "cruis", "highway"]):
        return MOOD_PRESETS["late night drive"]
    elif any(w in p for w in ["party", "dance", "kuthu", "blast", "club", "celebrat", "dj", "fast"]):
        return MOOD_PRESETS["party"]
    elif any(w in p for w in ["rain", "mazhai", "weather", "coffee", "monsoon"]):
        return MOOD_PRESETS["rainy"]
    elif any(w in p for w in ["breakup", "sad", "alone", "cry", "pain", "heal", "miss", "heartbreak"]):
        return MOOD_PRESETS["breakup"]
    elif any(w in p for w in ["90s", "old", "ilaiyaraaja", "spb", "vintage", "retro", "classic"]):
        return MOOD_PRESETS["90s"]
    elif any(w in p for w in ["study", "focus", "read", "work", "calm", "peace", "lofi", "relax"]):
        return MOOD_PRESETS["study"]
    else:
        # Dynamic customized fallback
        return {
            "title": f"Custom AI Vibe: {prompt.title()} ✨",
            "intro": f"Ungaloda vibe '{prompt}'-ku thagundha maadhiri best trending and melodic tracks customize panniruken nanba!",
            "vibe": "Eclectic • Personalized",
            "suggested_eq": "Acoustic Clarity",
            "tracks": [
                {"title": f"{prompt.title()} Mix", "artist": "Trending Artist"},
                {"title": "Arabic Kuthu", "artist": "Anirudh Ravichander • Beast"},
                {"title": "Hukum", "artist": "Anirudh Ravichander • Jailer"},
                {"title": "Illuminati", "artist": "Sushin Shyam • Aavesham"},
                {"title": "Vaseegara", "artist": "Bombay Jayashri • Minnale"},
                {"title": "Porkanda Singam", "artist": "Anirudh Ravichander • Vikram"}
            ]
        }

def handle_dj(prompt: str):
    vibe = detect_vibe(prompt)
    print(json.dumps(vibe))

def handle_insights(song_title: str, artist: str = ""):
    query = song_title.lower()
    matched = None
    for key in SONG_INSIGHTS_DB:
        if key in query:
            matched = SONG_INSIGHTS_DB[key]
            break

    if not matched:
        # Generate smart generalized insight
        clean_title = re.sub(r'\(.*?\)|\[.*?\]', '', song_title).strip()
        matched = {
            "theme": f"Emotional musical narrative centering around {clean_title}.",
            "emotion": "Dynamic, vibrant musical expression.",
            "story": f"'{clean_title}' showcases expressive vocal storytelling and atmospheric production.",
            "lines": [
                {"tamil": clean_title, "meaning": "The core musical anchor and melodic hook of this composition."},
                {"tamil": "Unnaale nenjam thudikkiradhey", "meaning": "Every beat of the heart resonates with the emotional soul of the music."}
            ],
            "composer_notes": "Mastered with modern dynamic range, punchy low-ends, and clear vocal presence.",
            "recommended_eq": "Acoustic Clarity"
        }
    print(json.dumps(matched))

def handle_chat(message: str, current_song_info: str = "{}"):
    msg = message.lower()
    current_song = {}
    try:
        current_song = json.loads(current_song_info)
    except:
        pass

    reply_text = ""
    suggested_action = None

    if any(w in msg for w in ["karaoke", "vocal remover", "mute singer", "sing"]):
        reply_text = "Nanba! Karaoke mode ON/OFF button bottom player-la iruku. Ipo neenga vocals remove panni live-a karaoke paadalaam! 🎙️✨"
        suggested_action = {"type": "TOGGLE_KARAOKE"}
    elif any(w in msg for w in ["bass", "boost bass", "heavy bass"]):
        reply_text = "Bass Beast mode ready! 10-Band Equalizer-la Sub-Bass & 64Hz-a +6dB boost panniten. Sound adipoliya irukum! 🔊🔥"
        suggested_action = {"type": "SET_EQ_PRESET", "preset": "bass"}
    elif any(w in msg for w in ["vocal", "clarity", "treble", "speech"]):
        reply_text = "Vocal Clarity mode activate panniten nanba! Vocals crisp & clean-a keka mudiyum. 🎙️"
        suggested_action = {"type": "SET_EQ_PRESET", "preset": "vocal"}
    elif any(w in msg for w in ["flat", "reset eq", "normal sound"]):
        reply_text = "Equalizer flat standard sound-ku reset panniyachu. 🎚️"
        suggested_action = {"type": "SET_EQ_PRESET", "preset": "flat"}
    elif any(w in msg for w in ["pause", "stop"]):
        reply_text = "Music pause panniten nanba."
        suggested_action = {"type": "PAUSE"}
    elif any(w in msg for w in ["play", "resume"]):
        reply_text = "Playback start panniten! Enjoy the beat!"
        suggested_action = {"type": "PLAY"}
    elif any(w in msg for w in ["next", "skip"]):
        reply_text = "Next track-ku skip panniten!"
        suggested_action = {"type": "NEXT_TRACK"}
    elif any(w in msg for w in ["meaning", "lyrics", "explain song"]):
        title = current_song.get("title", "Current song")
        reply_text = f"'{title}' lyrics breakdown & background story Now Playing -> 'AI Insights' tab-la ready-a irukku nanba! 📜✨"
        suggested_action = {"type": "OPEN_AI_INSIGHTS"}
    elif any(w in msg for w in ["dj", "vibe", "mood", "recommend"]):
        reply_text = "AI DJ Studio-ku ponga nanba! Anga 'Gym', 'Late night drive', 'Rainy chill' nu types panna instant custom playlist kedaikum! 🎧"
        suggested_action = {"type": "NAVIGATE_TAB", "tab": "ai-studio"}
    else:
        title = current_song.get("title")
        if title:
            reply_text = f"Vanakkam nanba! Ipo '{title}' play aaguthu. EQ tune panna, Karaoke toggle panna, alladhu puthu vibe playlist thevaipattal enkitta sollunga, instant-a panni tharen! 🚀"
        else:
            reply_text = "Vanakkam nanba! Naan unga Aura AI Music Assistant. Unakku enna paatu venum, enna vibe venum, alladhu bass boost pannanuma? Sollunga nanba! 🎵🔥"

    print(json.dumps({
        "reply": reply_text,
        "action": suggested_action
    }))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "dj":
        prompt = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "late night drive"
        handle_dj(prompt)
    elif cmd == "insights":
        title = sys.argv[2] if len(sys.argv) > 2 else "Arabic Kuthu"
        artist = sys.argv[3] if len(sys.argv) > 3 else ""
        handle_insights(title, artist)
    elif cmd == "chat":
        msg = sys.argv[2] if len(sys.argv) > 2 else "hi"
        current_song_info = sys.argv[3] if len(sys.argv) > 3 else "{}"
        handle_chat(msg, current_song_info)
    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))
