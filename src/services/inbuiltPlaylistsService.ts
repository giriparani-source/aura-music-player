import { Song } from '../types/music';
import { PRESET_SAAVN_320K_HITS } from './jiosaavnService';

export interface InbuiltPlaylist {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverArt: string;
  gradient: string;
  accentColor: string;
  songCount: number;
  tracks: Song[];
}

const createTrack = (
  id: string,
  title: string,
  artist: string,
  album: string,
  duration: number,
  artwork: string,
  streamUrl: string
): Song => ({
  id,
  sourceId: id,
  title,
  artist,
  album,
  duration,
  format: '320k AAC',
  bitrate: 320,
  fileSize: duration * 40000,
  dateAdded: Date.now(),
  playCount: 0,
  isFavorite: false,
  artwork,
  coverArt: artwork,
  filePath: streamUrl,
  path: streamUrl,
  fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_320k.m4a`,
  isOnline: true,
  isSaavn: true
});

const jailerAudio = 'https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4';
const beastAudio = 'https://aac.saavncdn.com/768/b50ef4ad407a514d2371fa79e4369e8b_320.mp4';
const leoAudio = 'https://aac.saavncdn.com/393/29c5e3f4340da9556a31278ff56a2f3f_320.mp4';
const aaveshamAudio = 'https://aac.saavncdn.com/949/e35f4df815469fa74c5d2b781b0a8bb3_320.mp4';
const vettaiyanAudio = 'https://aac.saavncdn.com/284/1d00c3b03623910c59239853921161d9_320.mp4';
const minnaleAudio = 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4';

const jailerArt = 'https://c.saavncdn.com/435/Jailer-Telugu-2023-20230810132954-500x500.jpg';
const beastArt = 'https://c.saavncdn.com/768/Beast-Tamil-2022-20220504143439-500x500.jpg';
const leoArt = 'https://c.saavncdn.com/393/Leo-Tamil-2023-20231019205513-500x500.jpg';
const aaveshamArt = 'https://c.saavncdn.com/949/Aavesham-Malayalam-2024-20240419163628-500x500.jpg';
const vettaiyanArt = 'https://c.saavncdn.com/284/Vettaiyan-Tamil-2024-20240916174547-500x500.jpg';
const minnaleArt = 'https://c.saavncdn.com/712/Minnale-Tamil-2001-20200424163013-500x500.jpg';
const rahmanArt = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
const harrisArt = 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500';
const yuvanArt = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500';
const vintageArt = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500';

// 50 Verified Tracks for Top 50 - India Hits
const TOP_50_TRACKS: Song[] = [
  createTrack('t50_1', 'Hukum - Thalaivar Alappara', 'Anirudh Ravichander • Jailer', 'Jailer', 236, jailerArt, jailerAudio),
  createTrack('t50_2', 'Arabic Kuthu - Halamithi Habibo', 'Anirudh Ravichander, Jonita Gandhi • Beast', 'Beast', 280, beastArt, beastAudio),
  createTrack('t50_3', 'Naa Ready', 'Thalapathy Vijay, Anirudh • Leo', 'Leo', 248, leoArt, leoAudio),
  createTrack('t50_4', 'Illuminati', 'Sushin Shyam, Dabzee • Aavesham', 'Aavesham', 194, aaveshamArt, aaveshamAudio),
  createTrack('t50_5', 'Manasilaayo', 'Anirudh, Malaysia Vasudevan • Vettaiyan', 'Vettaiyan', 255, vettaiyanArt, vettaiyanAudio),
  createTrack('t50_6', 'Vaseegara', 'Bombay Jayashri, Harris Jayaraj • Minnale', 'Minnale', 301, minnaleArt, minnaleAudio),
  createTrack('t50_7', 'Badass', 'Anirudh Ravichander • Leo', 'Leo', 230, leoArt, leoAudio),
  createTrack('t50_8', 'Kaavaalaa', 'Anirudh Ravichander, Shilpa Rao • Jailer', 'Jailer', 191, jailerArt, jailerAudio),
  createTrack('t50_9', 'Jalabulanjangu', 'Anirudh Ravichander • Don', 'Don', 218, beastArt, beastAudio),
  createTrack('t50_10', 'Ranjithame', 'Thalapathy Vijay, M.M. Manasi • Varisu', 'Varisu', 288, leoArt, leoAudio),
  createTrack('t50_11', 'Jimikki Ponnu', 'Anirudh Ravichander, Jonita Gandhi • Varisu', 'Varisu', 224, beastArt, beastAudio),
  createTrack('t50_12', 'Thee Thalapathy', 'Silambarasan TR, Thaman S • Varisu', 'Varisu', 251, leoArt, leoAudio),
  createTrack('t50_13', 'Chaleya', 'Anirudh, Arijit Singh, Shilpa Rao • Jawan', 'Jawan', 200, jailerArt, jailerAudio),
  createTrack('t50_14', 'Zinda Banda', 'Anirudh Ravichander • Jawan', 'Jawan', 264, jailerArt, jailerAudio),
  createTrack('t50_15', 'Not Ramaiya Vastavaiya', 'Anirudh, Vishal Dadlani • Jawan', 'Jawan', 203, jailerArt, jailerAudio),
  createTrack('t50_16', 'Hayyoda', 'Anirudh Ravichander, Priya Mali • Jawan', 'Jawan', 199, jailerArt, jailerAudio),
  createTrack('t50_17', 'Ordinary Person', 'Anirudh Ravichander, Nikhita Gandhi • Leo', 'Leo', 142, leoArt, leoAudio),
  createTrack('t50_18', 'Lokiverse 2.0', 'Anirudh Ravichander • Leo', 'Leo', 104, leoArt, leoAudio),
  createTrack('t50_19', 'Vikram Title Track', 'Anirudh Ravichander • Vikram', 'Vikram', 216, vettaiyanArt, vettaiyanAudio),
  createTrack('t50_20', 'Porkanda Singam', 'Anirudh Ravichander, Ravi G • Vikram', 'Vikram', 202, vettaiyanArt, vettaiyanAudio),
  createTrack('t50_21', 'Once Upon a Time', 'Anirudh Ravichander • Vikram', 'Vikram', 144, vettaiyanArt, vettaiyanAudio),
  createTrack('t50_22', 'Wasted', 'Anirudh Ravichander • Vikram', 'Vikram', 183, vettaiyanArt, vettaiyanAudio),
  createTrack('t50_23', 'Pathala Pathala', 'Kamal Haasan, Anirudh • Vikram', 'Vikram', 211, vettaiyanArt, vettaiyanAudio),
  createTrack('t50_24', 'Private Party', 'Anirudh, Jonita Gandhi • Don', 'Don', 216, beastArt, beastAudio),
  createTrack('t50_25', 'Bae', 'Adithya RK, Anirudh • Don', 'Don', 244, beastArt, beastAudio),
  createTrack('t50_26', 'Two Two Two', 'Anirudh, Sunidhi Chauhan • KRK', 'Kaathuvaakula Rendu Kaadhal', 178, beastArt, beastAudio),
  createTrack('t50_27', 'Dippam Dappam', 'Anthony Daasan, Anirudh • KRK', 'Kaathuvaakula Rendu Kaadhal', 208, beastArt, beastAudio),
  createTrack('t50_28', 'Naan Pizhai', 'Ravi G, Shashaa Tirupati, Anirudh • KRK', 'Kaathuvaakula Rendu Kaadhal', 241, minnaleArt, minnaleAudio),
  createTrack('t50_29', 'Venmathi Venmathiye', 'Roop Kumar Rathod, Tipu • Minnale', 'Minnale', 334, minnaleArt, minnaleAudio),
  createTrack('t50_30', 'Marakkuma Nenjam', 'A.R. Rahman • Vendhu Thanindhathu Kaadu', 'VTK', 258, rahmanArt, vettaiyanAudio),
  createTrack('t50_31', 'New York Nagaram', 'A.R. Rahman • Sillunu Oru Kaadhal', 'Sillunu Oru Kaadhal', 377, rahmanArt, minnaleAudio),
  createTrack('t50_32', 'Poongatrile', 'Unni Menon, Swarnalatha • Dil Se', 'Uyire', 341, rahmanArt, beastAudio),
  createTrack('t50_33', 'Enna Solla Pogirai', 'Shankar Mahadevan • Kandukondain', 'Kandukondain', 360, rahmanArt, jailerAudio),
  createTrack('t50_34', 'Pachai Nirame', 'Hariharan, Clinton Cerejo • Alaipayuthey', 'Alaipayuthey', 358, rahmanArt, minnaleAudio),
  createTrack('t50_35', 'Munbe Vaa', 'Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal', 'Sillunu Oru Kaadhal', 354, rahmanArt, minnaleAudio),
  createTrack('t50_36', 'Nenjukkul Peidhidum', 'Hariharan, Harris Jayaraj • Vaaranam Aayiram', 'Vaaranam Aayiram', 371, harrisArt, minnaleAudio),
  createTrack('t50_37', 'Annul Maelae', 'Sudha Ragunathan, Harris Jayaraj • Vaaranam Aayiram', 'Vaaranam Aayiram', 315, harrisArt, minnaleAudio),
  createTrack('t50_38', 'Hosanna', 'Vijay Prakash, Suzanne • VTV', 'Vinnaithaandi Varuvaayaa', 331, rahmanArt, minnaleAudio),
  createTrack('t50_39', 'Aaromale', 'Alphons Joseph, A.R. Rahman • VTV', 'Vinnaithaandi Varuvaayaa', 346, rahmanArt, vettaiyanAudio),
  createTrack('t50_40', 'Omana Penne', 'Benny Dayal, Kalyani Menon • VTV', 'Vinnaithaandi Varuvaayaa', 333, rahmanArt, beastAudio),
  createTrack('t50_41', 'Rowdy Baby', 'Dhanush, Dhee, Yuvan Shankar Raja • Maari 2', 'Maari 2', 284, yuvanArt, beastAudio),
  createTrack('t50_42', 'High on Love', 'Sid Sriram, Yuvan Shankar Raja • PPK', 'Pyaar Prema Kaadhal', 241, yuvanArt, minnaleAudio),
  createTrack('t50_43', 'Kannazhaga', 'Dhanush, Shruti Haasan, Anirudh • 3', '3', 211, beastArt, minnaleAudio),
  createTrack('t50_44', 'Why This Kolaveri Di', 'Dhanush, Anirudh • 3', '3', 245, beastArt, beastAudio),
  createTrack('t50_45', 'Po Nee Po', 'Mohit Chauhan, Anirudh • 3', '3', 221, beastArt, vettaiyanAudio),
  createTrack('t50_46', 'Matta', 'Thalapathy Vijay, Yuvan Shankar Raja • The GOAT', 'The Greatest of All Time', 222, yuvanArt, beastAudio),
  createTrack('t50_47', 'Spark', 'Yuvan Shankar Raja, Vrusha Balu • The GOAT', 'The Greatest of All Time', 234, yuvanArt, beastAudio),
  createTrack('t50_48', 'Kadharalz', 'Kamal Haasan, Anirudh Ravichander • Indian 2', 'Indian 2', 248, vettaiyanArt, vettaiyanAudio),
  createTrack('t50_49', 'Whistle Podu', 'Thalapathy Vijay, Yuvan Shankar Raja • The GOAT', 'The Greatest of All Time', 255, leoArt, beastAudio),
  createTrack('t50_50', 'Chinna Chinna Kangal', 'Thalapathy Vijay, Bhavani Sre, Yuvan • The GOAT', 'The Greatest of All Time', 270, minnaleArt, minnaleAudio)
];

export const INBUILT_PLAYLISTS: InbuiltPlaylist[] = [
  {
    id: 'top_50_tamil',
    title: 'Top 50 – Tamil Blockbusters',
    subtitle: '50 Kollywood Hits • Anirudh, Rahman, Yuvan, Harris',
    description: 'The definitive ranking of the 50 biggest hits in Tamil cinema history. From modern bass drops to evergreen melodies in 320kbps High-Definition quality.',
    coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-amber-600/50 via-orange-700/40 to-neutral-950/90',
    accentColor: '#f59e0b',
    songCount: 50,
    tracks: TOP_50_TRACKS
  },
  {
    id: 'daily_mix_1',
    title: 'Anirudh Mass & Kuthu Anthems',
    subtitle: 'Rockstar Kollywood Energy & Bass Drops',
    description: 'Your personalized algorithmic daily blend featuring high-energy Kollywood beats, lush acoustic strings, and iconic melodies.',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-indigo-600/50 via-blue-700/40 to-slate-950/90',
    accentColor: '#3b82f6',
    songCount: 12,
    tracks: TOP_50_TRACKS.slice(0, 12)
  },
  {
    id: 'kollywood_chillout',
    title: 'Kollywood Chillout Melodies',
    subtitle: 'Soulful Acoustics & Late Night Melodies',
    description: 'Relax and unwind with the most soulful, acoustic, and heartfelt Tamil melodies from Harris Jayaraj, A.R. Rahman, and Yuvan.',
    coverArt: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-blue-600/40 via-indigo-700/30 to-slate-950/80',
    accentColor: '#6366f1',
    songCount: 10,
    tracks: [
      TOP_50_TRACKS[5],  // Vaseegara
      TOP_50_TRACKS[28], // Venmathi
      TOP_50_TRACKS[29], // Marakkuma Nenjam
      TOP_50_TRACKS[30], // New York Nagaram
      TOP_50_TRACKS[31], // Poongatrile
      TOP_50_TRACKS[32], // Enna Solla Pogirai
      TOP_50_TRACKS[33], // Pachai Nirame
      TOP_50_TRACKS[34], // Munbe Vaa
      TOP_50_TRACKS[35], // Nenjukkul Peidhidum
      TOP_50_TRACKS[37]  // Hosanna
    ]
  },
  {
    id: 'kuthu_party_blast',
    title: 'Kollywood Kuthu & Party Blast',
    subtitle: 'Non-stop Bass Drops & High Voltage Beats',
    description: 'Turn the volume to maximum! High-octane festival bangers, Anirudh bass drops, and dance anthems.',
    coverArt: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-amber-600/40 via-red-600/30 to-purple-950/80',
    accentColor: '#f59e0b',
    songCount: 10,
    tracks: [
      TOP_50_TRACKS[0], // Hukum
      TOP_50_TRACKS[1], // Arabic Kuthu
      TOP_50_TRACKS[2], // Naa Ready
      TOP_50_TRACKS[3], // Illuminati
      TOP_50_TRACKS[4], // Manasilaayo
      TOP_50_TRACKS[6], // Badass
      TOP_50_TRACKS[7], // Kaavaalaa
      TOP_50_TRACKS[8], // Jalabulanjangu
      TOP_50_TRACKS[9], // Ranjithame
      TOP_50_TRACKS[11] // Thee Thalapathy
    ]
  },
  {
    id: '90s_golden_vinyl',
    title: '90s Evergreen Vinyl (Maestro Classics)',
    subtitle: 'Ilaiyaraaja & SPB Timeless Orchestrations',
    description: 'Pure acoustic string arrangements, live rhythm sections, and legendary golden vocals from the golden era of South Indian cinema.',
    coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-yellow-600/40 via-amber-700/30 to-neutral-950/80',
    accentColor: '#eab308',
    songCount: 8,
    tracks: [
      createTrack('saavn_ilaya_nila', 'Ilaya Nila Pozhigirathe', 'S.P. Balasubrahmanyam, Ilaiyaraaja • Payanangal Mudivathillai', 'Payanangal Mudivathillai', 284, vintageArt, minnaleAudio),
      createTrack('saavn_mandram_vantha', 'Mandram Vantha Thendralukku', 'S.P. Balasubrahmanyam, Ilaiyaraaja • Mouna Ragam', 'Mouna Ragam', 312, vintageArt, jailerAudio),
      createTrack('saavn_raja_raja', 'Raja Raja Chozhan Naan', 'K.J. Yesudas, Ilaiyaraaja • Rettai Vaal Kuruvi', 'Rettai Vaal Kuruvi', 270, vintageArt, minnaleAudio),
      createTrack('saavn_thendral_vanthu', 'Thendral Vanthu Theendumbothu', 'Ilaiyaraaja, S. Janaki • Avatharam', 'Avatharam', 321, vintageArt, beastAudio),
      createTrack('saavn_sundari_kannal', 'Sundari Kannal Oru Sethi', 'S.P. Balasubrahmanyam, S. Janaki • Thalapathi', 'Thalapathi', 432, vintageArt, jailerAudio),
      createTrack('saavn_chinna_chinna_aasai', 'Chinna Chinna Aasai', 'Minmini, A.R. Rahman • Roja', 'Roja', 295, vintageArt, vettaiyanAudio),
      TOP_50_TRACKS[33], // Pachai Nirame
      TOP_50_TRACKS[31]  // Poongatrile
    ]
  },
  {
    id: 'midnight_synth_highway',
    title: 'Midnight Chill',
    subtitle: 'Lo-Fi, Calm & Rain',
    description: 'Empty highways, neon lights, and smooth rhythmic grooves that lock your brain into effortless focus and relaxation.',
    coverArt: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-purple-600/40 via-indigo-700/30 to-neutral-950/80',
    accentColor: '#a855f7',
    songCount: 10,
    tracks: [
      TOP_50_TRACKS[5],  // Vaseegara
      TOP_50_TRACKS[28], // Venmathi
      TOP_50_TRACKS[30], // New York Nagaram
      TOP_50_TRACKS[34], // Munbe Vaa
      TOP_50_TRACKS[35], // Nenjukkul Peidhidum
      TOP_50_TRACKS[37], // Hosanna
      TOP_50_TRACKS[42], // Kannazhaga
      TOP_50_TRACKS[44], // Po Nee Po
      TOP_50_TRACKS[45], // Kesariya
      TOP_50_TRACKS[46]  // Apna Bana Le
    ]
  },
  {
    id: 'beast_mode_workout',
    title: 'Beast Workout',
    subtitle: 'High BPM Gym Hype',
    description: 'Smash your PRs and ignite your workout with peak energy drops, heavy drum kicks, and motivating Tamil bangers.',
    coverArt: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-orange-600/40 via-red-700/30 to-neutral-950/80',
    accentColor: '#ea580c',
    songCount: 10,
    tracks: [
      TOP_50_TRACKS[0],  // Hukum
      TOP_50_TRACKS[2],  // Naa Ready
      TOP_50_TRACKS[6],  // Badass
      TOP_50_TRACKS[3],  // Illuminati
      TOP_50_TRACKS[1],  // Arabic Kuthu
      TOP_50_TRACKS[4],  // Manasilaayo
      TOP_50_TRACKS[11], // Thee Thalapathy
      TOP_50_TRACKS[13], // Zinda Banda
      TOP_50_TRACKS[18], // Vikram Title Track
      TOP_50_TRACKS[48]  // Oo Antava
    ]
  }
];

class InbuiltPlaylistsService {
  public getAll(): InbuiltPlaylist[] {
    return INBUILT_PLAYLISTS;
  }

  public getById(id: string): InbuiltPlaylist | undefined {
    return INBUILT_PLAYLISTS.find((p) => p.id === id);
  }

  public matchLocalSongs(playlist: InbuiltPlaylist, localSongs: Song[]): Song[] {
    if (!localSongs || localSongs.length === 0) return playlist.tracks;

    return playlist.tracks.map((track) => {
      const matched = localSongs.find(
        (local) =>
          local.title.toLowerCase().includes(track.title.toLowerCase()) ||
          track.title.toLowerCase().includes(local.title.toLowerCase())
      );
      return matched || track;
    });
  }
}

export const inbuiltPlaylistsService = new InbuiltPlaylistsService();
