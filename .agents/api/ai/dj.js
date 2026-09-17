const MOOD_PRESETS = {
  "late night drive": {
    title: "Midnight City Cruise 🌙",
    intro: "Vera level chill mix nanba! Midnight drive-ku smooth bass and atmospheric synth melodies pick panniruken. Enjoy the vibe!",
    vibe: "Smooth • Atmospheric • Melodic",
    suggested_eq: "Late Night Warmth",
    tracks: [
      { title: "Vaseegara", artist: "Bombay Jayashri • Minnale" },
      { title: "Venmathi Venmathiye", artist: "Roop Kumar Rathod, Tipu • Minnale" },
      { title: "Porkanda Singam", artist: "Anirudh Ravichander • Vikram" },
      { title: "Starboy", artist: "The Weeknd, Daft Punk" },
      { title: "Nenjame", artist: "Anirudh Ravichander • Doctor" },
      { title: "Enna Sona", artist: "A.R. Rahman, Arijit Singh • OK Jaanu" },
      { title: "Blinding Lights", artist: "The Weeknd" },
      { title: "Munbe Vaa", artist: "Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal" }
    ]
  },
  "gym": {
    title: "Gym Beast Mode 💥🔥",
    intro: "Adra sakkai! Heavy bass drops and max adrenaline tracks ready! Workout-la PR break panna idho unga high-energy booster mix!",
    vibe: "High Energy • Punchy Bass • Aggressive",
    suggested_eq: "Bass Monster",
    tracks: [
      { title: "Badass", artist: "Anirudh Ravichander • Leo" },
      { title: "Hukum - Thalaivar Alappara", artist: "Anirudh Ravichander • Jailer" },
      { title: "Naa Ready", artist: "Thalapathy Vijay, Anirudh • Leo" },
      { title: "Vikram Title Track", artist: "Anirudh Ravichander • Vikram" },
      { title: "Arabic Kuthu", artist: "Anirudh Ravichander • Beast" },
      { title: "Illuminati", artist: "Sushin Shyam • Aavesham" },
      { title: "Believer", artist: "Imagine Dragons" }
    ]
  },
  "party": {
    title: "Full Kuthu Party Blast 🥳🎉",
    intro: "Speaker blast aagura maadhiri instant celebration mode on! Dance floor-ah kalaka porom, volume-ah yethunga!",
    vibe: "Festival Beats • Fast Tempo • Dance",
    suggested_eq: "Club EDM",
    tracks: [
      { title: "Arabic Kuthu", artist: "Anirudh Ravichander • Beast" },
      { title: "Kaavaalaa", artist: "Anirudh Ravichander, Shilpa Rao • Jailer" },
      { title: "Illuminati", artist: "Sushin Shyam • Aavesham" },
      { title: "Manasilaayo", artist: "Anirudh Ravichander • Vettaiyan" },
      { title: "Vaathi Coming", artist: "Anirudh Ravichander • Master" },
      { title: "Jalabulanjangu", artist: "Anirudh Ravichander • Don" },
      { title: "Rowdy Baby", artist: "Dhanush, Dhee • Maari 2" }
    ]
  },
  "rainy": {
    title: "Rainy Day Nostalgia Melodies 🌧️☕",
    intro: "Kadalai/Coffee kooda mazhai peiyumpothu kekka vendiya soothing soul melodies. Mind-ah peace aakidum nanba.",
    vibe: "Acoustic • Melodic • Nostalgic",
    suggested_eq: "Acoustic Clarity",
    tracks: [
      { title: "Mazhai Kuruvi", artist: "A.R. Rahman • Chekka Chivantha Vaanam" },
      { title: "Vaseegara", artist: "Bombay Jayashri • Minnale" },
      { title: "Pookkal Pookkum", artist: "Roop Kumar Rathod, Harini • Madrasapattinam" },
      { title: "Unakkul Naane", artist: "Pradeep Kumar • Pachaikili Muthucharam" },
      { title: "New York Nagaram", artist: "A.R. Rahman • Sillunu Oru Kaadhal" },
      { title: "Kannazhaga", artist: "Anirudh Ravichander, Shruti Haasan • 3" }
    ]
  },
  "breakup": {
    title: "Soulful Heartbreak & Healing 💔🌧️",
    intro: "Vali kooda oru azhagu dhaan nanba. Heart-la irukura baaram kuraiya indha deep emotional melodies help pannum.",
    vibe: "Deep Soul • Slow Tempo • Melancholic",
    suggested_eq: "Vocal Brilliance",
    tracks: [
      { title: "Porkanda Singam", artist: "Anirudh Ravichander • Vikram" },
      { title: "Nenjame", artist: "Anirudh Ravichander • Doctor" },
      { title: "Po Nee Po", artist: "Mohit Chauhan, Anirudh • 3" },
      { title: "Kanave Kanave", artist: "Anirudh Ravichander • David" },
      { title: "En Iniya Pon Nilave", artist: "K.J. Yesudas • Moodu Pani" }
    ]
  },
  "romantic": {
    title: "Pure Romance & Melody Magic 💖🌹",
    intro: "Kaadhal melodies mattume nanba! Heart-ah melt panna soulful romantic tracks pick panniruken. Enjoy with that special someone!",
    vibe: "Tender • Soulful • Romantic",
    suggested_eq: "Vocal Brilliance",
    tracks: [
      { title: "Vaseegara", artist: "Bombay Jayashri • Minnale" },
      { title: "Munbe Vaa", artist: "Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal" },
      { title: "Enna Sona", artist: "A.R. Rahman, Arijit Singh • OK Jaanu" },
      { title: "Maruvarthai", artist: "Sid Sriram • Enai Noki Paayum Thota" },
      { title: "Thalli Pogathey", artist: "Sid Sriram • Achcham Yenbadhu Madamaiyada" }
    ]
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const q = (req.query.q || 'late night drive').toLowerCase().trim();

  let matched = MOOD_PRESETS["late night drive"];

  if (q.includes('gym') || q.includes('workout') || q.includes('beast') || q.includes('power')) {
    matched = MOOD_PRESETS["gym"];
  } else if (q.includes('party') || q.includes('kuthu') || q.includes('dance') || q.includes('energy')) {
    matched = MOOD_PRESETS["party"];
  } else if (q.includes('rain') || q.includes('mazhai') || q.includes('monsoon') || q.includes('coffee')) {
    matched = MOOD_PRESETS["rainy"];
  } else if (q.includes('sad') || q.includes('breakup') || q.includes('heart') || q.includes('heal')) {
    matched = MOOD_PRESETS["breakup"];
  } else if (q.includes('love') || q.includes('romance') || q.includes('kadhal')) {
    matched = MOOD_PRESETS["romantic"];
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json(matched);
}
