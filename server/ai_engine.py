"""
server/ai_engine.py
Aura AI Engine: Local semantic intelligence for music vibe generation,
lyric insights, AI chat assistant, and smart equalizer tuning.

Extensible architecture: supports local rule-based/semantic matching with
rich Tamil Romanized keywords and fuzzy similarity scoring, structured
to easily plug in remote LLM providers (Gemini, OpenAI, etc.) in the future.
"""

import sys
import json
import re
from difflib import SequenceMatcher

# ==============================================================================
# Comprehensive Vibe, Artist, and Mood Knowledge Base (12 Curated Presets)
# ==============================================================================
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
    },
    # 5 New Presets:
    "romantic": {
        "title": "Pure Romance & Melody Magic 💖🌹",
        "intro": "Kaadhal melodies mattume nanba! Heart-ah melt panna soulful romantic tracks pick panniruken. Enjoy with that special someone!",
        "vibe": "Tender • Soulful • Romantic",
        "suggested_eq": "Vocal Brilliance",
        "tracks": [
            {"title": "Vaseegara", "artist": "Bombay Jayashri • Minnale"},
            {"title": "Munbe Vaa", "artist": "Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal"},
            {"title": "Enna Sona", "artist": "A.R. Rahman, Arijit Singh • OK Jaanu"},
            {"title": "Maruvarthai", "artist": "Sid Sriram • Enai Noki Paayum Thota"},
            {"title": "Thalli Pogathey", "artist": "Sid Sriram • Achcham Yenbadhu Madamaiyada"},
            {"title": "New York Nagaram", "artist": "A.R. Rahman • Sillunu Oru Kaadhal"},
            {"title": "Kannazhaga", "artist": "Anirudh Ravichander, Shruti Haasan • 3"},
            {"title": "Pookkal Pookkum", "artist": "Roop Kumar Rathod, Harini • Madrasapattinam"}
        ]
    },
    "road trip": {
        "title": "Epic Highway & Road Trip 🚗💨",
        "intro": "Full volume, windows down, open highway! High-tempo road trip anthems ready nanba! Payanam thrilling-a irukum!",
        "vibe": "Energetic • Fast BPM • Travel",
        "suggested_eq": "Bass Monster",
        "tracks": [
            {"title": "Badass", "artist": "Anirudh Ravichander • Leo"},
            {"title": "Hukum - Thalaivar Alappara", "artist": "Anirudh Ravichander • Jailer"},
            {"title": "Naa Ready", "artist": "Thalapathy Vijay, Anirudh • Leo"},
            {"title": "Starboy", "artist": "The Weeknd, Daft Punk"},
            {"title": "Blinding Lights", "artist": "The Weeknd"},
            {"title": "Chaiyya Chaiyya", "artist": "Sukhwinder Singh, Sapna Awasthi • Dil Se"},
            {"title": "Urvashi Urvashi", "artist": "A.R. Rahman • Kadhalan"},
            {"title": "Illuminati", "artist": "Sushin Shyam • Aavesham"}
        ]
    },
    "morning": {
        "title": "Fresh Morning Sunshine & Coffee ☕🌅",
        "intro": "Kaalai vanakkam nanba! Fresh-a start panna peaceful acoustic melodies and morning breeze vibes ready!",
        "vibe": "Acoustic • Uplifting • Fresh",
        "suggested_eq": "Acoustic Clarity",
        "tracks": [
            {"title": "Chinna Chinna Aasai", "artist": "Minmini • Roja"},
            {"title": "Pachai Nirame", "artist": "Hariharan, Clinton Cerejo • Alaipayuthey"},
            {"title": "Moongil Thottam", "artist": "Abhay Jodhpurkar, Harini • Kadal"},
            {"title": "Omana Penne", "artist": "Benny Dayal • Vinnaithaandi Varuvaayaa"},
            {"title": "Nenjukkul Peidhidum", "artist": "Hariharan, Devan • Vaaranam Aayiram"},
            {"title": "Vaan Varuvaan", "artist": "Shashaa Tirupati • Kaatru Veliyidai"},
            {"title": "En Iniya Pon Nilave", "artist": "K.J. Yesudas • Moodu Pani"}
        ]
    },
    "coding": {
        "title": "Deep Focus Coding & Flow State 💻⚡",
        "intro": "Syntax errors ellam parandhu pogum! Pure deep concentration and synth rhythm mix for hardcore programming nanba.",
        "vibe": "Ambient Synth • Cyberpunk • Zero Distraction",
        "suggested_eq": "Club EDM",
        "tracks": [
            {"title": "Interstellar Main Theme", "artist": "Hans Zimmer"},
            {"title": "Doctor BGM Score", "artist": "Anirudh Ravichander • Doctor"},
            {"title": "Mastermind Theme", "artist": "Anirudh Ravichander • Master"},
            {"title": "Lofi Fruit Chill Beats", "artist": "Lofi Chillhop"},
            {"title": "Vinnaithaandi Varuvaayaa Background Score", "artist": "A.R. Rahman"},
            {"title": "Vikram Title Instrumental", "artist": "Anirudh Ravichander"}
        ]
    },
    "devotional": {
        "title": "Peaceful Spiritual & Devotional 🪔🙏",
        "intro": "Manadhil amaidhiyum bakthiyum tharum divine songs nanba. Positive vibrations and spiritual aura!",
        "vibe": "Divine • Meditative • Sacred",
        "suggested_eq": "Maestro Vinyl",
        "tracks": [
            {"title": "Kanda Sashti Kavasam", "artist": "Mahanadhi Shobana"},
            {"title": "Harivarasanam", "artist": "K.J. Yesudas"},
            {"title": "Alaipayuthey Kanna", "artist": "Bombay Jayashri"},
            {"title": "Krishna Nee Begane Baaro", "artist": "Colonial Cousins"},
            {"title": "Gayatri Mantra Divine Chants", "artist": "Anuradha Paudwal"},
            {"title": "Jagadananda Karaka", "artist": "Balamuralikrishna • Sri Rama Rajyam"}
        ]
    }
}

