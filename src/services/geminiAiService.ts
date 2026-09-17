import { AiChatMessage } from '../types/music';

export interface AssistantResponse {
  reply: string;
  action?: AiChatMessage['action'];
}

export interface AssistantContext {
  currentSong?: {
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
  } | null;
  isPlaying?: boolean;
  volume?: number;
}

const STORAGE_KEY = 'AURA_GEMINI_API_KEY';

class GeminiAiService {
  public getApiKey(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();

    // Fallback to environment variable if present
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    return envKey.trim();
  }

  public setApiKey(key: string): void {
    if (typeof window === 'undefined') return;
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  public hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Primary entry point for AI Chat interactions.
   * Uses Google Gemini 2.5 Flash when API key is provided,
   * falling back automatically to the advanced local Tanglish NLP engine.
   */
  public async askAssistant(message: string, context: AssistantContext): Promise<AssistantResponse> {
    const text = message.trim();
    if (!text) {
      return { reply: 'Sollunga nanba! Enna help venum? 🎵' };
    }

    const apiKey = this.getApiKey();

    if (apiKey) {
      try {
        const geminiRes = await this.callGeminiApi(text, apiKey, context);
        if (geminiRes) {
          return geminiRes;
        }
      } catch (err) {
        console.warn('[GeminiAiService] Gemini API call error, using smart local fallback:', err);
      }
    }

    // High-precision local Tanglish NLP engine
    return this.runSmartLocalIntent(text, context);
  }

  /**
   * Direct REST call to Google Gemini 2.5 Flash / 1.5 Flash endpoint
   */
  private async callGeminiApi(
    prompt: string,
    apiKey: string,
    context: AssistantContext
  ): Promise<AssistantResponse | null> {
    const currentInfo = context.currentSong
      ? `Current Playing Song: "${context.currentSong.title}" by ${context.currentSong.artist || 'Unknown'}`
      : 'No track is currently playing.';

    const systemInstruction = `You are "Aura AI Assistant", an intelligent, cheerful, and witty music assistant embedded inside Aura Music Player.
You speak naturally in friendly Tamil/Tanglish (using casual words like 'nanba', 'thalaiva', 'adipoli', 'sema vibe') or English when addressed in English.
You have FULL control over the music player.

PLAYER CAPABILITIES:
- TOGGLE_KARAOKE: Turn on/off Karaoke mode (removes/mutes center vocal channel)
- SET_EQ_PRESET: Apply equalizer preset ('bass', 'vocal', 'pop', 'rock', 'electronic', 'classical', 'flat')
- PLAY: Resume/play audio
- PAUSE: Pause playback
- NEXT_TRACK: Skip to next song
- PREV_TRACK: Go to previous song
- TOGGLE_SHUFFLE: Shuffle queue
- SEARCH_AND_PLAY: Search library or online catalog and play immediately (pass query: string)
- NAVIGATE_TAB: Switch tab ('home', 'library', 'search', 'playlists', 'ai-studio', 'settings')
- OPEN_AI_INSIGHTS: Open poetic lyrics breakdown and emotional analysis for current song
- SET_VOLUME: Set volume between 0 and 1 (pass volume: number)

CONTEXT:
${currentInfo}
Is Playing: ${context.isPlaying ? 'Yes' : 'No'}

CRITICAL INSTRUCTION:
Return strictly a valid JSON object without markdown fences, with this exact schema:
{
  "reply": "friendly Tanglish/English response text",
  "action": {
    "type": "TOGGLE_KARAOKE" | "SET_EQ_PRESET" | "PLAY" | "PAUSE" | "NEXT_TRACK" | "PREV_TRACK" | "TOGGLE_SHUFFLE" | "SEARCH_AND_PLAY" | "NAVIGATE_TAB" | "OPEN_AI_INSIGHTS" | "SET_VOLUME",
    "preset"?: "bass" | "vocal" | "pop" | "rock" | "electronic" | "classical" | "flat",
    "tab"?: "home" | "library" | "search" | "playlists" | "ai-studio" | "settings",
    "query"?: string,
    "volume"?: number
  } | null
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      // Fallback model attempt: gemini-1.5-flash
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const fbResponse = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
        })
      });

      if (!fbResponse.ok) return null;
      const fbData = await fbResponse.json();
      return this.parseGeminiOutput(fbData);
    }

    const data = await response.json();
    return this.parseGeminiOutput(data);
  }

  private parseGeminiOutput(data: any): AssistantResponse | null {
    try {
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.reply === 'string') {
        return {
          reply: parsed.reply,
          action: parsed.action || undefined
        };
      }
    } catch (e) {
      console.warn('Failed to parse Gemini response JSON:', e);
    }
    return null;
  }

  /**
   * Rich Local Tanglish & English Intent Matcher (Offline / No Key Fallback)
   */
  public runSmartLocalIntent(query: string, context: AssistantContext): AssistantResponse {
    const q = query.toLowerCase().trim();
    const current = context.currentSong;

    // 1. Karaoke & Vocal Cut
    if (
      q.includes('karaoke') ||
      q.includes('vocal cut') ||
      q.includes('vocal remover') ||
      q.includes('mute singer') ||
      q.includes('mute vocal') ||
      q.includes('sing') ||
      q.includes('paada')
    ) {
      return {
        reply: 'Karaoke Vocal Cut Mode toggle pannitten nanba! 🎙️ Center-channel vocals attenuate aagiduchu. Live-a paadi kalakkunga!',
        action: { type: 'TOGGLE_KARAOKE' }
      };
    }

    // 2. Bass Boost / Bass Monster
    if (
      q.includes('bass') ||
      q.includes('beat boost') ||
      q.includes('heavy bass') ||
      q.includes('sub bass') ||
      q.includes('punchy')
    ) {
      return {
        reply: 'Bass Monster Mode activated nanba! 🔊 10-Band Equalizer-la Sub-Bass (+6dB) boost panniten. Adipoliya kettu enjoy pannunga!',
        action: { type: 'SET_EQ_PRESET', preset: 'bass' }
      };
    }

    // 3. Other EQ Presets
    if (q.includes('vocal') || q.includes('clarity') || q.includes('speech') || q.includes('kural')) {
      return {
        reply: 'Vocal Clarity Mode activate aagiduchu! 🎤 Crisp mid-frequencies-la vocal thelivaa kekkum.',
        action: { type: 'SET_EQ_PRESET', preset: 'vocal' }
      };
    }
    if (q.includes('pop')) {
      return {
        reply: 'Pop Vibrant Equalizer preset set pannitten! 🎧 Balanced dynamics for modern tracks.',
        action: { type: 'SET_EQ_PRESET', preset: 'pop' }
      };
    }
    if (q.includes('rock') || q.includes('metal')) {
      return {
        reply: 'Rock Dynamic Punch Equalizer apply pannitten! 🎸 Heavy guitar and aggressive presence.',
        action: { type: 'SET_EQ_PRESET', preset: 'rock' }
      };
    }
    if (q.includes('electronic') || q.includes('edm') || q.includes('dance') || q.includes('kuthu')) {
      return {
        reply: 'Club EDM & Festival Equalizer preset ready! 🎛️ Tight sub-bass and crisp highs!',
        action: { type: 'SET_EQ_PRESET', preset: 'electronic' }
      };
    }
    if (q.includes('flat') || q.includes('reset eq') || q.includes('normal eq') || q.includes('standard')) {
      return {
        reply: 'Equalizer-a Flat Studio Reference sound-ku reset pannitten nanba. 🎚️',
        action: { type: 'SET_EQ_PRESET', preset: 'flat' }
      };
    }

    // 4. Playback Controls
    if (q.includes('pause') || q.includes('stop') || q.includes('nillu') || q.includes('niruthu')) {
      return {
        reply: 'Music pause pannitten nanba. ⏸️',
        action: { type: 'PAUSE' }
      };
    }
    if (q.includes('play') || q.includes('resume') || q.includes('thodargu') || q.includes('start')) {
      return {
        reply: 'Playback resume aagiduchu nanba! ▶️ Enjoy the music!',
        action: { type: 'PLAY' }
      };
    }
    if (q.includes('next') || q.includes('skip') || q.includes('adutha')) {
      return {
        reply: 'Next song-ku skip pannitten nanba! ⏭️',
        action: { type: 'NEXT_TRACK' }
      };
    }
    if (q.includes('prev') || q.includes('back') || q.includes('munthaiya')) {
      return {
        reply: 'Previous song-ku back pannitten nanba! ⏮️',
        action: { type: 'PREV_TRACK' }
      };
    }
    if (q.includes('shuffle') || q.includes('kuzhappu') || q.includes('random')) {
      return {
        reply: 'Queue order-a shuffle pannitten nanba! 🔀 Unpredictable fresh vibe!',
        action: { type: 'TOGGLE_SHUFFLE' }
      };
    }

    // 5. Direct Song Play / Search Commands: "play hukum", "podu anirudh"
    const playMatch = q.match(/^(?:play|podu|search and play)\s+(.+)$/);
    if (playMatch && playMatch[1]) {
      const songQuery = playMatch[1].trim();
      return {
        reply: `"${songQuery}" search panni queue-la add panni play panren nanba! 🎵🔥`,
        action: { type: 'SEARCH_AND_PLAY', query: songQuery }
      };
    }

    // 6. Navigation Tabs
    if (q.includes('dj') || q.includes('studio') || q.includes('vibe playlist')) {
      return {
        reply: 'Aura AI DJ Studio-ku kootitu poren nanba! 🎛️ Mood-based AI playlists create pannalaam.',
        action: { type: 'NAVIGATE_TAB', tab: 'ai-studio' }
      };
    }
    if (q.includes('radio') || q.includes('fm') || q.includes('live station')) {
      return {
        reply: 'Live 24/7 Tamil HD Radio stations list Home tab top-la ready-a iruku nanba! 📻',
        action: { type: 'NAVIGATE_TAB', tab: 'home' }
      };
    }
    if (q.includes('library') || q.includes('offline') || q.includes('my songs') || q.includes('downloads')) {
      return {
        reply: 'Unga Music Library-kku switch pannitten nanba! 📂',
        action: { type: 'NAVIGATE_TAB', tab: 'library' }
      };
    }
    if (q.includes('search') || q.includes('thedu')) {
      return {
        reply: 'Search View-kku kootitu poren nanba! 🔍',
        action: { type: 'NAVIGATE_TAB', tab: 'search' }
      };
    }
    if (q.includes('playlist') || q.includes('custom playlist')) {
      return {
        reply: 'Playlists tab-ku kootitu poren nanba! 📑',
        action: { type: 'NAVIGATE_TAB', tab: 'playlists' }
      };
    }
    if (q.includes('settings') || q.includes('diagnostic')) {
      return {
        reply: 'Settings tab-kku switch pannitten nanba! ⚙️',
        action: { type: 'NAVIGATE_TAB', tab: 'settings' }
      };
    }

    // 7. Song Explanation / Meaning
    if (
      q.includes('explain') ||
      q.includes('meaning') ||
      q.includes('story') ||
      q.includes('lyrics') ||
      q.includes('kadha') ||
      q.includes('artham')
    ) {
      if (current && current.title) {
        return {
          reply: `"${current.title}" song-oda AI Insights, poetic meaning and composer story panel-ah open pannitten nanba! 📜✨`,
          action: { type: 'OPEN_AI_INSIGHTS' }
        };
      } else {
        return {
          reply: 'Nanba, ippo edhum song play aagala. Oru track play pannitu kelunga, full breakdown tharen! 🎶'
        };
      }
    }

    // 8. Greetings & General conversation
    if (q.includes('hi') || q.includes('hello') || q.includes('vanakkam') || q.includes('hey') || q.includes('machi')) {
      return {
        reply: 'Vanakkam nanba! 👋 Enna pannanum sollunga: "boost bass", "turn on karaoke", "open ai dj studio", "play hukum", "next song" nu sollunga, udane seiren! 🚀'
      };
    }

    // Default friendly response
    return {
      reply: `Nanba! Unga command "${query}" kettu register pannitten. Aura AI Assistant 100% active. Player tune panna "boost bass", "turn on karaoke", or "open ai dj studio" sollunga! 🎵🔥`
    };
  }
}

export const geminiAiService = new GeminiAiService();
