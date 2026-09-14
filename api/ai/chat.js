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

  const lower = message.toLowerCase();
  let reply = `Vanakkam nanba! Aura AI assistant here. How can I tune your audio or find your next favorite track?`;
  let action = null;

  if (lower.includes('bass') || lower.includes('heavy')) {
    reply = `Mass bass mode on! You can open the Equalizer and toggle the 'Bass Monster' preset for punchy low-frequency resonance.`;
    action = { type: 'open_equalizer', preset: 'Bass Monster' };
  } else if (lower.includes('chill') || lower.includes('sleep') || lower.includes('relax')) {
    reply = `Set you up for peaceful vibes nanba. Try our 'Late Night Drive' or 'Rainy Day Nostalgia' presets in AI DJ Studio!`;
    action = { type: 'switch_tab', tab: 'ai-studio' };
  } else if (lower.includes('recommend') || lower.includes('song') || lower.includes('suggest')) {
    if (currentSong && currentSong.artist) {
      reply = `Since you are listening to "${currentSong.title}" by ${currentSong.artist}, check out the dedicated Artist Playlist tab to explore their full studio discography!`;
    } else {
      reply = `Check out our 54 curated Tamil Artist Playlists in the Library, or browse the Live HD Radio stations for continuous commercial-free music!`;
    }
  } else if (lower.includes('radio') || lower.includes('fm')) {
    reply = `We have 10+ live 24/7 Tamil HD stations streaming at 320kbps in the Radio tab. Tune in anytime!`;
    action = { type: 'switch_tab', tab: 'radio' };
  }

  return res.status(200).json({ reply, action });
}