# ==============================================================================
# Song Insights Knowledge Base (Expanded to 10 Songs with Rich Stories & Lyrics)
# ==============================================================================
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
    },
    "porkanda singam": {
        "theme": "Father's quiet sacrifice, grief, and silent warrior endurance.",
        "emotion": "Deep emotional ache, gritty melancholic resilience.",
        "story": "Sung by Ravi G and composed by Anirudh for Kamal Haasan's 'Vikram'. Captures the heartbreak of Agent Vikram holding his infant grandson, mourning his lost son while steeling his heart for vengeance.",
        "lines": [
            {"tamil": "Porkanda singame... un tholil saayave", "meaning": "Lion of the battlefield... to rest upon your strong shoulders."},
            {"tamil": "Kanneerai thudaikka oru thaayum illaye", "meaning": "There is not even a mother left to wipe away these bitter tears."}
        ],
        "composer_notes": "Somber acoustic strings layered over a heart-wrenching sarangi melody and muted acoustic drums.",
        "recommended_eq": "Vocal Brilliance (+3dB at 2kHz for raw vocal emotion)"
    },
    "badass": {
        "theme": "Unfiltered swagger, untouchable danger, and underworld dominance.",
        "emotion": "Adrenaline rush, relentless power, hyper-energetic rage.",
        "story": "Sung by Anirudh for Thalapathy Vijay in 'Leo'. Serves as the high-octane background anthem introducing Leo Das's violent past and lethal precision in bloody action sequences.",
        "lines": [
            {"tamil": "Badass Mr. Leo Das is a badass!", "meaning": "Unapologetic testament to the ruthless supremacy of Leo Das."},
            {"tamil": "Kattum katti kalavaram panna poran", "meaning": "He is about to unleash unbridled chaos and storm the fortress."}
        ],
        "composer_notes": "Heavily distorted 808 sub-bass, punchy snare hits, and electric guitar riffs tuned to maximum aggression.",
        "recommended_eq": "Bass Monster (+6dB at 64Hz, +4dB at 125Hz)"
    },
    "munbe vaa": {
        "theme": "Ethereal poetic romance, breathtaking surrender, and timeless passion.",
        "emotion": "Sublime, enchanting romantic ecstasy.",
        "story": "Composed by Mozart of Madras A.R. Rahman with lyrics by Vaali for 'Sillunu Oru Kaadhal'. Sung by Naresh Iyer and Shreya Ghoshal, revered for Shreya's breathtaking vocal dynamics and heartfelt improvisations.",
        "lines": [
            {"tamil": "Munbe vaa en anbe vaa, oone vaa uyire vaa", "meaning": "Come before me, my beloved, come as my flesh, come as my very soul."},
            {"tamil": "Nilavidam vaadagai vaangi vizhi veetukku kudi vaikkalaama", "meaning": "Shall I rent the moonlight and lodge it inside your eyes?"}
        ],
        "composer_notes": "A.R. Rahman blends classical ragas (Desh / Khamas flavor) with ambient synths and classical Indian tabla.",
        "recommended_eq": "Acoustic Clarity (+4dB at 1kHz, +3dB at 8kHz for vocal sparkle)"
    },
    "naa ready": {
        "theme": "Celebration of brotherhood, unshakeable loyalty, and raw street energy.",
        "emotion": "Boisterous, high-spirited, celebratory mass frenzy.",
        "story": "Sung by Thalapathy Vijay and Anirudh with lyrics by Vishnu Edavan for 'Leo'. Vijay's iconic voice paired with street drums created one of 2023's biggest chartbusters worldwide.",
        "lines": [
            {"tamil": "Naa ready dhaan varavaa, annanna irangavaa", "meaning": "I am ready, shall I arrive? Shall your elder brother step into the arena?"},
            {"tamil": "Pathaathu bottle naalu kuthu, thala suthu", "meaning": "Bottles won't suffice, drop the heavy rhythm until our heads spin in joy!"}
        ],
        "composer_notes": "Driven by traditional Tamil street dappankuthu percussion fused with synthetic trap rolls and brass stabs.",
        "recommended_eq": "Club EDM (+5dB at 64Hz, +3dB at 2kHz)"
    },
    "manasilaayo": {
        "theme": "Grand festival greeting, timeless mass euphoria, and affectionate celebration.",
        "emotion": "Joyous, infectious carnival energy and nostalgia.",
        "story": "From 'Vettaiyan' (2024), starring Superstar Rajinikanth and Manju Warrier. Composed by Anirudh, it pays a heartwarming tribute to the legendary Malaysia Vasudevan using restored and AI-assisted vocal harmonics.",
        "lines": [
            {"tamil": "Manasilaayo... idhu thaan da mass-u!", "meaning": "Did you get it? This right here is what real mass appeal is all about!"},
            {"tamil": "Vettiya potu kalakku, thalaivan vararu paaru", "meaning": "Fold your dhoti and celebrate, behold the arrival of our supreme leader!"}
        ],
        "composer_notes": "Celebratory brass trumpet fanfares, nadaswaram flourishes, and rolling south Indian kuthu drums.",
        "recommended_eq": "Festival Brass (+4dB at 250Hz, +5dB at 4kHz)"
    },
    "nenjame": {
        "theme": "Quiet introspection, inner healing, and unexpressed sorrow.",
        "emotion": "Gentle melancholy, reassuring warmth, and emotional solace.",
        "story": "Written and composed by Anirudh for Sivakarthikeyan's 'Doctor'. The song acts as a soothing balm for a weary heart, urging the soul to stay resilient despite unspoken grief.",
        "lines": [
            {"tamil": "Nenjame nenjame urugadha, vizhiye vizhiye kalangadha", "meaning": "O dear heart, do not melt in despair; O eyes, do not shed tears."},
            {"tamil": "Kaalame kaalame maaraadha, kaayangal aaraadha", "meaning": "Will the times not change? Will these wounds not heal?"}
        ],
        "composer_notes": "Gentle fingerpicked acoustic guitar, subtle electronic pads, and Anirudh's intimate, breathy vocal tone.",
        "recommended_eq": "Acoustic Warmth (+3dB at 500Hz, +3dB at 2kHz)"
    }
}

