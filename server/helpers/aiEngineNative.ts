/**
 * server/helpers/aiEngineNative.ts
 *
 * Pure TypeScript implementation of the Aura AI Engine.
 * Runs directly in Node.js / Vercel Serverless without requiring Python or child processes.
 * Features:
 * - 12 Curated Mood / Vibe presets with fuzzy & Romanized Tamil keyword matching
 * - Dynamic custom vibe generator for arbitrary user prompts
 * - Song insights database with poetic translations, composer notes, and smart EQ recommendations
 * - Conversational AI Music Assistant with intent detection for player controls & EQ presets
 */

export interface TrackItem {
  title: string;
  artist: string;
}

export interface DjMixResult {
  title: string;
  intro: string;
  vibe: string;
  suggested_eq: string;
  tracks: TrackItem[];
}

export interface InsightLine {
  tamil: string;
  meaning: string;
}

export interface SongInsightResult {
  theme: string;
  emotion: string;
  story: string;
  lines: InsightLine[];
  composer_notes: string;
  recommended_eq: string;
}

export interface ChatActionResult {
  type: string;
  preset?: string;
  tab?: string;
}

export interface ChatResponseResult {
  reply: string;
  action: ChatActionResult | null;
}

// ==============================================================================
// 1. Comprehensive Mood Presets (12 Curated Presets)
// ==============================================================================
export const MOOD_PRESETS: Record<string, DjMixResult> = {
  'late night drive': {
    title: 'Midnight City Cruise 🌙',
    intro: 'Vera level chill mix nanba! Midnight drive-ku smooth bass and atmospheric synth melodies pick panniruken. Enjoy the vibe!',
    vibe: 'Smooth • Atmospheric • Melodic',
    suggested_eq: 'Late Night Warmth',
    tracks: [
      { title: 'Vaseegara', artist: 'Bombay Jayashri • Minnale' },
      { title: 'Venmathi Venmathiye', artist: 'Roop Kumar Rathod, Tipu • Minnale' },
      { title: 'Porkanda Singam', artist: 'Anirudh Ravichander • Vikram' },
      { title: 'Starboy', artist: 'The Weeknd, Daft Punk' },
      { title: 'Nenjame', artist: 'Anirudh Ravichander • Doctor' },
      { title: 'Enna Sona', artist: 'A.R. Rahman, Arijit Singh • OK Jaanu' },
      { title: 'Blinding Lights', artist: 'The Weeknd' },
      { title: 'Munbe Vaa', artist: 'Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal' }
    ]
  },
  'gym': {
    title: 'Gym Beast Mode 💥🔥',
    intro: 'Adra sakkai! Heavy bass drops and max adrenaline tracks ready! Workout-la PR break panna idho unga high-energy booster mix!',
    vibe: 'High Energy • Punchy Bass • Aggressive',
    suggested_eq: 'Bass Monster',
    tracks: [
      { title: 'Badass', artist: 'Anirudh Ravichander • Leo' },
      { title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander • Jailer' },
      { title: 'Naa Ready', artist: 'Thalapathy Vijay, Anirudh • Leo' },
      { title: 'Vikram Title Track', artist: 'Anirudh Ravichander • Vikram' },
      { title: 'Arabic Kuthu', artist: 'Anirudh Ravichander • Beast' },
      { title: 'Illuminati', artist: 'Sushin Shyam • Aavesham' },
      { title: 'Believer', artist: 'Imagine Dragons' },
      { title: 'The Monster', artist: 'Eminem ft. Rihanna' }
    ]
  },
  'party': {
    title: 'Full Kuthu Party Blast 🥳🎉',
    intro: 'Speaker blast aagura maadhiri instant celebration mode on! Dance floor-ah kalaka porom, volume-ah yethunga!',
    vibe: 'Festival Beats • Fast Tempo • Dance',
    suggested_eq: 'Club EDM',
    tracks: [
      { title: 'Arabic Kuthu', artist: 'Anirudh Ravichander • Beast' },
      { title: 'Kaavaalaa', artist: 'Anirudh Ravichander, Shilpa Rao • Jailer' },
      { title: 'Illuminati', artist: 'Sushin Shyam • Aavesham' },
      { title: 'Manasilaayo', artist: 'Anirudh Ravichander • Vettaiyan' },
      { title: 'Vaathi Coming', artist: 'Anirudh Ravichander • Master' },
      { title: 'Jalabulanjangu', artist: 'Anirudh Ravichander • Don' },
      { title: 'Rowdy Baby', artist: 'Dhanush, Dhee • Maari 2' },
      { title: 'Aaluma Doluma', artist: 'Anirudh Ravichander • Vedalam' }
    ]
  },
  'rainy': {
    title: 'Rainy Day Nostalgia Melodies 🌧️☕',
    intro: 'Kadalai/Coffee kooda mazhai peiyumpothu kekka vendiya soothing soul melodies. Mind-ah peace aakidum nanba.',
    vibe: 'Acoustic • Melodic • Nostalgic',
    suggested_eq: 'Acoustic Clarity',
    tracks: [
      { title: 'Mazhai Kuruvi', artist: 'A.R. Rahman • Chekka Chivantha Vaanam' },
      { title: 'Vaseegara', artist: 'Bombay Jayashri • Minnale' },
      { title: 'Pookkal Pookkum', artist: 'Roop Kumar Rathod, Harini • Madrasapattinam' },
      { title: 'Unakkul Naane', artist: 'Pradeep Kumar • Pachaikili Muthucharam' },
      { title: 'New York Nagaram', artist: 'A.R. Rahman • Sillunu Oru Kaadhal' },
      { title: 'Kannazhaga', artist: 'Anirudh Ravichander, Shruti Haasan • 3' },
      { title: 'Anbil Avan', artist: 'Devan Ekambaram, Chinmayi • Vinnaithaandi Varuvaayaa' }
    ]
  },
  'breakup': {
    title: 'Soulful Heartbreak & Healing 💔🌧️',
    intro: 'Vali kooda oru azhagu dhaan nanba. Heart-la irukura baaram kuraiya indha deep emotional melodies help pannum.',
    vibe: 'Deep Soul • Slow Tempo • Melancholic',
    suggested_eq: 'Vocal Brilliance',
    tracks: [
      { title: 'Porkanda Singam', artist: 'Anirudh Ravichander • Vikram' },
      { title: 'Nenjame', artist: 'Anirudh Ravichander • Doctor' },
      { title: 'Po Nee Po', artist: 'Mohit Chauhan, Anirudh • 3' },
      { title: 'Kanave Kanave', artist: 'Anirudh Ravichander • David' },
      { title: 'En Iniya Pon Nilave', artist: 'K.J. Yesudas • Moodu Pani' },
      { title: 'Someone Like You', artist: 'Adele' },
      { title: 'Maruvarthai', artist: 'Sid Sriram • Enai Noki Paayum Thota' }
    ]
  },
  '90s': {
    title: '90s Golden Era Nostalgia 📻✨',
    intro: 'Isaignani Ilaiyaraaja and Maestro A.R. Rahman magical era! Live instruments and everlasting lyrics combo!',
    vibe: 'Vintage • Maestro Melody • Warm Vinyl',
    suggested_eq: 'Maestro Vinyl',
    tracks: [
      { title: 'Sundari Kannal Oru Sethi', artist: 'S.P. Balasubrahmanyam, S. Janaki • Thalapathi' },
      { title: 'Rakkamma Kaiya Thattu', artist: 'S.P. Balasubrahmanyam, Swarnalatha • Thalapathi' },
      { title: 'Thenpandi Cheemayile', artist: 'Kamal Haasan, Ilaiyaraaja • Nayagan' },
      { title: 'Chinna Chinna Aasai', artist: 'Minmini • Roja' },
      { title: 'Kannalane', artist: 'K.S. Chithra • Bombay' },
      { title: 'Kaadhal Rojave', artist: 'S.P. Balasubrahmanyam • Roja' },
      { title: 'Mandram Vandha Thendralukku', artist: 'S.P. Balasubrahmanyam • Mouna Ragam' }
    ]
  },
  'study': {
    title: 'Deep Focus & Study Flow 🎧📚',
    intro: 'Distraction-e illama deep work and study panna perfect lo-fi and instrumental acoustic calm beats.',
    vibe: 'Ambient • Lo-Fi • Zero Distraction',
    suggested_eq: 'Acoustic Clarity',
    tracks: [
      { title: 'Minnale BGM Theme', artist: 'Harris Jayaraj • Minnale' },
      { title: 'Vinnaithaandi Varuvaayaa Background Score', artist: 'A.R. Rahman' },
      { title: 'Lofi Fruit Chill Beats', artist: 'Lofi Chillhop' },
      { title: 'Interstellar Main Theme', artist: 'Hans Zimmer' },
      { title: '96 Life of Ram Melody Instrumental', artist: 'Govind Vasantha' },
      { title: 'Doctor BGM Score', artist: 'Anirudh Ravichander' }
    ]
  },
  'romantic': {
    title: 'Pure Romance & Melody Magic 💖🌹',
    intro: 'Kaadhal melodies mattume nanba! Heart-ah melt panna soulful romantic tracks pick panniruken. Enjoy with that special someone!',
    vibe: 'Tender • Soulful • Romantic',
    suggested_eq: 'Vocal Brilliance',
    tracks: [
      { title: 'Vaseegara', artist: 'Bombay Jayashri • Minnale' },
      { title: 'Munbe Vaa', artist: 'Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal' },
      { title: 'Enna Sona', artist: 'A.R. Rahman, Arijit Singh • OK Jaanu' },
      { title: 'Maruvarthai', artist: 'Sid Sriram • Enai Noki Paayum Thota' },
      { title: 'Thalli Pogathey', artist: 'Sid Sriram • Achcham Yenbadhu Madamaiyada' },
      { title: 'New York Nagaram', artist: 'A.R. Rahman • Sillunu Oru Kaadhal' },
      { title: 'Kannazhaga', artist: 'Anirudh Ravichander, Shruti Haasan • 3' },
      { title: 'Pookkal Pookkum', artist: 'Roop Kumar Rathod, Harini • Madrasapattinam' }
    ]
  },
  'road trip': {
    title: 'Epic Highway & Road Trip 🚗💨',
    intro: 'Full volume, windows down, open highway! High-tempo road trip anthems ready nanba! Payanam thrilling-a irukum!',
    vibe: 'Energetic • Fast BPM • Travel',
    suggested_eq: 'Bass Monster',
    tracks: [
      { title: 'Badass', artist: 'Anirudh Ravichander • Leo' },
      { title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander • Jailer' },
      { title: 'Naa Ready', artist: 'Thalapathy Vijay, Anirudh • Leo' },
      { title: 'Starboy', artist: 'The Weeknd, Daft Punk' },
      { title: 'Blinding Lights', artist: 'The Weeknd' },
      { title: 'Chaiyya Chaiyya', artist: 'Sukhwinder Singh, Sapna Awasthi • Dil Se' },
      { title: 'Urvashi Urvashi', artist: 'A.R. Rahman • Kadhalan' },
      { title: 'Illuminati', artist: 'Sushin Shyam • Aavesham' }
    ]
  },
  'morning': {
    title: 'Fresh Morning Sunshine & Coffee ☕🌅',
    intro: 'Kaalai vanakkam nanba! Fresh-a start panna peaceful acoustic melodies and morning breeze vibes ready!',
    vibe: 'Acoustic • Uplifting • Fresh',
    suggested_eq: 'Acoustic Clarity',
    tracks: [
      { title: 'Chinna Chinna Aasai', artist: 'Minmini • Roja' },
      { title: 'Pachai Nirame', artist: 'Hariharan, Clinton Cerejo • Alaipayuthey' },
      { title: 'Moongil Thottam', artist: 'Abhay Jodhpurkar, Harini • Kadal' },
      { title: 'Omana Penne', artist: 'Benny Dayal • Vinnaithaandi Varuvaayaa' },
      { title: 'Nenjukkul Peidhidum', artist: 'Hariharan, Devan • Vaaranam Aayiram' },
      { title: 'Vaan Varuvaan', artist: 'Shashaa Tirupati • Kaatru Veliyidai' },
      { title: 'En Iniya Pon Nilave', artist: 'K.J. Yesudas • Moodu Pani' }
    ]
  },
  'coding': {
    title: 'Deep Focus Coding & Flow State 💻⚡',
    intro: 'Syntax errors ellam parandhu pogum! Pure deep concentration and synth rhythm mix for hardcore programming nanba.',
    vibe: 'Ambient Synth • Cyberpunk • Zero Distraction',
    suggested_eq: 'Club EDM',
    tracks: [
      { title: 'Interstellar Main Theme', artist: 'Hans Zimmer' },
      { title: 'Doctor BGM Score', artist: 'Anirudh Ravichander • Doctor' },
      { title: 'Mastermind Theme', artist: 'Anirudh Ravichander • Master' },
      { title: 'Lofi Fruit Chill Beats', artist: 'Lofi Chillhop' },
      { title: 'Vinnaithaandi Varuvaayaa Background Score', artist: 'A.R. Rahman' },
      { title: 'Vikram Title Instrumental', artist: 'Anirudh Ravichander' }
    ]
  },
  'devotional': {
    title: 'Peaceful Spiritual & Devotional 🪔🙏',
    intro: 'Manadhil amaidhiyum bakthiyum tharum divine songs nanba. Positive vibrations and spiritual aura!',
    vibe: 'Divine • Meditative • Sacred',
    suggested_eq: 'Maestro Vinyl',
    tracks: [
      { title: 'Kanda Sashti Kavasam', artist: 'Mahanadhi Shobana' },
      { title: 'Harivarasanam', artist: 'K.J. Yesudas' },
      { title: 'Alaipayuthey Kanna', artist: 'Bombay Jayashri' },
      { title: 'Krishna Nee Begane Baaro', artist: 'Colonial Cousins' },
      { title: 'Gayatri Mantra Divine Chants', artist: 'Anuradha Paudwal' },
      { title: 'Jagadananda Karaka', artist: 'Balamuralikrishna • Sri Rama Rajyam' }
    ]
  }
};

// ==============================================================================
// 2. Tamil Romanized Keywords for Semantic Intent
// ==============================================================================
const KEYWORD_MAPPING: Record<string, string[]> = {
  'gym': [
    'gym', 'workout', 'fitness', 'beast', 'energy', 'pump', 'power', 'heavy',
    'weight', 'sweat', 'lift', 'training', 'udarpayirchi', 'muscle', 'adrenaline',
    'verithanam', 'sandai', 'fight'
  ],
  'late night drive': [
    'drive', 'car', 'night', 'midnight', 'cruis', 'highway', 'vandi', 'payanam',
    'iravu', 'thookkam', 'moon', 'star', 'dark', 'speed', 'traffic', 'lonely drive'
  ],
  'party': [
    'party', 'dance', 'kuthu', 'blast', 'club', 'celebrat', 'dj', 'fast',
    'dappankuthu', 'aatam', 'thiruvizha', 'santhosham', 'kushi', 'sound', 'bass boost'
  ],
  'rainy': [
    'rain', 'mazhai', 'weather', 'coffee', 'monsoon', 'tea', 'chill', 'saral',
    'thooram', 'kadalai', 'storm', 'umbrella'
  ],
  'breakup': [
    'breakup', 'sad', 'alone', 'cry', 'pain', 'heal', 'miss', 'heartbreak',
    'vali', 'sogam', 'pirivu', 'kaneer', 'azhugai', 'thunbam', 'depressed',
    'unrequited'
  ],
  '90s': [
    '90s', '80s', 'old', 'ilaiyaraaja', 'spb', 'vintage', 'retro', 'classic',
    'maestro', 'pazhaiya', 'raaja', 'janaki', 'yesudas', 'nostalgia', 'black and white'
  ],
  'study': [
    'study', 'focus', 'read', 'work', 'calm', 'peace', 'lofi', 'relax',
    'padipu', 'padikkanum', 'exam', 'concentration', 'deep work', 'zen', 'silence'
  ],
  'romantic': [
    'romantic', 'romance', 'love', 'kadhal', 'kaadhal', 'crush', 'lover',
    'anbu', 'sweetheart', 'candlelight', 'propose', 'rose', 'valentine', 'heart'
  ],
  'road trip': [
    'road trip', 'trip', 'highway', 'travel', 'tour', 'vacation', 'hills',
    'ooty', 'kodaikanal', 'goa', 'voyage', 'journey', 'breeze', 'bike trip', 'riders'
  ],
  'morning': [
    'morning', 'kaalai', 'fresh', 'sunshine', 'sunrise', 'vidiyal', 'alarm',
    'early', 'meditation', 'positive', 'start the day', 'thendral'
  ],
  'coding': [
    'coding', 'code', 'programming', 'software', 'developer', 'terminal',
    'flow state', 'hack', 'algorithm', 'python', 'typescript', 'debug', 'nerd'
  ],
  'devotional': [
    'devotional', 'bakthi', 'saami', 'god', 'temple', 'kovil', 'spiritual',
    'prayer', 'prarthanai', 'pooja', 'murugan', 'shiva', 'krishna', 'ayyappan',
    'slokam', 'mantra', 'peace of mind'
  ]
};

// ==============================================================================
// 3. Song Insights Knowledge Base
// ==============================================================================
export const SONG_INSIGHTS_DB: Record<string, SongInsightResult> = {
  'arabic kuthu': {
    theme: 'Cross-cultural Mediterranean folk dance & Tamil mass kuthu fusion.',
    emotion: 'Ecstatic, playful, upbeat dance energy.',
    story: "Director Nelson Dilipkumar & Anirudh Ravichander wanted an unconventional party anthem featuring invented Arabic-rhyming gibberish words ('Halamithi Habibo', 'Malama Pitha Pithadhe') written by actor Sivakarthikeyan. It quickly became a worldwide viral sensation with over 500M+ streams.",
    lines: [
      { tamil: 'Halamithi Habibo', meaning: "A rhythmic invented phrase blending Arabic affectionate slang ('Habibi' meaning beloved) with Tamil kuthu rhythm." },
      { tamil: 'Malama Pitha Pithadhe', meaning: "Playful freestyle hook expressing irresistible urge to dance under the lover's charm." },
      { tamil: 'Azhagana ponnu siricha, adhirumada heart-u', meaning: 'When a beautiful girl smiles, your heart beats like thunder!' }
    ],
    composer_notes: 'Anirudh combined Arabic Oud and Darbuka percussion with Tamil Thavil and electronic synth bass drops.',
    recommended_eq: 'Bass Monster (+6dB at 64Hz for thunderous bass drums)'
  },
  'hukum': {
    theme: 'Unyielding dominance, superstar legacy, and lionhearted authority.',
    emotion: 'Fierce, commanding, adrenaline-pumping goosebumps.',
    story: "Written by Super Subu for Superstar Rajinikanth in 'Jailer'. 'Hukum' is an Urdu/Hindi derived word for 'Order / Command'. The song establishes that no matter who enters the game, the King remains the King.",
    lines: [
      { tamil: 'Hukum... Tiger Ka Hukum', meaning: 'Order... This is the Tiger\'s absolute decree!' },
      { tamil: 'Alapparai kelapparom, thalaiyila vaipom', meaning: 'We make the grandest noise and wear our pride on our head.' },
      { tamil: 'Kodi parakkudha, thalaivan irukkanda', meaning: 'Is our flag flying high? Know that the undisputed leader is here!' }
    ],
    composer_notes: 'Features heavy distorted electric guitar riffs, deep punchy brass sections, and Anirudh\'s raw vocal delivery.',
    recommended_eq: 'Rock Punch (+5dB at 125Hz, +4dB at 4kHz)'
  },
  'illuminati': {
    theme: 'Retro synthwave club celebration of wild friendship and carefree swagger.',
    emotion: 'Addictive, hypnotic, stylish cool vibe.',
    story: "Composed by Sushin Shyam and sung by Dabzee for the Malayalam superhit 'Aavesham' starring Fahadh Faasil (Ranga Annan). Became an all-India viral dance craze across TikTok, Reels, and clubs.",
    lines: [
      { tamil: 'Illuminati... athirum ivan varum vazhi', meaning: 'The mysterious power that shakes whatever road he walks upon.' },
      { tamil: 'Koodave ninnu kalakkum namma gang', meaning: 'Standing shoulder to shoulder, our crew owns the town!' }
    ],
    composer_notes: 'Built on an 80s analog synth bass arpeggio, 808 trap snares, and Malayalam rap cadence.',
    recommended_eq: 'Club EDM (+5dB at 64Hz, +4dB at 16kHz)'
  },
  'vaseegara': {
    theme: 'Sensual, tender romantic surrender and eternal longing.',
    emotion: 'Intimate, poetic, deeply emotional love.',
    story: "Written by lyricist Thamarai and composed by Harris Jayaraj in his debut blockbuster 'Minnale' (2001). Sung with timeless grace by Carnatic maestro Bombay Jayashri.",
    lines: [
      { tamil: 'Vaseegara... en nenjinikka un pon madiyil thoonginal podhum', meaning: 'Enchanter... it is enough for my heart if I can rest my head and sleep in your golden lap.' },
      { tamil: 'Adhe kanam en kannuranga, mun jenmangalin aakkangal serum', meaning: 'The moment my eyes close in your embrace, the blessings of all my past lives unite.' }
    ],
    composer_notes: 'Minimalistic nylon-string acoustic guitar and flute accompanying pure acoustic vocal resonance.',
    recommended_eq: 'Acoustic Clarity (+4dB at 1kHz - 2kHz for intimate vocal breath)'
  },
  'porkanda singam': {
    theme: "Father's quiet sacrifice, grief, and silent warrior endurance.",
    emotion: 'Deep emotional ache, gritty melancholic resilience.',
    story: "Sung by Ravi G and composed by Anirudh for Kamal Haasan's 'Vikram'. Captures the heartbreak of Agent Vikram holding his infant grandson, mourning his lost son while steeling his heart for vengeance.",
    lines: [
      { tamil: 'Porkanda singame... un tholil saayave', meaning: 'Lion of the battlefield... to rest upon your strong shoulders.' },
      { tamil: 'Kanneerai thudaikka oru thaayum illaye', meaning: 'There is not even a mother left to wipe away these bitter tears.' }
    ],
    composer_notes: 'Somber acoustic strings layered over a heart-wrenching sarangi melody and muted acoustic drums.',
    recommended_eq: 'Vocal Brilliance (+3dB at 2kHz for raw vocal emotion)'
  },
  'badass': {
    theme: 'Unfiltered swagger, untouchable danger, and underworld dominance.',
    emotion: 'Adrenaline rush, relentless power, hyper-energetic rage.',
    story: "Sung by Anirudh for Thalapathy Vijay in 'Leo'. Serves as the high-octane background anthem introducing Leo Das's violent past and lethal precision in bloody action sequences.",
    lines: [
      { tamil: 'Badass Mr. Leo Das is a badass!', meaning: 'Unapologetic testament to the ruthless supremacy of Leo Das.' },
      { tamil: 'Kattum katti kalavaram panna poran', meaning: 'He is about to unleash unbridled chaos and storm the fortress.' }
    ],
    composer_notes: 'Heavily distorted 808 sub-bass, punchy snare hits, and electric guitar riffs tuned to maximum aggression.',
    recommended_eq: 'Bass Monster (+6dB at 64Hz, +4dB at 125Hz)'
  },
  'munbe vaa': {
    theme: 'Ethereal poetic romance, breathtaking surrender, and timeless passion.',
    emotion: 'Sublime, enchanting romantic ecstasy.',
    story: "Composed by Mozart of Madras A.R. Rahman with lyrics by Vaali for 'Sillunu Oru Kaadhal'. Sung by Naresh Iyer and Shreya Ghoshal, revered for Shreya's breathtaking vocal dynamics and heartfelt improvisations.",
    lines: [
      { tamil: 'Munbe vaa en anbe vaa, oone vaa uyire vaa', meaning: 'Come before me, my beloved, come as my flesh, come as my very soul.' },
      { tamil: 'Nilavidam vaadagai vaangi vizhi veetukku kudi vaikkalaama', meaning: 'Shall I rent the moonlight and lodge it inside your eyes?' }
    ],
    composer_notes: 'A.R. Rahman blends classical ragas (Desh / Khamas flavor) with ambient synths and classical Indian tabla.',
    recommended_eq: 'Acoustic Clarity (+4dB at 1kHz, +3dB at 8kHz for vocal sparkle)'
  },
  'naa ready': {
    theme: 'Celebration of brotherhood, unshakeable loyalty, and raw street energy.',
    emotion: 'Boisterous, high-spirited, celebratory mass frenzy.',
    story: "Sung by Thalapathy Vijay and Anirudh with lyrics by Vishnu Edavan for 'Leo'. Vijay's iconic voice paired with street drums created one of 2023's biggest chartbusters worldwide.",
    lines: [
      { tamil: 'Naa ready dhaan varavaa, annanna irangavaa', meaning: 'I am ready, shall I arrive? Shall your elder brother step into the arena?' },
      { tamil: 'Pathaathu bottle naalu kuthu, thala suthu', meaning: "Bottles won't suffice, drop the heavy rhythm until our heads spin in joy!" }
    ],
    composer_notes: 'Driven by traditional Tamil street dappankuthu percussion fused with synthetic trap rolls and brass stabs.',
    recommended_eq: 'Club EDM (+5dB at 64Hz, +3dB at 2kHz)'
  },
  'manasilaayo': {
    theme: 'Grand festival greeting, timeless mass euphoria, and affectionate celebration.',
    emotion: 'Joyous, infectious carnival energy and nostalgia.',
    story: "From 'Vettaiyan' (2024), starring Superstar Rajinikanth and Manju Warrier. Composed by Anirudh, it pays a heartwarming tribute to the legendary Malaysia Vasudevan using restored and AI-assisted vocal harmonics.",
    lines: [
      { tamil: 'Manasilaayo... idhu thaan da mass-u!', meaning: 'Did you get it? This right here is what real mass appeal is all about!' },
      { tamil: 'Vettiya potu kalakku, thalaivan vararu paaru', meaning: 'Fold your dhoti and celebrate, behold the arrival of our supreme leader!' }
    ],
    composer_notes: 'Celebratory brass trumpet fanfares, nadaswaram flourishes, and rolling south Indian kuthu drums.',
    recommended_eq: 'Festival Brass (+4dB at 250Hz, +5dB at 4kHz)'
  },
  'nenjame': {
    theme: 'Quiet introspection, inner healing, and unexpressed sorrow.',
    emotion: 'Gentle melancholy, reassuring warmth, and emotional solace.',
    story: "Written and composed by Anirudh for Sivakarthikeyan's 'Doctor'. The song acts as a soothing balm for a weary heart, urging the soul to stay resilient despite unspoken grief.",
    lines: [
      { tamil: 'Nenjame nenjame urugadha, vizhiye vizhiye kalangadha', meaning: 'O dear heart, do not melt in despair; O eyes, do not shed tears.' },
      { tamil: 'Kaalame kaalame maaraadha, kaayangal aaraadha', meaning: 'Will the times not change? Will these wounds not heal?' }
    ],
    composer_notes: 'Gentle fingerpicked acoustic guitar, subtle electronic pads, and Anirudh\'s intimate, breathy vocal tone.',
    recommended_eq: 'Acoustic Warmth (+3dB at 500Hz, +3dB at 2kHz)'
  }
};

// ==============================================================================
// 4. Similarity Calculation
// ==============================================================================
function stringSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  b1.forEach((bg) => {
    if (b2.has(bg)) intersection++;
  });
  const union = b1.size + b2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ==============================================================================
// 5. Native AI DJ Mix Generator
// ==============================================================================
export function generateDjMix(prompt: string): DjMixResult {
  const p = (prompt || 'late night drive').toLowerCase().trim();
  const words = p.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);

  const scores: Record<string, number> = {};
  for (const mood of Object.keys(MOOD_PRESETS)) {
    scores[mood] = 0;
  }

  for (const [mood, keywords] of Object.entries(KEYWORD_MAPPING)) {
    if (p.includes(mood)) {
      scores[mood] = (scores[mood] || 0) + 5.0;
    }

    for (const kw of keywords) {
      if (words.includes(kw)) {
        scores[mood] = (scores[mood] || 0) + 3.0;
      } else if (kw.length >= 4 && p.includes(kw)) {
        scores[mood] = (scores[mood] || 0) + 1.5;
      }

      for (const w of words) {
        if (w.length >= 4 && kw.length >= 4) {
          const sim = stringSimilarity(w, kw);
          if (sim > 0.7) {
            scores[mood] = (scores[mood] || 0) + sim * 2.0;
          }
        }
      }
    }
  }

  let bestMood = 'late night drive';
  let bestScore = -1;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  if (bestScore >= 2.0 && MOOD_PRESETS[bestMood]) {
    return MOOD_PRESETS[bestMood];
  }

  // Dynamic fallback for custom prompt
  const cleanTitle = prompt.trim() || 'Custom Vibe';
  return {
    title: `Custom AI Vibe: ${cleanTitle} ✨`,
    intro: `Ungaloda vibe '${prompt}'-ku thagundha maadhiri best trending and melodic tracks customize panniruken nanba!`,
    vibe: 'Eclectic • Personalized',
    suggested_eq: 'Acoustic Clarity',
    tracks: [
      { title: `${cleanTitle} Mix`, artist: 'Trending Artist' },
      { title: 'Arabic Kuthu', artist: 'Anirudh Ravichander • Beast' },
      { title: 'Hukum', artist: 'Anirudh Ravichander • Jailer' },
      { title: 'Illuminati', artist: 'Sushin Shyam • Aavesham' },
      { title: 'Vaseegara', artist: 'Bombay Jayashri • Minnale' },
      { title: 'Porkanda Singam', artist: 'Anirudh Ravichander • Vikram' },
      { title: 'Munbe Vaa', artist: 'Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal' }
    ]
  };
}

// ==============================================================================
// 6. Native Song Insights Generator
// ==============================================================================
export function getSongInsights(title: string, _artist?: string): SongInsightResult {
  const query = (title || '').toLowerCase().trim();

  // 1. Direct match
  for (const [key, val] of Object.entries(SONG_INSIGHTS_DB)) {
    if (query.includes(key) || key.includes(query)) {
      return val;
    }
  }

  // 2. Fuzzy match
  let bestKey = '';
  let bestScore = 0;
  for (const key of Object.keys(SONG_INSIGHTS_DB)) {
    const sim = stringSimilarity(query, key);
    if (sim > bestScore) {
      bestScore = sim;
      bestKey = key;
    }
  }

  if (bestScore > 0.5 && bestKey && SONG_INSIGHTS_DB[bestKey]) {
    return SONG_INSIGHTS_DB[bestKey];
  }

  // 3. Dynamic Generalized Insight
  const cleanTitle = (title || 'Track').replace(/\(.*?\)|\[.*?\]/g, '').trim() || 'Song';
  return {
    theme: `Emotional musical narrative centering around ${cleanTitle}.`,
    emotion: 'Dynamic, vibrant musical expression.',
    story: `'${cleanTitle}' showcases expressive vocal storytelling, rich orchestration, and atmospheric production.`,
    lines: [
      { tamil: cleanTitle, meaning: 'The core musical anchor and melodic hook of this composition.' },
      { tamil: 'Unnaale nenjam thudikkiradhey', meaning: 'Every beat of the heart resonates with the emotional soul of the music.' }
    ],
    composer_notes: 'Mastered with modern dynamic range, punchy low-ends, and clear vocal presence.',
    recommended_eq: 'Acoustic Clarity'
  };
}

// ==============================================================================
// 7. Native Chat Assistant
// ==============================================================================
export function processChat(message: string, currentSong: any = {}): ChatResponseResult {
  const msg = (message || '').toLowerCase();

  let replyText = '';
  let suggestedAction: ChatActionResult | null = null;

  if (['karaoke', 'vocal remover', 'mute singer', 'sing'].some((w) => msg.includes(w))) {
    replyText = 'Nanba! Karaoke mode ON/OFF button bottom player-la iruku. Ipo neenga vocals remove panni live-a karaoke paadalaam! 🎙️✨';
    suggestedAction = { type: 'TOGGLE_KARAOKE' };
  } else if (['bass', 'boost bass', 'heavy bass'].some((w) => msg.includes(w))) {
    replyText = 'Bass Beast mode ready! 10-Band Equalizer-la Sub-Bass & 64Hz-a +6dB boost panniten. Sound adipoliya irukum! 🔊🔥';
    suggestedAction = { type: 'SET_EQ_PRESET', preset: 'bass' };
  } else if (['vocal', 'clarity', 'treble', 'speech'].some((w) => msg.includes(w))) {
    replyText = 'Vocal Clarity mode activate panniten nanba! Vocals crisp & clean-a keka mudiyum. 🎙️';
    suggestedAction = { type: 'SET_EQ_PRESET', preset: 'vocal' };
  } else if (['flat', 'reset eq', 'normal sound'].some((w) => msg.includes(w))) {
    replyText = 'Equalizer flat standard sound-ku reset panniyachu. 🎚️';
    suggestedAction = { type: 'SET_EQ_PRESET', preset: 'flat' };
  } else if (['pause', 'stop'].some((w) => msg.includes(w))) {
    replyText = 'Music pause panniten nanba.';
    suggestedAction = { type: 'PAUSE' };
  } else if (['play', 'resume'].some((w) => msg.includes(w))) {
    replyText = 'Playback start panniten! Enjoy the beat!';
    suggestedAction = { type: 'PLAY' };
  } else if (['next', 'skip'].some((w) => msg.includes(w))) {
    replyText = 'Next track-ku skip panniten!';
    suggestedAction = { type: 'NEXT_TRACK' };
  } else if (['meaning', 'lyrics', 'explain song', 'kadha', 'story'].some((w) => msg.includes(w))) {
    const title = currentSong?.title || 'Current song';
    replyText = `'${title}' lyrics breakdown & background story Now Playing -> 'AI Insights' tab-la ready-a irukku nanba! 📜✨`;
    suggestedAction = { type: 'OPEN_AI_INSIGHTS' };
  } else if (['dj', 'vibe', 'mood', 'recommend'].some((w) => msg.includes(w))) {
    replyText = "AI DJ Studio-ku ponga nanba! Anga 'Gym', 'Late night drive', 'Romantic', 'Coding', 'Devotional' nu type panna instant custom playlist kedaikum! 🎧";
    suggestedAction = { type: 'NAVIGATE_TAB', tab: 'ai-studio' };
  } else {
    const title = currentSong?.title;
    if (title) {
      replyText = `Vanakkam nanba! Ipo '${title}' play aaguthu. EQ tune panna, Karaoke toggle panna, alladhu puthu vibe playlist thevaipattal enkitta sollunga, instant-a panni tharen! 🚀`;
    } else {
      replyText = 'Vanakkam nanba! Naan unga Aura AI Music Assistant. Unakku enna paatu venum, enna vibe venum, alladhu bass boost pannanuma? Sollunga nanba! 🎵🔥';
    }
  }

  return {
    reply: replyText,
    action: suggestedAction
  };
}
