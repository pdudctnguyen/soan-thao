// Ảnh mẫu vẽ sẵn (SVG) — để học sinh có ảnh chèn ngay cả khi máy không có sẵn tệp ảnh.
const svg = (body, bg = '#e8f4fd') =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><rect width="400" height="300" fill="${bg}"/>${body}</svg>`)}`

export const CLIPART = {
  truong: {
    name: 'Trường học',
    src: svg(`<circle cx="340" cy="55" r="28" fill="#ffd54f"/><rect y="230" width="400" height="70" fill="#8bc34a"/>
      <rect x="70" y="120" width="260" height="115" fill="#ffe0b2" stroke="#8d6e63" stroke-width="3"/>
      <polygon points="55,125 200,60 345,125" fill="#e53935"/><rect x="180" y="175" width="40" height="60" fill="#795548"/>
      ${[95, 135, 245, 285].map((x) => `<rect x="${x}" y="145" width="26" height="24" fill="#81d4fa" stroke="#5d4037" stroke-width="2"/>`).join('')}
      <rect x="160" y="128" width="80" height="20" fill="#fff" stroke="#8d6e63"/><text x="200" y="143" font-family="Arial" font-size="12" text-anchor="middle" fill="#c62828" font-weight="bold">TRƯỜNG</text>
      <line x1="200" y1="60" x2="200" y2="25" stroke="#555" stroke-width="2"/><polygon points="200,25 228,32 200,40" fill="#e53935"/>
      <circle cx="40" cy="215" r="22" fill="#43a047"/><rect x="37" y="215" width="6" height="22" fill="#6d4c41"/>
      <circle cx="365" cy="212" r="24" fill="#43a047"/><rect x="362" y="212" width="6" height="24" fill="#6d4c41"/>`),
  },
  cay: {
    name: 'Cây xanh',
    src: svg(`<rect y="240" width="400" height="60" fill="#a5d6a7"/><rect x="185" y="150" width="30" height="100" fill="#6d4c41"/>
      <circle cx="200" cy="120" r="70" fill="#43a047"/><circle cx="150" cy="140" r="45" fill="#4caf50"/><circle cx="250" cy="140" r="45" fill="#388e3c"/>
      <circle cx="200" cy="80" r="45" fill="#66bb6a"/><circle cx="170" cy="110" r="8" fill="#e53935"/><circle cx="235" cy="100" r="8" fill="#e53935"/><circle cx="210" cy="150" r="8" fill="#e53935"/>
      <circle cx="60" cy="60" r="26" fill="#ffd54f"/>`, '#e3f2fd'),
  },
  giaDinh: {
    name: 'Gia đình',
    src: svg(`<rect y="245" width="400" height="55" fill="#ffe0b2"/>
      ${[[110, 1.15, '#1e88e5'], [200, 1.1, '#e91e63'], [280, 0.75, '#ffb300'], [330, 0.65, '#43a047']].map(([x, k, c]) => `<g transform="translate(${x} 245) scale(${k})"><circle cx="0" cy="-150" r="24" fill="#ffcc80"/><circle cx="-8" cy="-153" r="3" fill="#333"/><circle cx="8" cy="-153" r="3" fill="#333"/><path d="M-8,-142 q8,7 16,0" stroke="#333" stroke-width="2" fill="none"/><rect x="-26" y="-122" width="52" height="72" rx="14" fill="${c}"/><rect x="-20" y="-52" width="14" height="52" fill="#455a64"/><rect x="6" y="-52" width="14" height="52" fill="#455a64"/></g>`).join('')}
      <path d="M40 60 l10 -10 l10 10 l-10 14 z" fill="#e53935"/>`, '#fff8e1'),
  },
  thapRua: {
    name: 'Hồ Gươm – Tháp Rùa',
    src: svg(`<rect y="170" width="400" height="130" fill="#4fc3f7"/><path d="M0 175 q50 -8 100 0 t100 0 t100 0 t100 0" stroke="#b3e5fc" stroke-width="3" fill="none"/>
      <ellipse cx="200" cy="200" rx="70" ry="12" fill="#6d4c41"/><rect x="160" y="130" width="80" height="70" fill="#e0c9a6" stroke="#8d6e63" stroke-width="2"/>
      <rect x="172" y="95" width="56" height="38" fill="#e0c9a6" stroke="#8d6e63" stroke-width="2"/><rect x="184" y="70" width="32" height="27" fill="#e0c9a6" stroke="#8d6e63" stroke-width="2"/>
      ${[172, 192, 212].map((x) => `<path d="M${x} 200 v-22 a8 8 0 0 1 16 0 v22" fill="#8d6e63"/>`).join('')}
      <rect x="194" y="78" width="12" height="14" rx="6" fill="#8d6e63"/><circle cx="60" cy="140" r="30" fill="#2e7d32"/><circle cx="350" cy="140" r="34" fill="#2e7d32"/>
      <rect x="57" y="140" width="6" height="35" fill="#5d4037"/><rect x="347" y="140" width="6" height="35" fill="#5d4037"/>`, '#e1f5fe'),
  },
  bong: {
    name: 'Bóng đá',
    src: svg(`<rect y="200" width="400" height="100" fill="#66bb6a"/><line x1="0" y1="250" x2="400" y2="250" stroke="#fff" stroke-width="3"/>
      <circle cx="200" cy="150" r="70" fill="#fff" stroke="#333" stroke-width="3"/><polygon points="200,118 228,138 218,170 182,170 172,138" fill="#333"/>
      <path d="M200 118 v-38 M228 138 l36 -12 M218 170 l22 32 M182 170 l-22 32 M172 138 l-36 -12" stroke="#333" stroke-width="3"/>
      <rect x="20" y="120" width="60" height="80" fill="none" stroke="#fff" stroke-width="4"/><rect x="320" y="120" width="60" height="80" fill="none" stroke="#fff" stroke-width="4"/>`, '#bbdefb'),
  },
  mayTinh: {
    name: 'Máy tính',
    src: svg(`<rect x="90" y="50" width="220" height="150" rx="10" fill="#37474f"/><rect x="104" y="64" width="192" height="118" fill="#4fc3f7"/>
      <rect x="120" y="80" width="80" height="10" fill="#fff"/><rect x="120" y="98" width="140" height="8" fill="#e1f5fe"/><rect x="120" y="112" width="120" height="8" fill="#e1f5fe"/>
      <rect x="230" y="130" width="50" height="38" fill="#ffca28"/><rect x="180" y="200" width="40" height="30" fill="#546e7a"/><rect x="140" y="228" width="120" height="12" rx="4" fill="#455a64"/>
      <rect x="70" y="252" width="200" height="26" rx="5" fill="#cfd8dc" stroke="#90a4ae"/><ellipse cx="315" cy="263" rx="16" ry="20" fill="#cfd8dc" stroke="#90a4ae"/>`, '#eceff1'),
  },
  sach: {
    name: 'Sách vở',
    src: svg(`<rect y="230" width="400" height="70" fill="#bcaaa4"/>
      <rect x="80" y="190" width="240" height="40" fill="#e53935"/><rect x="95" y="150" width="210" height="40" fill="#1e88e5"/><rect x="110" y="110" width="180" height="40" fill="#43a047"/>
      <rect x="88" y="198" width="224" height="6" fill="#fff" opacity=".7"/><rect x="103" y="158" width="194" height="6" fill="#fff" opacity=".7"/><rect x="118" y="118" width="164" height="6" fill="#fff" opacity=".7"/>
      <path d="M140 105 l40 -60 l8 4 l-40 60 z" fill="#ffb300"/><path d="M140 105 l8 4 l-10 6 z" fill="#333"/>`, '#fff3e0'),
  },
  canhDep: {
    name: 'Cảnh đẹp quê hương',
    src: svg(`<circle cx="320" cy="70" r="30" fill="#ffca28"/><polygon points="0,200 90,90 180,200" fill="#7cb342"/><polygon points="120,200 230,70 340,200" fill="#558b2f"/><polygon points="260,200 340,120 400,170 400,200" fill="#7cb342"/>
      <rect y="195" width="400" height="105" fill="#9ccc65"/><path d="M0 250 q100 -30 200 0 t200 0 v50 h-400 z" fill="#4fc3f7"/>
      <rect x="60" y="210" width="50" height="34" fill="#ffe0b2" stroke="#6d4c41"/><polygon points="52,212 85,188 118,212" fill="#a1887f"/>`, '#e1f5fe'),
  },
}
