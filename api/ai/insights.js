export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const title = (req.query.title || 'Melody').trim();
  const artist = (req.query.artist || 'Artist').trim();
  const lowerTitle = title.toLowerCase();

  let emotion = 'Soulful & Melodic';
  let recommended_eq = 'Vocal Brilliance';
  let theme = `Acoustic richness and vocal depth in "${title}"`;
  let story = `Masterfully performed by ${artist}. The arrangement emphasizes emotive harmonics and rhythm progression designed for immersive headphone playback.`;

  if (lowerTitle.includes('hukum') || lowerTitle.includes('badass') || lowerTitle.includes('ready') || lowerTitle.includes('vikram')) {
    emotion = 'High Adrenaline & Mass Euphoria';
    recommended_eq = 'Bass Monster';
    theme = `Unstoppable theatrical mass energy in "${title}"`;
    story = `An explosive composition with thunderous percussion and driving synth rhythms crafted for speaker-shattering intensity.`;
  } else if (lowerTitle.includes('vaseegara') || lowerTitle.includes('munbe vaa') || lowerTitle.includes('kannazhaga')) {
    emotion = 'Pure Romantic Serenity';
    recommended_eq = 'Acoustic Clarity';
    theme = `Timeless romantic intimacy in "${title}"`;
    story = `Delicate strings, soft acoustic layers, and heartfelt vocal contours that soothe the mind and calm the senses.`;
  }

  res.setHeader('Cache-Control', 'public, max-age=600');
  return res.status(200).json({
    theme,
    emotion,
    story,
    lines: [
      `Vocal brilliance and dynamic frequency separation tuned for Aura's 10-Band EQ.`,
      `Spatial acoustics configured for optimal stage presence.`
    ],
    composer_notes: `Rendered with 320kbps fidelity and adaptive stereo width.`,
    recommended_eq
  });
}