# ==============================================================================
# Semantic Keyword & Tamil Romanized Keyword Mapping
# ==============================================================================
KEYWORD_MAPPING = {
    "gym": [
        "gym", "workout", "fitness", "beast", "energy", "pump", "power", "heavy",
        "weight", "sweat", "lift", "training", "udarpayirchi", "muscle", "adrenaline",
        "verithanam", "sandai", "fight"
    ],
    "late night drive": [
        "drive", "car", "night", "midnight", "cruis", "highway", "vandi", "payanam",
        "iravu", "thookkam", "moon", "star", "dark", "speed", "traffic", "lonely drive"
    ],
    "party": [
        "party", "dance", "kuthu", "blast", "club", "celebrat", "dj", "fast",
        "dappankuthu", "aatam", "thiruvizha", "santhosham", "kushi", "sound", "bass boost"
    ],
    "rainy": [
        "rain", "mazhai", "weather", "coffee", "monsoon", "tea", "chill", "saral",
        "thooram", "kadalai", "storm", "umbrella"
    ],
    "breakup": [
        "breakup", "sad", "alone", "cry", "pain", "heal", "miss", "heartbreak",
        "vali", "sogam", "pirivu", "kaneer", "azhugai", "thunbam", "alone", "depressed",
        "unrequited"
    ],
    "90s": [
        "90s", "80s", "old", "ilaiyaraaja", "spb", "vintage", "retro", "classic",
        "maestro", "pazhaiya", "raaja", "janaki", "yesudas", "nostalgia", "black and white"
    ],
    "study": [
        "study", "focus", "read", "work", "calm", "peace", "lofi", "relax",
        "padipu", "padikkanum", "exam", "concentration", "deep work", "zen", "silence"
    ],
    "romantic": [
        "romantic", "romance", "love", "kadhal", "kaadhal", "crush", "lover",
        "anbu", "sweetheart", "candlelight", "propose", "rose", "valentine", "heart"
    ],
    "road trip": [
        "road trip", "trip", "highway", "travel", "tour", "vacation", "hills",
        "ooty", "kodaikanal", "goa", "voyage", "journey", "breeze", "bike trip", "riders"
    ],
    "morning": [
        "morning", "kaalai", "fresh", "sunshine", "sunrise", "vidiyal", "alarm",
        "early", "meditation", "positive", "start the day", "thendral"
    ],
    "coding": [
        "coding", "code", "programming", "software", "developer", "terminal",
        "flow state", "hack", "algorithm", "python", "typescript", "debug", "nerd"
    ],
    "devotional": [
        "devotional", "bakthi", "saami", "god", "temple", "kovil", "spiritual",
        "prayer", "prarthanai", "pooja", "murugan", "shiva", "krishna", "ayyappan",
        "slokam", "mantra", "peace of mind"
    ]
}

