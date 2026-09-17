export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let message = '';
  let currentSong = null;

  if (req.method === 'POST') {
    const body = req.body || {};
    message = (body.message || '').trim();
    currentSong = body.currentSong || null;
  } else {
    message = (req.query.message || '').trim();
  }

  const apiKey = process.env.GEMINI_API_KEY || '';

  // 1. Try Google Gemini API if server has key configured
  if (apiKey && message) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const systemInstruction = `You are Aura AI Assistant in Aura Music Player. Speak friendly Tanglish (using 'nanba') or English. Output strictly JSON: { "reply": string, "action": { "type": "TOGGLE_KARAOKE"|"SET_EQ_PRESET"|"PLAY"|"PAUSE"|"NEXT_TRACK"|"PREV_TRACK"|"NAVIGATE_TAB"|"OPEN_AI_INSIGHTS"|"SEARCH_AND_PLAY", "preset"?: string, "tab"?: string, "query"?: string } | null }`;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: message }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
          return res.status(200).json(parsed);
        }
      }
    } catch (err) {
      console.warn('Server-side Gemini proxy error:', err);
    }
  }

  // 2. High-precision native Tanglish intent engine
  const q = message.toLowerCase();
  let reply = '';
  let action = null;

  if (q.includes('karaoke') || q.includes('vocal') || q.includes('sing') || q.includes('paada')) {
    reply = 'Karaoke Vocal Cut Mode toggle pannitten nanba! 🎙️ Vocals isolate aagiduchu. Neenga paadalaam!';
    action = { type: 'TOGGLE_KARAOKE' };
  } else if (q.includes('bass') || q.includes('heavy') || q.includes('sub')) {
    reply = 'Bass Monster Mode activated! 🔊 Equalizer-la Sub-Bass (+6dB) boost pannitten.';
    action = { type: 'SET_EQ_PRESET', preset: 'bass' };
  } else if (q.includes('dj') || q.includes('studio') || q.includes('vibe')) {
    reply = 'Aura AI DJ Studio-ku switch pannitten nanba! 🎛️ Custom mood playlists create pannunga!';
    action = { type: 'NAVIGATE_TAB', tab: 'ai-studio' };
  } else if (q.includes('pause') || q.includes('stop')) {
    reply = 'Music pause pannitten nanba. ⏸️';
    action = { type: 'PAUSE' };
  } else if (q.includes('play') || q.includes('resume')) {
    reply = 'Playback start pannitten! ▶️ Enjoy the music!';
    action = { type: 'PLAY' };
  } else if (q.includes('next') || q.includes('skip')) {
    reply = 'Adutha track-ku skip pannitten nanba! ⏭️';
    action = { type: 'NEXT_TRACK' };
  } else if (q.includes('prev') || q.includes('back')) {
    reply = 'Previous track-ku back pannitten! ⏮️';
    action = { type: 'PREV_TRACK' };
  } else if (q.includes('explain') || q.includes('meaning') || q.includes('story') || q.includes('lyrics')) {
    reply = currentSong
      ? `"${currentSong.title}" song-oda AI insights & lyrics breakdown panel open pannitten nanba! 📜✨`
      : 'Oru song play pannitu kelunga nanba, full lyrics breakdown tharen! 🎵';
    action = { type: 'OPEN_AI_INSIGHTS' };
  } else if (q.includes('radio') || q.includes('fm')) {
    reply = 'Live 24/7 Tamil HD stations streaming at 320kbps in the Radio tab! 📻';
    action = { type: 'NAVIGATE_TAB', tab: 'home' };
  } else if (q.includes('library') || q.includes('offline')) {
    reply = 'Unga offline local library-ku kootitu poren nanba! 📂';
    action = { type: 'NAVIGATE_TAB', tab: 'library' };
  } else {
    reply = `Vanakkam nanba! Unga command: "${message}". "boost bass", "turn on karaoke", "open ai dj studio", alladhu "play hukum" sollunga, udane control panren! 🚀🔥`;
  }

  return res.status(200).json({ reply, action });
}
