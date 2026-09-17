import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('public', 'radio-logos');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const logos = {
  'suryan_fm.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="suryan_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff1a1a"/>
        <stop offset="50%" stop-color="#ff6600"/>
        <stop offset="100%" stop-color="#ffcc00"/>
      </linearGradient>
      <radialGradient id="sunburst" cx="50%" cy="45%" r="40%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#ffe600" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#ff3300" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#suryan_bg)"/>
    <circle cx="100" cy="80" r="55" fill="url(#sunburst)"/>
    <g stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.85">
      <line x1="100" y1="18" x2="100" y2="32"/>
      <line x1="100" y1="128" x2="100" y2="142"/>
      <line x1="43" y1="80" x2="57" y2="80"/>
      <line x1="143" y1="80" x2="157" y2="80"/>
      <line x1="60" y1="40" x2="70" y2="50"/>
      <line x1="140" y1="40" x2="130" y2="50"/>
      <line x1="60" y1="120" x2="70" y2="110"/>
      <line x1="140" y1="120" x2="130" y2="110"/>
    </g>
    <text x="100" y="88" font-family="'Montserrat', 'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">SURYAN</text>
    <rect x="30" y="116" width="140" height="34" rx="10" fill="#0b0d13" opacity="0.9"/>
    <text x="100" y="139" font-family="'Arial Black', sans-serif" font-size="18" font-weight="900" fill="#ffe600" text-anchor="middle" letter-spacing="1.5">93.5 FM</text>
    <text x="100" y="174" font-family="sans-serif" font-size="10" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2">KETTA MASS</text>
  </svg>`,

  'shakthi_fm.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="shakthi_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#001a4d"/>
        <stop offset="60%" stop-color="#0044cc"/>
        <stop offset="100%" stop-color="#ff6600"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#shakthi_bg)"/>
    <path d="M30,100 Q65,60 100,100 T170,100" fill="none" stroke="#ff9900" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
    <path d="M40,110 Q75,70 100,110 T160,110" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <text x="100" y="72" font-family="'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#ff9900" text-anchor="middle" letter-spacing="1.5">SHAKTHI</text>
    <rect x="35" y="128" width="130" height="32" rx="10" fill="#ff6600"/>
    <text x="100" y="150" font-family="'Arial Black', sans-serif" font-size="17" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">104.1 FM</text>
    <text x="100" y="182" font-family="sans-serif" font-size="9" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2">SRI LANKA #1 TAMIL</text>
  </svg>`,

  'sooriyan_fm.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="sooriyan_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#800000"/>
        <stop offset="50%" stop-color="#cc2900"/>
        <stop offset="100%" stop-color="#ff9900"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#sooriyan_bg)"/>
    <circle cx="100" cy="80" r="42" fill="#ffd700" opacity="0.95"/>
    <text x="100" y="88" font-family="'Arial Black', sans-serif" font-size="21" font-weight="900" fill="#b30000" text-anchor="middle" letter-spacing="1">SOORIYAN</text>
    <rect x="35" y="130" width="130" height="32" rx="10" fill="#1a0000" opacity="0.9"/>
    <text x="100" y="152" font-family="'Arial Black', sans-serif" font-size="16" font-weight="900" fill="#ffd700" text-anchor="middle" letter-spacing="1.5">103.4 FM</text>
    <text x="100" y="182" font-family="sans-serif" font-size="9" font-weight="700" fill="#ffe6b3" text-anchor="middle" letter-spacing="2">ISLAND'S PRIDE</text>
  </svg>`,

  'ilaiyaraaja_radio.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="raaja_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1f1400"/>
        <stop offset="60%" stop-color="#4d3300"/>
        <stop offset="100%" stop-color="#805500"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#raaja_bg)"/>
    <circle cx="100" cy="75" r="45" fill="none" stroke="#ffd700" stroke-width="2" stroke-dasharray="4,3" opacity="0.7"/>
    <path d="M88,52 L116,46 L116,86 A10,10 0 1,1 106,76 L106,62 L94,65 L94,92 A10,10 0 1,1 84,82 Z" fill="#ffd700"/>
    <text x="100" y="128" font-family="'Georgia', serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">ILAIYARAAJA</text>
    <rect x="45" y="142" width="110" height="24" rx="8" fill="#ffd700"/>
    <text x="100" y="158" font-family="'Arial Black', sans-serif" font-size="12" font-weight="900" fill="#1a1100" text-anchor="middle" letter-spacing="2">24/7 MAESTRO</text>
    <text x="100" y="182" font-family="sans-serif" font-size="9" font-weight="700" fill="#d4af37" text-anchor="middle" letter-spacing="2">EVERGREEN CLASSICS</text>
  </svg>`,

  'ar_rahman_radio.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="arr_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0d001a"/>
        <stop offset="50%" stop-color="#2e0854"/>
        <stop offset="100%" stop-color="#6b1199"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#arr_bg)"/>
    <g fill="#00f0ff" opacity="0.8">
      <rect x="55" y="70" width="6" height="28" rx="3"/>
      <rect x="67" y="55" width="6" height="48" rx="3"/>
      <rect x="79" y="42" width="6" height="65" rx="3"/>
      <rect x="91" y="35" width="6" height="75" rx="3"/>
      <rect x="103" y="35" width="6" height="75" rx="3"/>
      <rect x="115" y="42" width="6" height="65" rx="3"/>
      <rect x="127" y="55" width="6" height="48" rx="3"/>
      <rect x="139" y="70" width="6" height="28" rx="3"/>
    </g>
    <text x="100" y="134" font-family="'Arial Black', sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">A.R. RAHMAN</text>
    <rect x="45" y="146" width="110" height="24" rx="8" fill="#00f0ff"/>
    <text x="100" y="162" font-family="'Arial Black', sans-serif" font-size="12" font-weight="900" fill="#0d001a" text-anchor="middle" letter-spacing="2">24/7 LIVE HD</text>
    <text x="100" y="184" font-family="sans-serif" font-size="8.5" font-weight="700" fill="#d980ff" text-anchor="middle" letter-spacing="2">MOZART OF MADRAS</text>
  </svg>`,

  'jei_fm.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="jei_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a052e"/>
        <stop offset="50%" stop-color="#3b1366"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#jei_bg)"/>
    <text x="100" y="82" font-family="'Arial Black', sans-serif" font-size="36" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">JEI FM</text>
    <rect x="35" y="102" width="130" height="36" rx="10" fill="#f59e0b"/>
    <text x="100" y="126" font-family="'Arial Black', sans-serif" font-size="16" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="1.5">320K HD LIVE</text>
    <text x="100" y="164" font-family="sans-serif" font-size="11" font-weight="800" fill="#fcd34d" text-anchor="middle" letter-spacing="1.5">NON-STOP MASS HITS</text>
  </svg>`,

  'tamil_panpalai.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="tp_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2e2005"/>
        <stop offset="50%" stop-color="#5c4008"/>
        <stop offset="100%" stop-color="#b8860b"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#tp_bg)"/>
    <circle cx="100" cy="72" r="38" fill="none" stroke="#ffd700" stroke-width="3"/>
    <text x="100" y="78" font-family="'Georgia', serif" font-size="20" font-weight="bold" fill="#ffd700" text-anchor="middle">பண்பலை</text>
    <text x="100" y="126" font-family="'Arial Black', sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">TAMIL PANPALAI</text>
    <rect x="45" y="136" width="110" height="26" rx="8" fill="#ffd700"/>
    <text x="100" y="154" font-family="'Arial Black', sans-serif" font-size="13" font-weight="900" fill="#2e2005" text-anchor="middle" letter-spacing="1.5">GOLD FM</text>
    <text x="100" y="182" font-family="sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">EUROPE &amp; GLOBAL</text>
  </svg>`,

  'lankasri_fm.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="lankasri_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#990000"/>
        <stop offset="60%" stop-color="#cc0000"/>
        <stop offset="100%" stop-color="#ff3333"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#lankasri_bg)"/>
    <circle cx="100" cy="75" r="42" fill="#ffffff"/>
    <circle cx="100" cy="75" r="34" fill="#cc0000"/>
    <text x="100" y="84" font-family="'Arial Black', sans-serif" font-size="26" font-weight="900" fill="#ffffff" text-anchor="middle">L</text>
    <text x="100" y="134" font-family="'Arial Black', sans-serif" font-size="18" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">LANKASRI</text>
    <rect x="50" y="146" width="100" height="24" rx="8" fill="#ffffff"/>
    <text x="100" y="163" font-family="'Arial Black', sans-serif" font-size="12" font-weight="900" fill="#cc0000" text-anchor="middle" letter-spacing="2">ONLINE FM</text>
    <text x="100" y="184" font-family="sans-serif" font-size="9" font-weight="700" fill="#ffcccc" text-anchor="middle" letter-spacing="1.5">WORLDWIDE TAMIL</text>
  </svg>`,

  'star_fm.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="star_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#001a33"/>
        <stop offset="50%" stop-color="#003366"/>
        <stop offset="100%" stop-color="#0088cc"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#star_bg)"/>
    <polygon points="100,28 112,62 148,62 118,84 130,118 100,96 70,118 82,84 52,62 88,62" fill="#ffd700"/>
    <text x="100" y="142" font-family="'Arial Black', sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">STAR FM</text>
    <rect x="45" y="152" width="110" height="24" rx="8" fill="#ffd700"/>
    <text x="100" y="169" font-family="'Arial Black', sans-serif" font-size="13" font-weight="900" fill="#001a33" text-anchor="middle" letter-spacing="1.5">SRI LANKA</text>
  </svg>`,

  'american_tamil.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="atr_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#001f3f"/>
        <stop offset="50%" stop-color="#003366"/>
        <stop offset="100%" stop-color="#c8102e"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#atr_bg)"/>
    <circle cx="100" cy="75" r="42" fill="#ffffff" opacity="0.1"/>
    <text x="100" y="85" font-family="'Arial Black', sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">ATR</text>
    <text x="100" y="128" font-family="'Arial Black', sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">AMERICAN TAMIL</text>
    <rect x="40" y="142" width="120" height="26" rx="8" fill="#c8102e"/>
    <text x="100" y="160" font-family="'Arial Black', sans-serif" font-size="13" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">RADIO LIVE</text>
  </svg>`,

  'vasantham_fm.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="vas_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#003311"/>
        <stop offset="50%" stop-color="#006622"/>
        <stop offset="100%" stop-color="#00cc44"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#vas_bg)"/>
    <circle cx="100" cy="72" r="38" fill="#ffd700" opacity="0.9"/>
    <text x="100" y="80" font-family="'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#003311" text-anchor="middle">வசந்தம்</text>
    <text x="100" y="132" font-family="'Arial Black', sans-serif" font-size="17" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">VASANTHAM</text>
    <rect x="50" y="144" width="100" height="24" rx="8" fill="#ffd700"/>
    <text x="100" y="161" font-family="'Arial Black', sans-serif" font-size="12" font-weight="900" fill="#003311" text-anchor="middle" letter-spacing="2">MELODIES</text>
  </svg>`,

  'bombay_beats.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="bb_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#330033"/>
        <stop offset="50%" stop-color="#800080"/>
        <stop offset="100%" stop-color="#ff0066"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#bb_bg)"/>
    <rect x="35" y="38" width="50" height="26" rx="6" fill="#ffffff"/>
    <text x="60" y="56" font-family="'Arial Black', sans-serif" font-size="14" font-weight="900" fill="#800080" text-anchor="middle">1.FM</text>
    <text x="100" y="102" font-family="'Arial Black', sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">BOMBAY</text>
    <text x="100" y="128" font-family="'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#ffcc00" text-anchor="middle" letter-spacing="2">BEATS</text>
    <rect x="40" y="146" width="120" height="24" rx="8" fill="#000000" opacity="0.6"/>
    <text x="100" y="162" font-family="'Arial Black', sans-serif" font-size="12" font-weight="900" fill="#00ffcc" text-anchor="middle" letter-spacing="1.5">256K BOLLYWOOD</text>
  </svg>`,

  'lofi_cafe.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="lofi_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a192f"/>
        <stop offset="50%" stop-color="#112240"/>
        <stop offset="100%" stop-color="#233554"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#lofi_bg)"/>
    <circle cx="100" cy="80" r="38" fill="#ff758c"/>
    <g fill="#0a192f">
      <rect x="60" y="86" width="80" height="4"/>
      <rect x="60" y="94" width="80" height="5"/>
      <rect x="60" y="103" width="80" height="6"/>
    </g>
    <text x="100" y="138" font-family="'Courier New', monospace" font-size="18" font-weight="900" fill="#64ffda" text-anchor="middle" letter-spacing="2">LO-FI CAFE</text>
    <rect x="40" y="150" width="120" height="24" rx="8" fill="#64ffda" opacity="0.15" stroke="#64ffda" stroke-width="1"/>
    <text x="100" y="166" font-family="sans-serif" font-size="11" font-weight="700" fill="#64ffda" text-anchor="middle" letter-spacing="1.5">CHILLHOP BEATS</text>
  </svg>`,

  'dance_wave.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="dw_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#12002b"/>
        <stop offset="50%" stop-color="#280054"/>
        <stop offset="100%" stop-color="#ff007f"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#dw_bg)"/>
    <path d="M35,90 L60,40 L85,120 L110,30 L135,130 L165,90" fill="none" stroke="#00f0ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="100" y="142" font-family="'Arial Black', sans-serif" font-size="18" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">DANCE WAVE</text>
    <rect x="45" y="152" width="110" height="24" rx="8" fill="#ff007f"/>
    <text x="100" y="168" font-family="'Arial Black', sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">IBIZA CLUB EDM</text>
  </svg>`,

  'bbc_world.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <rect width="200" height="200" rx="36" fill="#b80000"/>
    <g fill="#ffffff">
      <rect x="35" y="58" width="38" height="38" rx="4"/>
      <rect x="81" y="58" width="38" height="38" rx="4"/>
      <rect x="127" y="58" width="38" height="38" rx="4"/>
    </g>
    <text x="54" y="86" font-family="'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#000000" text-anchor="middle">B</text>
    <text x="100" y="86" font-family="'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#000000" text-anchor="middle">B</text>
    <text x="146" y="86" font-family="'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#000000" text-anchor="middle">C</text>
    <text x="100" y="132" font-family="'Arial Black', sans-serif" font-size="17" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">WORLD SERVICE</text>
    <rect x="45" y="146" width="110" height="24" rx="8" fill="#000000" opacity="0.5"/>
    <text x="100" y="162" font-family="sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2">NEWS 24/7</text>
  </svg>`,

  'groove_salad.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id="gs_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#003333"/>
        <stop offset="50%" stop-color="#004d4d"/>
        <stop offset="100%" stop-color="#008080"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="36" fill="url(#gs_bg)"/>
    <circle cx="100" cy="75" r="40" fill="none" stroke="#80ffe5" stroke-width="4" stroke-dasharray="12,6"/>
    <circle cx="100" cy="75" r="22" fill="#80ffe5" opacity="0.9"/>
    <text x="100" y="132" font-family="'Arial Black', sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">GROOVE SALAD</text>
    <rect x="45" y="146" width="110" height="24" rx="8" fill="#80ffe5"/>
    <text x="100" y="162" font-family="'Arial Black', sans-serif" font-size="11" font-weight="900" fill="#003333" text-anchor="middle" letter-spacing="2">SOMAFM AMBIENT</text>
  </svg>`
};

for (const [name, content] of Object.entries(logos)) {
  fs.writeFileSync(path.join(dir, name), content.trim(), 'utf8');
}

console.log('Successfully generated all 16 authentic brand logos!');
