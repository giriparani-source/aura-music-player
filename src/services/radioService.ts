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
    id: 'radio_city_tamil',
    name: 'Radio City Tamil 24/7',
    tagline: 'Non-stop Kollywood Super Hits',
    description: 'Non-stop Kollywood Super Hits',
    genre: 'Tamil Cinema Hits',
    streamUrl: 'https://prclive4.listenon.in/Tamil',
    logo: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
    gradient: 'from-amber-600/40 via-orange-600/30 to-red-950/40',
    accentColor: 'from-amber-600/40 via-orange-600/30 to-red-950/40',
    frequency: 'Web Live FM',
    bitrate: 128
  },
  {
    id: 'radio_mirchi_hindi',
    name: 'Radio Mirchi Bollywood',
    tagline: 'Latest Bollywood & Chartbusters',
    description: 'Latest Bollywood & Chartbusters',
    genre: 'Hindi Commercial',
    streamUrl: 'https://prclive4.listenon.in/Hindi',
    logo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
    gradient: 'from-rose-600/40 via-pink-600/30 to-purple-950/40',
    accentColor: 'from-rose-600/40 via-pink-600/30 to-purple-950/40',
    frequency: 'Web Live FM',
    bitrate: 128
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
    id: 'chillout_lounge_ambient',
    name: 'Chillout Lounge Ambient',
    tagline: 'Deep Relaxation, Downtempo & Waves',
    description: 'Deep Relaxation, Downtempo & Waves',
    genre: 'Ambient Downtempo',
    streamUrl: 'https://cast1.torontocast.com:2170/stream',
    logo: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
    gradient: 'from-cyan-600/40 via-blue-600/30 to-slate-950/40',
    accentColor: 'from-cyan-600/40 via-blue-600/30 to-slate-950/40',
    frequency: 'Ambient FM',
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
