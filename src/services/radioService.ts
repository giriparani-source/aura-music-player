import { Song } from '../types/music';

export type RadioCategory = 'all' | 'commercial' | 'legends' | 'global' | 'chill';

export interface RadioStation {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  genre: string;
  category: 'commercial' | 'legends' | 'global' | 'chill';
  streamUrl: string;
  backupUrls?: string[];
  logo: string;
  artwork?: string;
  gradient: string;
  accentColor?: string;
  frequency?: string;
  dialFrequency?: string;
  bitrate: number;
}

export const LIVE_RADIO_STATIONS: RadioStation[] = [
  // 1. Commercial & Mass Broadcasters
  {
    id: 'suryan_fm_935',
    name: 'Suryan FM 93.5',
    tagline: 'Ketta Mass Kollywood Hits & RJ Shows',
    description: 'Chennai, Kovai, Madurai & Trichy Sun Network Official Broadcast',
    genre: 'Tamil Commercial Hits',
    category: 'commercial',
    streamUrl: 'http://radios.crabdance.com:8002/2',
    backupUrls: [
      'http://radios.crabdance.com:8002/1',
      'http://radios.crabdance.com:8002/3'
    ],
    logo: '/radio-logos/suryan_fm.svg',
    artwork: '/radio-logos/suryan_fm.svg',
    gradient: 'from-red-600/40 via-orange-600/30 to-amber-950/40',
    accentColor: 'from-red-600/40 via-orange-600/30 to-amber-950/40',
    frequency: '93.5 FM',
    dialFrequency: '93.5 FM Live',
    bitrate: 128
  },
  {
    id: 'shakthi_fm_1041',
    name: 'Shakthi FM 104.1',
    tagline: 'Sri Lanka #1 Tamil Station',
    description: 'Island-wide youth power, mass anthems & live RJ interaction',
    genre: 'Sri Lanka Tamil Mass',
    category: 'commercial',
    streamUrl: 'https://mbc.thestreamtech.com:8086/stream',
    logo: '/radio-logos/shakthi_fm.svg',
    artwork: '/radio-logos/shakthi_fm.svg',
    gradient: 'from-blue-600/40 via-indigo-600/30 to-orange-950/40',
    accentColor: 'from-blue-600/40 via-indigo-600/30 to-orange-950/40',
    frequency: '104.1 FM',
    dialFrequency: '104.1 FM Live',
    bitrate: 128
  },
  {
    id: 'sooriyan_fm_1034',
    name: 'Sooriyan FM 103.4',
    tagline: 'Non-stop Tamil Hits 24/7',
    description: 'Sri Lanka premier cinema music & entertainment network',
    genre: 'Cinema & Pop Hits',
    category: 'commercial',
    streamUrl: 'https://radio.lotustechnologieslk.net:8006/;stream.mp3',
    backupUrls: ['https://radio.lotustechnologieslk.net:8006/'],
    logo: '/radio-logos/sooriyan_fm.svg',
    artwork: '/radio-logos/sooriyan_fm.svg',
    gradient: 'from-red-700/40 via-orange-700/30 to-yellow-950/40',
    accentColor: 'from-red-700/40 via-orange-700/30 to-yellow-950/40',
    frequency: '103.4 FM',
    dialFrequency: '103.4 FM Live',
    bitrate: 128
  },
  {
    id: 'jei_fm_tamil_320k',
    name: 'Jei FM Tamil 320k HD',
    tagline: 'Studio Master 320kbps HD Audio',
    description: 'Non-stop Kollywood mass beats, Anirudh & Yuvan blockbusters',
    genre: 'Tamil 320k HD',
    category: 'commercial',
    streamUrl: 'https://usa3.fastcast4u.com/proxy/jeifm?mp=/1',
    logo: '/radio-logos/jei_fm.svg',
    artwork: '/radio-logos/jei_fm.svg',
    gradient: 'from-amber-600/40 via-orange-600/30 to-red-950/40',
    accentColor: 'from-amber-600/40 via-orange-600/30 to-red-950/40',
    frequency: '320k HD Live',
    dialFrequency: '320k Studio Master',
    bitrate: 320
  },

  // 2. 24/7 Legends & Evergreen Classics
  {
    id: 'ilaiyaraaja_247_radio',
    name: 'Radio Maestro (Ilaiyaraaja 24/7)',
    tagline: 'The Maestro 24/7 Non-Stop Classics',
    description: 'Soulful melodies, orchestration & golden retro hits',
    genre: 'Ilaiyaraaja Classics',
    category: 'legends',
    streamUrl: 'https://s7.yesstreaming.net:8092/stream',
    logo: '/radio-logos/ilaiyaraaja_radio.svg',
    artwork: '/radio-logos/ilaiyaraaja_radio.svg',
    gradient: 'from-amber-700/40 via-yellow-700/30 to-stone-950/40',
    accentColor: 'from-amber-700/40 via-yellow-700/30 to-stone-950/40',
    frequency: 'Maestro 24/7',
    dialFrequency: 'Maestro Live',
    bitrate: 128
  },
  {
    id: 'ar_rahman_247_radio',
    name: 'ARR Radio (A.R. Rahman 24/7)',
    tagline: 'Mozart of Madras 24/7 Digital Radio',
    description: 'Symphonies, world music, synth melodies & Oscar anthems',
    genre: 'A.R. Rahman Hits',
    category: 'legends',
    streamUrl: 'https://s7.yesstreaming.net:8038/stream',
    logo: '/radio-logos/ar_rahman_radio.svg',
    artwork: '/radio-logos/ar_rahman_radio.svg',
    gradient: 'from-purple-600/40 via-fuchsia-600/30 to-indigo-950/40',
    accentColor: 'from-purple-600/40 via-fuchsia-600/30 to-indigo-950/40',
    frequency: 'ARR 24/7',
    dialFrequency: 'ARR Live HD',
    bitrate: 128
  },
  {
    id: 'tamil_panpalai_gold',
    name: 'Tamil Panpalai Gold',
    tagline: 'Evergreen 70s, 80s & 90s Melodies',
    description: 'Europe & Worldwide Tamil timeless nostalgia',
    genre: 'Tamil Golden Hits',
    category: 'legends',
    streamUrl: 'https://tamilpanpalai.radioca.st/ind',
    logo: '/radio-logos/tamil_panpalai.svg',
    artwork: '/radio-logos/tamil_panpalai.svg',
    gradient: 'from-yellow-600/40 via-amber-600/30 to-rose-950/40',
    accentColor: 'from-yellow-600/40 via-amber-600/30 to-rose-950/40',
    frequency: 'Gold FM Live',
    dialFrequency: 'Gold FM Live',
    bitrate: 128
  },

  // 3. Global Tamil Diaspora Broadcasters
  {
    id: 'lankasri_fm_live',
    name: 'Lankasri FM',
    tagline: 'Worldwide Tamil Diaspora Radio',
    description: 'News, cinema music & diaspora cultural programs',
    genre: 'Global Tamil FM',
    category: 'global',
    streamUrl: 'http://media2.lankasri.fm/;stream.mp3',
    logo: '/radio-logos/lankasri_fm.svg',
    artwork: '/radio-logos/lankasri_fm.svg',
    gradient: 'from-rose-600/40 via-red-600/30 to-neutral-950/40',
    accentColor: 'from-rose-600/40 via-red-600/30 to-neutral-950/40',
    frequency: 'Global Online',
    dialFrequency: 'Online Web Live',
    bitrate: 128
  },
  {
    id: 'star_fm_srilanka',
    name: 'Star FM Sri Lanka',
    tagline: 'Youth Music & Live Entertainment',
    description: 'Commercial youth Tamil FM station',
    genre: 'Pop & Youth Tamil',
    category: 'global',
    streamUrl: 'https://stream.starfm.lk:12025/stream',
    logo: '/radio-logos/star_fm.svg',
    artwork: '/radio-logos/star_fm.svg',
    gradient: 'from-blue-700/40 via-cyan-700/30 to-slate-950/40',
    accentColor: 'from-blue-700/40 via-cyan-700/30 to-slate-950/40',
    frequency: 'Star Live',
    dialFrequency: '102.8 FM Live',
    bitrate: 128
  },
  {
    id: 'american_tamil_radio',
    name: 'American Tamil Radio (ATR)',
    tagline: 'USA Global Tamil Hits & Shows',
    description: 'North America premier 24/7 Tamil broadcast',
    genre: 'Global Tamil FM',
    category: 'global',
    streamUrl: 'https://cp11.serverse.com/proxy/hgsmgluv?mp=/stream',
    logo: '/radio-logos/american_tamil.svg',
    artwork: '/radio-logos/american_tamil.svg',
    gradient: 'from-blue-600/40 via-red-600/30 to-slate-950/40',
    accentColor: 'from-blue-600/40 via-red-600/30 to-slate-950/40',
    frequency: 'USA FM',
    dialFrequency: 'USA Global',
    bitrate: 128
  },
  {
    id: 'vasantham_fm_live',
    name: 'Vasantham FM',
    tagline: 'Melodies & Soft Tamil Beats',
    description: 'Relaxing Tamil music & cultural broadcast',
    genre: 'Tamil Soft Melodies',
    category: 'global',
    streamUrl: 'https://cp12.serverse.com/proxy/vasanthamfm?mp=/stream',
    logo: '/radio-logos/vasantham_fm.svg',
    artwork: '/radio-logos/vasantham_fm.svg',
    gradient: 'from-emerald-600/40 via-teal-600/30 to-neutral-950/40',
    accentColor: 'from-emerald-600/40 via-teal-600/30 to-neutral-950/40',
    frequency: 'Melody Live',
    dialFrequency: 'Vasantham Live',
    bitrate: 128
  },

  // 4. Chill, Lo-Fi, Bollywood & EDM
  {
    id: 'bombay_beats_bollywood',
    name: '1.FM Bombay Beats HD',
    tagline: 'Latest Bollywood & Punjabi Hits',
    description: 'High-energy Hindi dance anthems & club remixes',
    genre: 'Bollywood Hits',
    category: 'chill',
    streamUrl: 'https://strm112.1.fm/bombaybeats_mobile_mp3',
    logo: '/radio-logos/bombay_beats.svg',
    artwork: '/radio-logos/bombay_beats.svg',
    gradient: 'from-fuchsia-600/40 via-pink-600/30 to-purple-950/40',
    accentColor: 'from-fuchsia-600/40 via-pink-600/30 to-purple-950/40',
    frequency: '256k HD Live',
    dialFrequency: '256k HD Live',
    bitrate: 256
  },
  {
    id: 'lofi_cafe_live',
    name: 'Lo-Fi Chillhop Cafe',
    tagline: '24/7 Study, Relax & Sleep Beats',
    description: 'Instrumental chillhop, vinyl crackles & relaxing lofi',
    genre: 'Lo-Fi & Instrumental',
    category: 'chill',
    streamUrl: 'https://streams.ilovemusic.de/iloveradio17.mp3',
    logo: '/radio-logos/lofi_cafe.svg',
    artwork: '/radio-logos/lofi_cafe.svg',
    gradient: 'from-teal-600/40 via-cyan-600/30 to-slate-950/40',
    accentColor: 'from-teal-600/40 via-cyan-600/30 to-slate-950/40',
    frequency: 'Lo-Fi 24/7',
    dialFrequency: 'Chillhop Stereo',
    bitrate: 192
  },
  {
    id: 'dance_wave_edm',
    name: 'Dance Wave Ibiza Club',
    tagline: 'Non-stop Club Anthems & Festival EDM',
    description: 'High-octane electronic, progressive house & trance',
    genre: 'EDM & Dance',
    category: 'chill',
    streamUrl: 'https://dancewave.online/dance.mp3',
    logo: '/radio-logos/dance_wave.svg',
    artwork: '/radio-logos/dance_wave.svg',
    gradient: 'from-purple-600/40 via-indigo-600/30 to-blue-950/40',
    accentColor: 'from-purple-600/40 via-indigo-600/30 to-blue-950/40',
    frequency: 'Ibiza Live',
    dialFrequency: 'Ibiza Club 192k',
    bitrate: 192
  },
  {
    id: 'bbc_world_live',
    name: 'BBC World Service Live',
    tagline: 'Global Stories, Podcasts & Live News',
    description: 'International journalism, interviews & world reports',
    genre: 'News & Culture',
    category: 'chill',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    logo: '/radio-logos/bbc_world.svg',
    artwork: '/radio-logos/bbc_world.svg',
    gradient: 'from-red-600/40 via-red-700/30 to-neutral-950/40',
    accentColor: 'from-red-600/40 via-red-700/30 to-neutral-950/40',
    frequency: 'BBC World',
    dialFrequency: 'BBC World 24/7',
    bitrate: 128
  },
  {
    id: 'groove_salad_ambient',
    name: 'Groove Salad Ambient Lounge',
    tagline: 'Deep Relaxation, Downtempo & Waves',
    description: 'SomaFM award-winning ambient electronic soundscapes',
    genre: 'Ambient Downtempo',
    category: 'chill',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    logo: '/radio-logos/groove_salad.svg',
    artwork: '/radio-logos/groove_salad.svg',
    gradient: 'from-cyan-600/40 via-blue-600/30 to-slate-950/40',
    accentColor: 'from-cyan-600/40 via-blue-600/30 to-slate-950/40',
    frequency: 'Ambient Lounge',
    dialFrequency: 'SomaFM 128k',
    bitrate: 128
  }
];

class RadioService {
  public getStations(): RadioStation[] {
    return LIVE_RADIO_STATIONS;
  }

  public getStationById(id: string): RadioStation | undefined {
    return LIVE_RADIO_STATIONS.find((s) => s.id === id);
  }

  public getStationByUrl(url: string): RadioStation | undefined {
    return LIVE_RADIO_STATIONS.find((s) => s.streamUrl === url || s.backupUrls?.includes(url));
  }

  public getStationAsSong(station: RadioStation): Song {
    return {
      id: `live_${station.id}`,
      title: station.name,
      artist: station.tagline,
      album: '24/7 Live Radio FM',
      duration: 0,
      format: 'LIVE FM',
      bitrate: station.bitrate,
      fileSize: 0,
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      artwork: station.logo,
      coverArt: station.logo,
      filePath: station.streamUrl,
      path: station.streamUrl,
      fileName: `${station.name}.mp3`,
      isOnline: true,
      isLiveRadio: true
    };
  }

  public getAllStationsAsSongs(): Song[] {
    return LIVE_RADIO_STATIONS.map((s) => this.getStationAsSong(s));
  }
}

export const radioService = new RadioService();
export const getStationAsSong = (station: RadioStation): Song => radioService.getStationAsSong(station);
