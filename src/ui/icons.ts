// Иконки без слов (SVG, 24×24 если не указано иначе).
const svg = (body: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICON = {
  home: svg('<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h4.5v-5h3v5H18V9.5"/>'),
  arrowBack: svg('<path d="M19.5 12H5.5M11.5 5.5 5 12l6.5 6.5"/>'),
  listen: svg('<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z" fill="currentColor" stroke-width="1.6"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/>'),
  check: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M7.6 10.6 9.8 12.8l3.6-4"/><path d="M15.4 15.4 20 20"/>'),
  phrase: svg('<path d="M4 5.5h16v10H11l-4.5 4v-4H4z"/><path d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" stroke-width="3.2"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke-width="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  replay: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  next: svg('<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  speaker: svg('<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z" fill="currentColor" stroke-width="1.6"/><path d="M16 9a4 4 0 0 1 0 6"/>'),
  rotate: svg('<rect x="7" y="2.5" width="10" height="17" rx="2" transform="rotate(-90 12 12)"/><path d="M4 7a8 8 0 0 1 4-3.5M8 3.5H4.6V7"/>'),
};

/** Монетка Moneysleep. */
export const COIN = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#E9A92C"/><circle cx="20" cy="19" r="16" fill="#FFD34D"/><circle cx="20" cy="19" r="12.5" fill="none" stroke="#E9A92C" stroke-width="2"/><text x="20" y="25" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="16" fill="#C98A1E">M</text></svg>`;

export const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.3 3.6 1.5-7.1L1.8 9.2 9 8.4z" fill="#FFD34D" stroke="#F2B81F" stroke-width="1" stroke-linejoin="round"/></svg>`;

/** Мордашки «да / нет» — без красного и зелёного. */
export const FACE_HAPPY = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="#FFD34D"/><circle cx="60" cy="60" r="56" fill="none" stroke="#F2B81F" stroke-width="4"/><ellipse cx="42" cy="50" rx="7" ry="9" fill="#0B1A33"/><ellipse cx="78" cy="50" rx="7" ry="9" fill="#0B1A33"/><circle cx="44.5" cy="46.5" r="2.5" fill="#fff"/><circle cx="80.5" cy="46.5" r="2.5" fill="#fff"/><circle cx="30" cy="70" r="8" fill="#FF8FA3" opacity=".55"/><circle cx="90" cy="70" r="8" fill="#FF8FA3" opacity=".55"/><path d="M38 70 Q60 96 82 70" fill="#0B1A33"/><path d="M48 82 Q60 90 72 82 Q60 92 48 82Z" fill="#E2506A"/></svg>`;
export const FACE_SAD = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="#B8C6E6"/><circle cx="60" cy="60" r="56" fill="none" stroke="#97A9D3" stroke-width="4"/><path d="M31 45 Q40 43 49 37M89 45 Q80 43 71 37" stroke="#0B1A33" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="44" cy="56" rx="6.5" ry="8" fill="#0B1A33"/><ellipse cx="76" cy="56" rx="6.5" ry="8" fill="#0B1A33"/><path d="M42 88 Q60 72 78 88" stroke="#0B1A33" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M84 64 q5 9 0 13 q-5 -4 0 -13z" fill="#3D7BFF" opacity=".8"/></svg>`;
