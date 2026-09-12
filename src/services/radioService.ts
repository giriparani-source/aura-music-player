import { Song } from '../types/music';

export interface RadioStation {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  genre: string;
  streamUrl: string;
  logo: string;
  artwork?: string;
  gradient: string;
  accentColor?: string;
  frequency?: string;
  bitrate: number;
}

export const LIVE_RADIO_STATIONS: RadioStation[] = [
  {
    id: 'jei_fm_tamil_320k',
    name: 'Jei FM Tamil 320k HD',
    tagline: 'Non-stop Kollywood 320kbps HD Hits',
    description: 'Non-stop Kollywood 320kbps HD Hits',
    genre: 'Tamil HD Cinema',
    streamUrl: 'https://usa3.fastcast4u.com/proxy/jeifm?mp=/1',
    logo: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
    gradient: 'from-amber-600/40 via-orange-600/30 to-red-950/40',
    accentColor: 'from-amber-600/40 via-orange-600/30 to-red-950/40',
    frequency: '320k HD Live',
    bitrate: 320
  },
  {
    id: 'tamil_panpalai_gold',
    name: 'Tamil Panpalai Gold',
    tagline: 'Evergreen Ilaiyaraaja & Rahman Classics',
    description: 'Evergreen Ilaiyaraaja & Rahman Classics',
    genre: 'Tamil Golden Hits',
    streamUrl: 'https://tamilpanpalai.radioca.st/ind',
    logo: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
    gradient: 'from-yellow-600/40 via-amber-600/30 to-rose-950/40',
    accentColor: 'from-yellow-600/40 via-amber-600/30 to-rose-950/40',
    frequency: 'Gold FM Live',
    bitrate: 128
  },
  {
    id: 'american_tamil_radio',
    name: 'American Tamil Radio',
    tagline: 'Global Tamil Hits & Live Shows',
    description: 'Global Tamil Hits & Live Shows',
    genre: 'Global Tamil FM',
    streamUrl: 'https://cp11.serverse.com/proxy/hgsmgluv?mp=/stream',
    logo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
    gradient: 'from-rose-600/40 via-orange-600/30 to-purple-950/40',
    accentColor: 'from-rose-600/40 via-orange-600/30 to-purple-950/40',
    frequency: 'Global FM',
    bitrate: 128
  },
  {
    id: 'bombay_beats_bollywood',
    name: '1.FM Bombay Beats HD',
    tagline: 'Latest Bollywood & Punjabi Hits',
    description: 'Latest Bollywood & Punjabi Hits',
    genre: 'Bollywood Hits',
    streamUrl: 'https://strm112.1.fm/bombaybeats_mobile_mp3',
    logo: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300',
    artwork: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300',
    gradient: 'from-fuchsia-600/40 via-pink-600/30 to-purple-950/40',
    accentColor: 'from-fuchsia-600/40 via-pink-600/30 to-purple-950/40',
    frequency: '256k HD Live',
    bitrate: 256
  },
  {
    id: 'radio_aashiqanaa_hindi',
    name: 'Radio Aashiqanaa',
    tagline: 'Romantic Bollywood Melodies 24/7',
    description: 'Romantic Bollywood Melodies 24/7',
    genre: 'Romantic Melodies',
    streamUrl: 'https://sonic.onlineaudience.co.uk/8114/stream',
    logo: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300',
    artwork: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300',
    gradient: 'from-rose-600/40 via-red-600/30 to-amber-950/40',
    accentColor: 'from-rose-600/40 via-red-600/30 to-amber-950/40',
    frequency: 'Romantic FM',
    bitrate: 208
  },
  {
    id: 'lofi_cafe_live',
    name: 'Lo-Fi Chillhop Cafe',
    tagline: '24/7 Study, Relax & Sleep Beats',
    description: '24/7 Study, Relax & Sleep Beats',
    genre: 'Lo-Fi & Instrumental',
    streamUrl: 'https://streams.ilovemusic.de/iloveradio17.mp3',
    logo: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300',
    artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300',
    gradient: 'from-emerald-600/40 via-teal-600/30 to-slate-950/40',
    accentColor: 'from-emerald-600/40 via-teal-600/30 to-slate-950/40',
    frequency: '24/7 Web Stream',
    bitrate: 192
  },
  {
    id: 'dance_wave_edm',
    name: 'Dance Wave Ibiza Club',
    tagline: 'Non-stop Club Anthems & Festival EDM',
    description: 'Non-stop Club Anthems & Festival EDM',
    genre: 'EDM & Dance',
    streamUrl: 'https://dancewave.online/dance.mp3',
    logo: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300',
    artwork: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300',
    gradient: 'from-purple-600/40 via-indigo-600/30 to-blue-950/40',
    accentColor: 'from-purple-600/40 via-indigo-600/30 to-blue-950/40',
    frequency: 'Ibiza Live',
    bitrate: 192
  },
  {
    id: 'bbc_world_live',
    name: 'BBC World Service Live',
    tagline: 'Global Stories, Podcasts & Live News',
    description: 'Global Stories, Podcasts & Live News',
    genre: 'News & Culture',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    logo: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300',
    artwork: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300',
    gradient: 'from-red-600/40 via-red-700/30 to-neutral-950/40',
    accentColor: 'from-red-600/40 via-red-700/30 to-neutral-950/40',
    frequency: 'BBC World',
    bitrate: 128
  },
  {
    id: 'groove_salad_ambient',
    name: 'Groove Salad Ambient Lounge',
    tagline: 'Deep Relaxation, Downtempo & Waves',
    description: 'Deep Relaxation, Downtempo & Waves',
    genre: 'Ambient Downtempo',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    logo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300',
    artwork: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300',
    gradient: 'from-cyan-600/40 via-blue-600/30 to-slate-950/40',
    accentColor: 'from-cyan-600/40 via-blue-600/30 to-slate-950/40',
    frequency: 'Ambient Lounge',
    bitrate: 128
  }
];

class RadioService {
  public getStations(): RadioStation[] {
    return LIVE_RADIO_STATIONS;
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
