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

export const INBUILT_PLAYLISTS: InbuiltPlaylist[] = [
  {
    id: 'kollywood_chillout',
    title: 'Kollywood Chillout Melodies',
    subtitle: 'Soulful Acoustics & Late Night Melodies',
    description: 'Relax and unwind with the most soulful, acoustic, and heartfelt Tamil melodies from Harris Jayaraj, A.R. Rahman, and Yuvan.',
    coverArt: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-blue-600/40 via-indigo-700/30 to-slate-950/80',
    accentColor: '#6366f1',
    songCount: 7,
    tracks: [
      PRESET_SAAVN_320K_HITS[5], // Vaseegara
      {
        id: 'saavn_venmathi',
        sourceId: 'venmathi_minnale',
        title: 'Venmathi Venmathiye',
        artist: 'Roop Kumar Rathod, Tipu • Minnale',
        album: 'Minnale',
        duration: 334,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 13360000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://c.saavncdn.com/712/Minnale-Tamil-2001-20200424163013-500x500.jpg',
        coverArt: 'https://c.saavncdn.com/712/Minnale-Tamil-2001-20200424163013-500x500.jpg',
        filePath: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        path: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        fileName: 'Venmathi_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_marakkuma',
        sourceId: 'marakkuma_nenjam',
        title: 'Marakkuma Nenjam',
        artist: 'A.R. Rahman • Vendhu Thanindhathu Kaadu',
        album: 'Vendhu Thanindhathu Kaadu',
        duration: 258,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 10320000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/284/1d00c3b03623910c59239853921161d9_320.mp4',
        path: 'https://aac.saavncdn.com/284/1d00c3b03623910c59239853921161d9_320.mp4',
        fileName: 'Marakkuma_Nenjam_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_new_york',
        sourceId: 'new_york_nagaram',
        title: 'New York Nagaram',
        artist: 'A.R. Rahman • Sillunu Oru Kaadhal',
        album: 'Sillunu Oru Kaadhal',
        duration: 377,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 15080000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        path: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        fileName: 'New_York_Nagaram_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_poongatrile',
        sourceId: 'poongatrile_dil_se',
        title: 'Poongatrile',
        artist: 'Unni Menon, Swarnalatha • Uyire (Dil Se)',
        album: 'Uyire',
        duration: 341,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 13640000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/768/b50ef4ad407a514d2371fa79e4369e8b_320.mp4',
        path: 'https://aac.saavncdn.com/768/b50ef4ad407a514d2371fa79e4369e8b_320.mp4',
        fileName: 'Poongatrile_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_enna_solla',
        sourceId: 'enna_solla_kandukondain',
        title: 'Enna Solla Pogirai',
        artist: 'Shankar Mahadevan • Kandukondain Kandukondain',
        album: 'Kandukondain Kandukondain',
        duration: 360,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 14400000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4',
        path: 'https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4',
        fileName: 'Enna_Solla_Pogirai_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_pachai_nirame',
        sourceId: 'pachai_nirame_alaipayuthey',
        title: 'Pachai Nirame',
        artist: 'Hariharan, Clinton Cerejo • Alaipayuthey',
        album: 'Alaipayuthey',
        duration: 358,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 14320000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        path: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        fileName: 'Pachai_Nirame_320k.m4a',
        isOnline: true,
        isSaavn: true
      }
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
    songCount: 6,
    tracks: [
      PRESET_SAAVN_320K_HITS[0], // Hukum
      PRESET_SAAVN_320K_HITS[1], // Arabic Kuthu
      PRESET_SAAVN_320K_HITS[2], // Naa Ready
      PRESET_SAAVN_320K_HITS[3], // Illuminati
      PRESET_SAAVN_320K_HITS[4], // Manasilaayo
      {
        id: 'saavn_jalabulanjangu',
        sourceId: 'jalabulanjangu_don',
        title: 'Jalabulanjangu',
        artist: 'Anirudh Ravichander • Don',
        album: 'Don',
        duration: 218,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8720000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://c.saavncdn.com/768/Beast-Tamil-2022-20220504143439-500x500.jpg',
        coverArt: 'https://c.saavncdn.com/768/Beast-Tamil-2022-20220504143439-500x500.jpg',
        filePath: 'https://aac.saavncdn.com/768/b50ef4ad407a514d2371fa79e4369e8b_320.mp4',
        path: 'https://aac.saavncdn.com/768/b50ef4ad407a514d2371fa79e4369e8b_320.mp4',
        fileName: 'Jalabulanjangu_320k.m4a',
        isOnline: true,
        isSaavn: true
      }
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
    songCount: 6,
    tracks: [
      {
        id: 'saavn_ilaya_nila',
        sourceId: 'ilaya_nila',
        title: 'Ilaya Nila Pozhigirathe',
        artist: 'S.P. Balasubrahmanyam, Ilaiyaraaja • Payanangal Mudivathillai',
        album: 'Payanangal Mudivathillai',
        duration: 284,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 11360000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        path: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        fileName: 'Ilaya_Nila_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_mandram_vantha',
        sourceId: 'mandram_vantha',
        title: 'Mandram Vantha Thendralukku',
        artist: 'S.P. Balasubrahmanyam, Ilaiyaraaja • Mouna Ragam',
        album: 'Mouna Ragam',
        duration: 312,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 12480000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4',
        path: 'https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4',
        fileName: 'Mandram_Vantha_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_raja_raja',
        sourceId: 'raja_raja_chozhan',
        title: 'Raja Raja Chozhan Naan',
        artist: 'K.J. Yesudas, Ilaiyaraaja • Rettai Vaal Kuruvi',
        album: 'Rettai Vaal Kuruvi',
        duration: 270,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 10800000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        path: 'https://aac.saavncdn.com/712/57704df3e025f1eb02b489ad080816b5_320.mp4',
        fileName: 'Raja_Raja_Chozhan_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_thendral_vanthu',
        sourceId: 'thendral_vanthu',
        title: 'Thendral Vanthu Theendumbothu',
        artist: 'Ilaiyaraaja, S. Janaki • Avatharam',
        album: 'Avatharam',
        duration: 321,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 12840000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/768/b50ef4ad407a514d2371fa79e4369e8b_320.mp4',
        path: 'https://aac.saavncdn.com/768/b50ef4ad407a514d2371fa79e4369e8b_320.mp4',
        fileName: 'Thendral_Vanthu_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_sundari_kannal',
        sourceId: 'sundari_kannal',
        title: 'Sundari Kannal Oru Sethi',
        artist: 'S.P. Balasubrahmanyam, S. Janaki • Thalapathi',
        album: 'Thalapathi',
        duration: 432,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 17280000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4',
        path: 'https://aac.saavncdn.com/435/4161a58e6cff0010c02431e6c21728d9_320.mp4',
        fileName: 'Sundari_Kannal_320k.m4a',
        isOnline: true,
        isSaavn: true
      },
      {
        id: 'saavn_chinna_chinna_aasai',
        sourceId: 'chinna_chinna_aasai',
        title: 'Chinna Chinna Aasai',
        artist: 'Minmini, A.R. Rahman • Roja',
        album: 'Roja',
        duration: 295,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 11800000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=500&auto=format&fit=crop&q=80',
        coverArt: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=500&auto=format&fit=crop&q=80',
        filePath: 'https://aac.saavncdn.com/284/1d00c3b03623910c59239853921161d9_320.mp4',
        path: 'https://aac.saavncdn.com/284/1d00c3b03623910c59239853921161d9_320.mp4',
        fileName: 'Chinna_Chinna_Aasai_320k.m4a',
        isOnline: true,
        isSaavn: true
      }
    ]
  },
  {
    id: 'midnight_synth_highway',
    title: 'Midnight Synth Highway & Chill',
    subtitle: 'Hypnotic Basslines for Nocturnal Drives',
    description: 'Empty highways, neon lights, and smooth rhythmic grooves that lock your brain into effortless focus.',
    coverArt: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-purple-600/40 via-indigo-700/30 to-neutral-950/80',
    accentColor: '#a855f7',
    songCount: 5,
    tracks: [
      PRESET_SAAVN_320K_HITS[5], // Vaseegara
      PRESET_SAAVN_320K_HITS[0], // Hukum
      PRESET_SAAVN_320K_HITS[3], // Illuminati
      PRESET_SAAVN_320K_HITS[1], // Arabic Kuthu
      PRESET_SAAVN_320K_HITS[4]  // Manasilaayo
    ]
  },
  {
    id: 'beast_mode_workout',
    title: 'Beast Mode Gym Motivation',
    subtitle: 'High BPM Adrenaline & Power Hits',
    description: 'Smash your PRs and ignite your workout with peak energy drops, heavy drum kicks, and motivating Tamil bangers.',
    coverArt: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-orange-600/40 via-red-700/30 to-neutral-950/80',
    accentColor: '#ea580c',
    songCount: 5,
    tracks: [
      PRESET_SAAVN_320K_HITS[0], // Hukum
      PRESET_SAAVN_320K_HITS[2], // Naa Ready
      PRESET_SAAVN_320K_HITS[3], // Illuminati
      PRESET_SAAVN_320K_HITS[1], // Arabic Kuthu
      PRESET_SAAVN_320K_HITS[4]  // Manasilaayo
    ]
  },
  {
    id: 'monsoon_acoustic_coffee',
    title: 'Monsoon Acoustic & Morning Coffee',
    subtitle: 'Warm Fingerstyle Guitars & Gentle Rain',
    description: 'Fresh rain breeze, hot coffee, and mellow acoustic melodies crafted for quiet mornings and deep peace.',
    coverArt: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-emerald-600/40 via-teal-700/30 to-neutral-950/80',
    accentColor: '#10b981',
    songCount: 5,
    tracks: [
      PRESET_SAAVN_320K_HITS[5], // Vaseegara
      PRESET_SAAVN_320K_HITS[1], // Arabic Kuthu
      PRESET_SAAVN_320K_HITS[4], // Manasilaayo
      PRESET_SAAVN_320K_HITS[3], // Illuminati
      PRESET_SAAVN_320K_HITS[0]  // Hukum
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

  // Resolves whether songs in playlist match any local offline library song
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