# ==============================================================================
# Semantic Matching Helper Functions
# ==============================================================================
def string_similarity(a: str, b: str) -> float:
    """Calculate SequenceMatcher similarity between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def detect_vibe(prompt: str) -> dict:
    """
    Score the prompt against all mood presets using keyword matching,
    substring detection, and fuzzy similarity.
    """
    p = prompt.lower().strip()
    words = re.findall(r'[a-z0-9]+', p)

    scores = {mood: 0.0 for mood in MOOD_PRESETS}

    # 1. Exact or direct substring matches
    for mood, keywords in KEYWORD_MAPPING.items():
        if mood in p:
            scores[mood] += 5.0

        for kw in keywords:
            # Whole word match
            if kw in words:
                scores[mood] += 3.0
            # Substring match (for partial Tamil words)
            elif len(kw) >= 4 and kw in p:
                scores[mood] += 1.5

            # Fuzzy word matching
            for w in words:
                if len(w) >= 4 and len(kw) >= 4:
                    sim = string_similarity(w, kw)
                    if sim > 0.8:
                        scores[mood] += sim * 2.0

    # Pick the best scoring mood if score threshold met
    best_mood = max(scores, key=scores.get)
    if scores[best_mood] >= 2.0:
        return MOOD_PRESETS[best_mood]

    # Dynamic customized fallback if no preset is a clear match
    clean_title = prompt.strip().title()
    return {
        "title": f"Custom AI Vibe: {clean_title} ✨",
        "intro": f"Ungaloda vibe '{prompt}'-ku thagundha maadhiri best trending and melodic tracks customize panniruken nanba!",
        "vibe": "Eclectic • Personalized",
        "suggested_eq": "Acoustic Clarity",
        "tracks": [
            {"title": f"{clean_title} Mix", "artist": "Trending Artist"},
            {"title": "Arabic Kuthu", "artist": "Anirudh Ravichander • Beast"},
            {"title": "Hukum", "artist": "Anirudh Ravichander • Jailer"},
            {"title": "Illuminati", "artist": "Sushin Shyam • Aavesham"},
            {"title": "Vaseegara", "artist": "Bombay Jayashri • Minnale"},
            {"title": "Porkanda Singam", "artist": "Anirudh Ravichander • Vikram"},
            {"title": "Munbe Vaa", "artist": "Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal"}
        ]
    }

def handle_dj(prompt: str):
    vibe = detect_vibe(prompt)
    print(json.dumps(vibe))

def handle_insights(song_title: str, artist: str = ""):
    query = song_title.lower().strip()
    matched = None

    # Check for direct key match
    for key in SONG_INSIGHTS_DB:
        if key in query or query in key:
            matched = SONG_INSIGHTS_DB[key]
            break

    # Fuzzy match if no direct substring match
    if not matched:
        best_key = None
        best_score = 0.0
        for key in SONG_INSIGHTS_DB:
            score = string_similarity(query, key)
            if score > best_score:
                best_score = score
                best_key = key
        if best_score > 0.6 and best_key:
            matched = SONG_INSIGHTS_DB[best_key]

    if not matched:
        # Generate smart generalized insight
        clean_title = re.sub(r'\(.*?\)|\[.*?\]', '', song_title).strip()
        matched = {
            "theme": f"Emotional musical narrative centering around {clean_title}.",
            "emotion": "Dynamic, vibrant musical expression.",
            "story": f"'{clean_title}' showcases expressive vocal storytelling, rich orchestration, and atmospheric production.",
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
    elif any(w in msg for w in ["meaning", "lyrics", "explain song", "kadha", "story"]):
        title = current_song.get("title", "Current song")
        reply_text = f"'{title}' lyrics breakdown & background story Now Playing -> 'AI Insights' tab-la ready-a irukku nanba! 📜✨"
        suggested_action = {"type": "OPEN_AI_INSIGHTS"}
    elif any(w in msg for w in ["dj", "vibe", "mood", "recommend"]):
        reply_text = "AI DJ Studio-ku ponga nanba! Anga 'Gym', 'Late night drive', 'Romantic', 'Coding', 'Devotional' nu types panna instant custom playlist kedaikum! 🎧"
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

# ==============================================================================
# CLI Entry Point
# ==============================================================================
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
