/* =========================================================
   DISEGNO DEL TABELLONE (SVG)
   1 unità = 1 millimetro. Il tabellone va da (0,0) a (800,500).
   Ogni "strato" (layer) ha:
     from  = fase in cui viene aggiunto
     until = ultima fase in cui è visibile (99 = per sempre)
   ========================================================= */

const W = 800, H = 500, CASELLA = 75;

// Percorso: tappe + punti di curva (null = punto di curva senza tappa)
const PERCORSO = [
  [55, 55, 1], [70, 230, 2], [105, 420, 3], [160, 458], [185, 300], [195, 150, 4],
  [240, 58], [290, 95, 5], [300, 200, 6], [290, 305, 7], [310, 420, 8], [352, 460],
  [395, 400, 9], [405, 285, 10], [400, 150, 11], [448, 55], [495, 85, 12], [490, 190, 13],
  [500, 300, 14], [490, 415, 15], [540, 462], [590, 410, 16], [600, 300, 17],
  [600, 190, 18], [630, 80, 19], [678, 45], [720, 115, 20], [715, 225, 21],
  [700, 330, 22], [735, 435, 23],
];

// Fiume della vita: dalla sorgente nell'Eden alla Nuova Gerusalemme
const FIUME = [
  [125, 228], [140, 280], [150, 330], [172, 372], [215, 392], [262, 385], [300, 368],
  [335, 362], [372, 352], [400, 345], [440, 350], [470, 362], [497, 360], [522, 370],
  [548, 378], [575, 365], [597, 355], [625, 360], [652, 372], [680, 400], [700, 418], [722, 427],
];
const SORGENTE = [125, 228], FOCE = [722, 427];
const SALTI = [[150, 330], [335, 362], [548, 378], [680, 400]];
const PONTI = [[176, 375], [300, 368], [400, 345], [496, 360], [597, 355]];

// Monti e colline: x, y, raggi, numero di "anelli" (più anelli = più alto)
const MONTI = [
  { nome: "Altopiano dell'Eden", x: 100, y: 228, rx: 72, ry: 88, liv: 2, tipo: "verde" },
  { nome: "Monte Ararat", x: 197, y: 182, rx: 72, ry: 142, liv: 6, tipo: "neve" },
  { nome: "Collina di Babele", x: 292, y: 96, rx: 42, ry: 36, liv: 1 },
  { nome: "Monte Sinai", x: 405, y: 150, rx: 50, ry: 72, liv: 4, tipo: "roccia" },
  { nome: "Colline di Davide", x: 490, y: 190, rx: 42, ry: 38, liv: 2 },
  { nome: "Monte Sion", x: 503, y: 300, rx: 44, ry: 40, liv: 2 },
  { nome: "Monte Carmelo", x: 490, y: 415, rx: 42, ry: 34, liv: 2 },
  { nome: "Colline di Betlemme", x: 600, y: 190, rx: 40, ry: 40, liv: 1 },
  { nome: "Golgota", x: 720, y: 115, rx: 44, ry: 44, liv: 2, tipo: "roccia" },
];

// Zone di colore (poligoni)
const ZONE_POLY = {
  origini:    [[0,0],[345,0],[345,150],[250,175],[250,500],[0,500]],
  patriarchi: [[345,0],[450,0],[450,500],[250,500],[250,175],[345,150]],
  re:         [[450,0],[552,0],[552,248],[655,248],[655,500],[450,500]],
  vangeli:    [[552,0],[800,0],[800,500],[655,500],[655,248],[552,248]],
};

// Luci: posizione, tipo
const LUCI = [
  { x: 55, y: 55, t: "fredda", nota: "Creazione (facoltativo)" },
  { x: 312, y: 192, t: "calda", nota: "Tenda di Abramo" },
  { x: 275, y: 300, t: "fuoco", nota: "Sodoma" },
  { x: 325, y: 412, t: "calda", nota: "Tende dei patriarchi" },
  { x: 372, y: 418, t: "calda", nota: "Egitto" },
  { x: 392, y: 268, t: "fuoco", nota: "Roveto ardente" },
  { x: 420, y: 168, t: "calda", nota: "Tenda del convegno" },
  { x: 505, y: 178, t: "calda", nota: "Tenda di Saul" },
  { x: 503, y: 296, t: "calda", nota: "Tempio di Salomone" },
  { x: 482, y: 405, t: "fuoco", nota: "Altare del Carmelo" },
  { x: 610, y: 292, t: "calda", nota: "Case di Gerusalemme" },
  { x: 600, y: 196, t: "calda", nota: "Stalla di Betlemme" },
  { x: 604, y: 172, t: "stella", nota: "Stella cometa" },
  { x: 715, y: 220, t: "calda", nota: "Cenacolo" },
];
const NJ = { x: 735, y: 432, lato: 90 }; // Nuova Gerusalemme
const ALIMENTATORE = [852, 452];

const ETICHETTE = {
  1:"Creazione",2:"Eden",3:"Caino e Abele",4:"Ararat",5:"Babele",6:"Abramo",7:"Sodoma",
  8:"Patriarchi",9:"Egitto",10:"Esodo",11:"Sinai",12:"Gerico",13:"Davide",14:"Tempio",
  15:"Profeti",16:"Babilonia",17:"Neemia",18:"Betlemme",19:"Galilea",20:"Calvario",
  21:"Pentecoste",22:"Paolo",23:"N. Gerusalemme"
};

/* ---------------- utilità ---------------- */
function rng(seed) { // generatore casuale "fisso": stesso disegno ogni volta
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (v) => Math.round(v * 10) / 10;

// Curva morbida che passa per tutti i punti (Catmull-Rom → Bézier)
function curva(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${p2[0]},${p2[1]}`;
  }
  return d;
}
// Ellisse "irregolare" per monti e colline
function blob(x, y, rx, ry, seed) {
  const r = rng(seed), k1 = 2 + Math.floor(r() * 3), k2 = 5 + Math.floor(r() * 3);
  const ph1 = r() * 6.28, ph2 = r() * 6.28, pts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const m = 1 + 0.07 * Math.sin(k1 * a + ph1) + 0.04 * Math.sin(k2 * a + ph2);
    pts.push([f1(x + Math.cos(a) * rx * m), f1(y + Math.sin(a) * ry * m)]);
  }
  pts.push(pts[0]);
  return curva(pts) + "Z";
}
const poly = (p) => "M" + p.map((q) => q.join(",")).join("L") + "Z";
const ROUTE_D = curva(PERCORSO.map((p) => [p[0], p[1]]));
const RIVER_D = curva(FIUME);

/* ------------- campionamento del percorso (serve il browser) ------------- */
function campiona(d, passo) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("style", "position:absolute;width:0;height:0;visibility:hidden");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", d); svg.appendChild(p); document.body.appendChild(svg);
  const L = p.getTotalLength(), out = [];
  for (let s = 0; s <= L; s += passo) { const q = p.getPointAtLength(s); out.push([q.x, q.y]); }
  svg.remove();
  return out;
}

/* ---------------- piccoli disegni (vista dall'alto) ---------------- */
const g = {
  persona: (x, y, c = "#8a3b2a") => `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" fill="${c}" stroke="#3b2618" stroke-width=".5"/><circle cx="${f1(x)}" cy="${f1(y)}" r="1.1" fill="#e9c39b"/>`,
  pecora: (x, y) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="2.4" ry="1.7" fill="#fbf8ef" stroke="#8d8573" stroke-width=".4"/>`,
  capra: (x, y) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="2.2" ry="1.5" fill="#5b4636"/>`,
  cammello: (x, y, a = 0) => `<g transform="translate(${f1(x)},${f1(y)}) rotate(${a})"><ellipse rx="5" ry="2.1" fill="#b98a4f" stroke="#6d4f2a" stroke-width=".4"/><circle cx="6" cy="0" r="1.4" fill="#b98a4f"/><circle cx="-1" cy="0" r="1.3" fill="#d7a96a"/></g>`,
  tenda: (x, y, s = 9, c = "#e8dcc0") => `<g transform="translate(${f1(x)},${f1(y)})"><rect x="${-s/2}" y="${-s*0.35}" width="${s}" height="${s*0.7}" rx="1" fill="${c}" stroke="#7b6a4d" stroke-width=".6"/><line x1="${-s/2}" y1="0" x2="${s/2}" y2="0" stroke="#7b6a4d" stroke-width=".6"/></g>`,
  casa: (x, y, s = 10, c = "#e9dfcb") => `<g transform="translate(${f1(x)},${f1(y)})"><rect x="${-s/2}" y="${-s/2}" width="${s}" height="${s}" fill="${c}" stroke="#6f6252" stroke-width=".6"/><path d="M${-s/2},${-s/2}L0,0L${s/2},${-s/2}M0,0L0,${s/2}" stroke="#a8977e" stroke-width=".5" fill="none"/></g>`,
  palma: (x, y) => { let s = ""; for (let i = 0; i < 6; i++) { const a = i * 1.047; s += `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x + Math.cos(a) * 5)}" y2="${f1(y + Math.sin(a) * 5)}" stroke="#3f7a32" stroke-width="1.3" stroke-linecap="round"/>`; } return s + `<circle cx="${f1(x)}" cy="${f1(y)}" r="1" fill="#6b4a2b"/>`; },
  albero: (x, y, r = 6, c = "#3f7d34") => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${c}" stroke="#24521f" stroke-width=".6"/><circle cx="${f1(x - r/3)}" cy="${f1(y - r/3)}" r="${f1(r/2.2)}" fill="#ffffff" opacity=".12"/>`,
  ulivo: (x, y) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="4" fill="#7f8f55" stroke="#4d5a32" stroke-width=".5"/>`,
  cespuglio: (x, y) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" fill="#5a8d3c"/>`,
  fiore: (x, y, c) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="1.1" fill="${c}"/>`,
  animale: (x, y, c) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="2.6" ry="1.6" fill="${c}" stroke="#3b2c1c" stroke-width=".3"/>`,
  alberoVita: (x, y) => {
    let s = `<circle cx="${x}" cy="${y}" r="20" fill="#2f7d38" stroke="#1d4f23" stroke-width="1"/><circle cx="${x}" cy="${y}" r="13" fill="#3f9645"/>`;
    for (let i = 0; i < 12; i++) { const a = i * 0.5236; s += `<circle cx="${f1(x + Math.cos(a) * 15)}" cy="${f1(y + Math.sin(a) * 15)}" r="1.9" fill="#f2c14e" stroke="#9b6b12" stroke-width=".4"/>`; }
    return s + `<circle cx="${x}" cy="${y}" r="3" fill="#7a5532"/>`;
  },
  stella: (x, y, r = 6, c = "#f5c84b") => { let p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; p.push([f1(x + Math.cos(a) * rr), f1(y + Math.sin(a) * rr)]); } return `<path d="${poly(p)}" fill="${c}" stroke="#a8781a" stroke-width=".5"/>`; },
  fuoco: (x, y, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f08a24"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#ffd34d"/>`,
};

/* ---------------- scene delle tappe (fase 10) ---------------- */
function scene(campioni, idx) {
  const out = [];
  const lungo = (n, da, a, passo, fn) => { // elementi lungo il sentiero
    for (let s = da; s <= a; s += passo) { const p = campioni[idx[n] + s]; if (p) out.push(fn(p[0], p[1], s)); }
  };
  // 1 Creazione: luce e buio
  out.push(`<path d="M18,18 L92,18 L92,92 L18,92Z" fill="#1d2140" opacity=".85"/><path d="M92,18 L92,92 L18,92Z" fill="#fff6d6"/><circle cx="55" cy="55" r="15" fill="#ffe27a" stroke="#d6a72a" stroke-width="1"/>`);
  [[28,30],[40,24],[30,48],[50,32],[24,64],[66,26]].forEach(([x, y]) => out.push(g.stella(x, y, 2.6, "#fff")));
  // 2 Eden
  out.push(g.alberoVita(SORGENTE[0], SORGENTE[1]));
  out.push(g.albero(55, 258, 8, "#4f8c3a"), `<path d="M48,252 q4,-6 8,0 t8,0" stroke="#3c6e1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
  out.push(g.persona(78, 246, "#d9b38c"), g.persona(84, 248, "#d9b38c"));
  [["#c8902f",95,198],["#f4f1e6",101,201],["#8b5a2b",48,205],["#c8902f",60,196],["#888",92,270]].forEach(([c,x,y]) => out.push(g.animale(x, y, c)));
  // 3 Caino e Abele
  out.push(`<rect x="88" y="412" width="11" height="11" fill="#9a9184" stroke="#555" stroke-width=".6"/><rect x="112" y="412" width="11" height="11" fill="#9a9184" stroke="#555" stroke-width=".6"/>`);
  out.push(g.fuoco(93.5, 417.5, 3), g.fuoco(117.5, 417.5, 3), `<path d="M117,410 L117,396" stroke="#bbb" stroke-width="2.5" opacity=".7"/><path d="M93,410 q-6,-5 -2,-12" stroke="#bbb" stroke-width="2.5" fill="none" opacity=".7"/>`);
  for (let i = 0; i < 4; i++) out.push(`<line x1="72" y1="${438 + i * 4}" x2="94" y2="${438 + i * 4}" stroke="#7a5a32" stroke-width="1"/>`);
  [[122,440],[128,444],[118,446],[131,437]].forEach(([x, y]) => out.push(g.pecora(x, y)));
  // 4 Arca sull'Ararat + animali in fila lungo la salita
  out.push(`<g transform="translate(195,150) rotate(-12)"><rect x="-45" y="-7.5" width="90" height="15" rx="6" fill="#7a4b23" stroke="#3e2410" stroke-width="1"/><rect x="-30" y="-4.5" width="60" height="9" fill="#a06a35"/><line x1="-30" y1="0" x2="30" y2="0" stroke="#5b3518" stroke-width=".8"/></g>`);
  const colori = ["#8a8a8a", "#c8902f", "#f4f1e6", "#6b4a2b", "#d8c27a", "#333"];
  lungo(3, 50, 330, 9, (x, y, s) => g.animale(x - 4, y, colori[(s / 9) % 6 | 0]) + g.animale(x + 4, y, colori[(s / 9) % 6 | 0]));
  // 5 Babele
  out.push(`<g transform="translate(305,82)">${[22,17,12,7].map((r, i) => `<rect x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" fill="${["#b98c5a","#c99c68","#d6ab78","#e3bd8c"][i]}" stroke="#7a5732" stroke-width=".7"/>`).join("")}</g>`);
  [[268,118],[272,124],[322,120],[328,116],[262,70],[260,78]].forEach(([x, y]) => out.push(g.persona(x, y, "#6a5acd")));
  // 6 Abramo
  out.push(g.tenda(312, 192, 26, "#e6d3a8"), g.tenda(282, 210, 12), g.tenda(286, 186, 11));
  out.push(g.persona(300, 214, "#8b2e2e"), g.cammello(330, 214, 20), g.cammello(325, 226, -10));
  [[268,198],[272,232],[330,180],[268,176],[318,236]].forEach(([x, y]) => out.push(g.stella(x, y, 2.2)));
  // 7 Sodoma
  [[272,292],[284,288],[278,312],[268,305]].forEach(([x, y]) => out.push(g.casa(x, y, 10, "#5a4136")));
  out.push(g.fuoco(275, 300, 5), g.fuoco(286, 308, 3.5));
  out.push(`<circle cx="306" cy="322" r="3.2" fill="#ffffff" stroke="#999" stroke-width=".8"/>`);
  lungo(7, 22, 46, 8, (x, y) => g.persona(x, y, "#3b5ca8"));
  // 8 Patriarchi: scala di Giacobbe, 12 figli
  out.push(`<g transform="translate(330,420) rotate(-25)"><rect x="-4" y="-25" width="8" height="50" fill="none" stroke="#c9a14a" stroke-width="1.4"/>${[-18,-9,0,9,18].map((y) => `<line x1="-4" y1="${y}" x2="4" y2="${y}" stroke="#c9a14a" stroke-width="1.2"/>`).join("")}</g>`);
  [[322,402],[338,436],[333,414]].forEach(([x, y]) => out.push(g.persona(x, y, "#ffffff")));
  for (let i = 0; i < 12; i++) { const a = i * 0.5236; out.push(g.persona(290 + Math.cos(a) * 12, 440 + Math.sin(a) * 9, "#7b4a2a")); }
  out.push(g.tenda(325, 412, 12));
  // 9 Egitto
  [[360,428,22],[372,450,16],[425,438,14]].forEach(([x, y, s]) => out.push(`<g transform="translate(${x},${y})"><rect x="${-s}" y="${-s}" width="${s*2}" height="${s*2}" fill="#e2c27c" stroke="#9c7b3a" stroke-width=".8"/><path d="M${-s},${-s}L${s},${s}M${s},${-s}L${-s},${s}" stroke="#b4914c" stroke-width=".8"/></g>`));
  [[418,392],[426,398],[420,404]].forEach(([x, y]) => out.push(`<circle cx="${x}" cy="${y}" r="4" fill="#d9b779" stroke="#8a6a32" stroke-width=".7"/>`));
  out.push(`<circle cx="408" cy="414" r="4" fill="#4a3a2a" stroke="#999" stroke-width="1.5"/>`);
  for (let i = 0; i < 9; i++) out.push(`<line x1="${352 + i * 10}" y1="${336 + (i % 2) * 3}" x2="${354 + i * 10}" y2="${330 + (i % 2) * 3}" stroke="#4f8a3a" stroke-width="1.4"/>`);
  // 10 Esodo: Mar Rosso aperto + roveto
  out.push(`<rect x="374" y="250" width="18" height="70" rx="5" fill="#3d86c6" opacity=".85"/><rect x="418" y="250" width="18" height="70" rx="5" fill="#3d86c6" opacity=".85"/>`);
  out.push(g.fuoco(392, 268, 4.5));
  lungo(10, -26, 26, 6.5, (x, y) => g.persona(x, y, "#9c6b3b"));
  // 11 Sinai
  out.push(`<rect x="396" y="140" width="4" height="6" rx="1.5" fill="#ddd" stroke="#555" stroke-width=".4"/><rect x="401" y="140" width="4" height="6" rx="1.5" fill="#ddd" stroke="#555" stroke-width=".4"/>`, g.persona(400, 152, "#7a3b2a"));
  out.push(`<rect x="408" y="160" width="30" height="16" fill="#f1ead8" stroke="#8a7b5a" stroke-width=".7"/><rect x="426" y="164" width="9" height="8" fill="#c9a14a"/>`);
  out.push(`<circle cx="372" cy="186" r="3" fill="#f5c84b" stroke="#a8781a"/>`);
  for (let i = 0; i < 8; i++) { const a = i * 0.785; out.push(g.persona(372 + Math.cos(a) * 9, 186 + Math.sin(a) * 9, "#8a6a4a")); }
  out.push(`<line x1="440" y1="128" x2="440" y2="140" stroke="#8a5a2a" stroke-width="1.2"/><path d="M437,130 q3,2 0,4 q-3,2 0,4" stroke="#b07a2a" stroke-width="1.3" fill="none"/>`);
  // 12 Gerico + Rut
  out.push(`<circle cx="480" cy="75" r="20" fill="#d8c8a8" stroke="#8a7b5a" stroke-width="4" stroke-dasharray="70 18 40 300"/>`);
  [[478,70],[486,80],[472,82]].forEach(([x, y]) => out.push(g.casa(x, y, 7)));
  for (let i = 0; i < 6; i++) out.push(`<line x1="${515 + i * 4}" y1="105" x2="${515 + i * 4}" y2="122" stroke="#d9b13a" stroke-width="2"/>`);
  out.push(g.persona(522, 112, "#7a4b8a"));
  // 13 Davide e Golia
  out.push(`<circle cx="485" cy="196" r="5" fill="#6d6d6d" stroke="#333" stroke-width=".8"/>`, g.persona(497, 186, "#c9853a"));
  for (let i = 0; i < 5; i++) { out.push(g.persona(470 + i * 6, 214, "#4a4a6a"), g.persona(476 + i * 6, 166, "#7a3b2a")); }
  out.push(g.tenda(512, 172, 16, "#b84a3a"));
  // 14 Tempio e Gerusalemme
  out.push(`<rect x="478" y="285" width="50" height="30" fill="#efe6cf" stroke="#a8781a" stroke-width="1"/><rect x="490" y="292" width="30" height="16" fill="#f6e7a8" stroke="#c9a14a" stroke-width=".8"/><circle cx="486" cy="296" r="1.6" fill="#c9a14a"/><circle cx="486" cy="304" r="1.6" fill="#c9a14a"/>`);
  out.push(`<path d="M462,268 L540,268 L540,334 L462,334Z" fill="none" stroke="#9b8b70" stroke-width="2.4" stroke-dasharray="20 5"/>`);
  // 15 Elia sul Carmelo + Giona
  out.push(`<rect x="476" y="398" width="13" height="10" fill="#8f877a" stroke="#555" stroke-width=".6"/>`, g.fuoco(482, 403, 4));
  for (let i = 0; i < 5; i++) out.push(g.persona(505 + i * 4, 430 - i * 2, "#5a3a6a"));
  out.push(`<ellipse cx="445" cy="474" rx="28" ry="15" fill="#3d86c6"/><ellipse cx="440" cy="476" rx="11" ry="4.5" fill="#4a5a6a"/><path d="M432,470 l6,0" stroke="#fff" stroke-width=".6"/>`);
  // 16 Deportazioni: porta di Babilonia, fossa dei leoni
  out.push(`<rect x="565" y="398" width="30" height="10" fill="#2f5fa8" stroke="#c9a14a" stroke-width="1"/><circle cx="615" cy="432" r="11" fill="#5a4636" stroke="#3a2a1a" stroke-width="1"/>`, g.persona(615, 432, "#2f5fa8"));
  [[608,426],[622,428],[610,440],[621,438]].forEach(([x, y]) => out.push(g.animale(x, y, "#d9a03a")));
  lungo(16, -58, -26, 6, (x, y) => g.persona(x, y, "#6a6a6a"));
  // 17 Neemia: mura in costruzione
  out.push(`<path d="M575,276 L625,276 L625,300" stroke="#b8a888" stroke-width="5" fill="none"/><path d="M625,300 L625,325" stroke="#b8a888" stroke-width="5" stroke-dasharray="4 4" fill="none"/>`);
  [[588,290],[600,318],[612,292]].forEach(([x, y]) => out.push(g.casa(x, y, 9)));
  [[632,282],[634,296],[630,310]].forEach(([x, y]) => out.push(g.persona(x, y, "#8a5a3a")));
  // 18 Betlemme
  out.push(`<rect x="585" y="186" width="30" height="20" fill="#8b6a45" stroke="#4a3520" stroke-width="1"/><rect x="595" y="192" width="10" height="8" fill="#f6e7b0"/>`, g.stella(604, 172, 7));
  [[574,214],[580,220],[628,212],[625,222]].forEach(([x, y]) => out.push(g.persona(x, y, "#6b5a3a")));
  for (let i = 0; i < 8; i++) out.push(g.pecora(570 + (i % 4) * 6, 165 + Math.floor(i / 4) * 5));
  lungo(18, -62, -36, 9, (x, y, s) => g.cammello(x + 6, y, 80) + g.persona(x - 5, y, ["#7a2a6a","#2a5a8a","#c9a14a"][Math.abs(s / 9) % 3 | 0]));
  // 19 Galilea, pani e pesci, ingresso a Gerusalemme
  out.push(`<ellipse cx="565" cy="45" rx="24" ry="16" fill="#3d86c6"/><path d="M558,42 q6,-4 12,0 l-2,4 l-8,0z" fill="#7a4b23"/>`);
  for (let i = 0; i < 10; i++) out.push(g.persona(612 + (i % 5) * 7, 102 + Math.floor(i / 5) * 7, "#9a7a5a"));
  [[640,64],[646,60],[652,66]].forEach(([x, y]) => out.push(`<circle cx="${x}" cy="${y}" r="2" fill="#c9953a" stroke="#6b4a1a" stroke-width=".4"/>`));
  lungo(19, 35, 85, 9, (x, y) => g.palma(x - 9, y) + g.persona(x + 8, y, "#3a7a5a"));
  // 20 Calvario e sepolcro
  [[708,105,6],[720,98,8],[732,105,6]].forEach(([x, y, s]) => out.push(`<path d="M${x},${y - s} L${x},${y + s} M${x - s * 0.6},${y - s * 0.3} L${x + s * 0.6},${y - s * 0.3}" stroke="#5b3518" stroke-width="2.2" stroke-linecap="round"/>`));
  out.push(`<rect x="742" y="128" width="20" height="15" rx="6" fill="#8f877a" stroke="#555" stroke-width=".8"/><rect x="747" y="132" width="8" height="7" rx="3" fill="#2a2a2a"/><circle cx="740" cy="148" r="6" fill="#a59d8f" stroke="#555" stroke-width=".8"/>`);
  out.push(g.persona(735, 132, "#ffffff"), g.persona(728, 140, "#5a4a8a"), g.persona(724, 134, "#8a3a4a"));
  // 21 Pentecoste
  out.push(`<rect x="700" y="210" width="30" height="25" fill="#e9dfcb" stroke="#6f6252" stroke-width="1"/>`);
  for (let i = 0; i < 13; i++) { const a = i * 0.483; out.push(g.persona(715 + Math.cos(a) * 9, 222 + Math.sin(a) * 7, "#7a5a3a"), `<circle cx="${f1(715 + Math.cos(a) * 9)}" cy="${f1(219 + Math.sin(a) * 7)}" r="1.2" fill="#ff8a1a"/>`); }
  // 22 Paolo: Damasco e Mediterraneo
  out.push(`<path d="M745,262 Q760,256 800,262 L800,385 Q770,392 748,378 Q738,320 745,262Z" fill="#2f74b5"/><path d="M766,322 L781,322 L778,328 L769,328Z" fill="#7a4b23"/><path d="M773,322 L773,312 L780,320Z" fill="#fff"/>`);
  out.push(`<path d="M672,300 L700,330" stroke="#fff3b0" stroke-width="6" opacity=".7"/>`, g.persona(700, 334, "#8a2a2a"), g.animale(708, 340, "#6b4a2b"));
  return out.join("");
}

function nuovaGerusalemme() {
  const { x, y, lato } = NJ, h = lato / 2;
  let s = `<rect x="${x - h}" y="${y - h}" width="${lato}" height="${lato}" fill="#fbf1c8" stroke="#d4a62a" stroke-width="3"/>`;
  s += `<rect x="${x - h + 8}" y="${y - h + 8}" width="${lato - 16}" height="${lato - 16}" fill="#fff9e3" stroke="#e8c45a" stroke-width="1"/>`;
  for (let i = 1; i <= 3; i++) { // 12 porte, 3 per lato
    const o = -h + (lato / 4) * i;
    s += `<rect x="${x + o - 3}" y="${y - h - 2}" width="6" height="4" fill="#f6d36a" stroke="#a8781a" stroke-width=".5"/>`;
    s += `<rect x="${x + o - 3}" y="${y + h - 2}" width="6" height="4" fill="#f6d36a" stroke="#a8781a" stroke-width=".5"/>`;
    s += `<rect x="${x - h - 2}" y="${y + o - 3}" width="4" height="6" fill="#f6d36a" stroke="#a8781a" stroke-width=".5"/>`;
    s += `<rect x="${x + h - 2}" y="${y + o - 3}" width="4" height="6" fill="#f6d36a" stroke="#a8781a" stroke-width=".5"/>`;
  }
  s += g.alberoVita(FOCE[0], FOCE[1]);
  [[752,452],[758,446],[760,458],[748,462],[765,410],[770,418],[703,465]].forEach(([a, b]) => s += g.persona(a, b, "#ffffff"));
  return s;
}

/* ---------------- riempimento "presepe napoletano" (fase 11) ---------------- */
function riempimento(campPerc, campFiume) {
  const r = rng(2024), out = [];
  const tiles = TAPPE.map((t) => [t.x, t.y]);
  const vietati = [[195,150,48],[305,82,26],[360,436,30],[NJ.x,NJ.y,52],[565,45,28],[770,322,32],[445,474,30],[495,302,34],[480,75,24],[405,285,34]];
  const vicino = (arr, x, y, d) => { const d2 = d * d; for (const p of arr) { const dx = p[0] - x, dy = p[1] - y; if (dx * dx + dy * dy < d2) return true; } return false; };
  const zonaDi = (x, y) => { for (const [k, p] of Object.entries(ZONE_POLY)) if (dentro(p, x, y)) return k; return "origini"; };
  const tipi = {
    origini: ["animale","animale","cespuglio","fiore","albero","animale","fiore","cespuglio"],
    patriarchi: ["pecora","pecora","cammello","tenda","palma","persona","capra","pecora"],
    re: ["casa","persona","ulivo","pecora","persona","casa","capra","cespuglio"],
    vangeli: ["persona","pecora","palma","pecora","persona","casa","ulivo","pecora"],
  };
  const pal = ["#8a3b2a","#3b5ca8","#6b8a2a","#a87a2a","#7a2a6a","#2a7a7a","#c9b07a"];
  let placed = 0, tries = 0;
  while (placed < 520 && tries < 9000) {
    tries++;
    const x = 8 + r() * (W - 16), y = 8 + r() * (H - 16);
    if (vicino(campPerc, x, y, 22) || vicino(campFiume, x, y, 9)) continue;
    if (tiles.some(([tx, ty]) => Math.abs(tx - x) < 40 && Math.abs(ty - y) < 40)) continue;
    if (vietati.some(([vx, vy, vr]) => (vx - x) ** 2 + (vy - y) ** 2 < vr * vr)) continue;
    const z = zonaDi(x, y), t = tipi[z][Math.floor(r() * 8)];
    if (t === "persona") out.push(g.persona(x, y, pal[Math.floor(r() * pal.length)]));
    else if (t === "animale") out.push(g.animale(x, y, ["#c8902f","#f4f1e6","#8b5a2b","#888","#d8c27a"][Math.floor(r() * 5)]));
    else if (t === "fiore") out.push(g.fiore(x, y, ["#f2c14e","#e86a8a","#ffffff","#b07ae0"][Math.floor(r() * 4)]));
    else if (t === "cammello") out.push(g.cammello(x, y, Math.floor(r() * 180)));
    else if (t === "tenda") out.push(g.tenda(x, y, 8 + r() * 4));
    else if (t === "casa") out.push(g.casa(x, y, 7 + r() * 4));
    else if (t === "pecora") { for (let k = 0; k < 3; k++) out.push(g.pecora(x + (r() - .5) * 9, y + (r() - .5) * 7)); }
    else out.push(g[t](x, y));
    placed++;
  }
  return out.join("");
}
function dentro(p, x, y) { // punto dentro poligono?
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  }
  return c;
}

/* ---------------- terreno nelle varie fasi ---------------- */
function terreno(stadio) {
  const col = {
    schiuma: { base: "#ead07c", liv: ["#efd88b", "#f3df9b", "#f6e5aa", "#f8ebb9", "#fbf0c8", "#fdf5d6"], bordo: "#c4a24a" },
    gesso:   { base: "#e7e4dd", liv: ["#ebe8e2", "#efede8", "#f3f1ed", "#f6f5f2", "#f9f8f6", "#fcfbfa"], bordo: "#c5c0b5" },
  }[stadio === "dipinto" ? "gesso" : stadio === "scavato" ? "schiuma" : stadio];
  let s = "";
  if (stadio === "dipinto") {
    s += `<g clip-path="url(#taglio)"><g filter="url(#sfuma)">`;
    for (const [k, p] of Object.entries(ZONE_POLY)) s += `<path d="${poly(p.map(([x, y]) => [x === 0 ? -60 : x === W ? W + 60 : x, y === 0 ? -60 : y === H ? H + 60 : y]))}" fill="${ZONE[k].colore}"/>`;
    s += `</g></g><rect width="${W}" height="${H}" fill="url(#grana)" opacity=".5"/>`;
  } else {
    s += `<rect width="${W}" height="${H}" fill="${col.base}"/><rect width="${W}" height="${H}" fill="url(#pori)" opacity=".6"/>`;
  }
  MONTI.forEach((m, i) => {
    for (let l = 0; l < m.liv; l++) {
      const k = 1 - l / (m.liv + 0.6);
      let fill, stroke;
      if (stadio === "dipinto") {
        const top = l === m.liv - 1;
        if (m.tipo === "neve" && top) fill = "#ffffff";
        else if (m.tipo === "neve") fill = ["#6f9a52","#7d8d63","#8e8a75","#a29d8f","#c2beb5","#fff"][l];
        else if (m.tipo === "roccia") fill = ["#c89b62","#b98a55","#a77a4b","#966c43"][l];
        else if (m.tipo === "verde") fill = ["#78b05a","#86bd66"][l];
        else fill = `rgba(255,255,255,${0.10 + l * 0.08})`;
        stroke = "rgba(60,40,20,.25)";
      } else { fill = col.liv[l]; stroke = col.bordo; }
      s += `<path d="${blob(m.x, m.y, m.rx * k, m.ry * k, i * 31 + l * 7)}" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`;
    }
  });
  // sentiero e fiume
  if (stadio === "scavato") {
    s += `<path d="${ROUTE_D}" stroke="#b39243" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${ROUTE_D}" stroke="#d9bc69" stroke-width="35" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += caselle("#e4c878", "#b39243");
    s += `<path d="${RIVER_D}" stroke="#5b4320" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    s += `<path d="${RIVER_D}" stroke="#3a2a12" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    SALTI.forEach(([x, y]) => s += `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#e05a2a" stroke-width="1.6" stroke-dasharray="3 2"/><text x="${x + 11}" y="${y - 8}" class="t-mini" fill="#a33">salto</text>`);
  } else if (stadio === "gesso") {
    s += `<path d="${ROUTE_D}" stroke="#d3cec4" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${ROUTE_D}" stroke="#ece9e3" stroke-width="35" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += caselle("#f2f0eb", "#cfc9bd");
    s += `<path d="${RIVER_D}" stroke="#2a2a2a" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  } else if (stadio === "dipinto") {
    s += `<path d="${ROUTE_D}" stroke="#a8875a" stroke-width="39" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`;
    s += `<path d="${ROUTE_D}" stroke="#e7d2a5" stroke-width="35" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${ROUTE_D}" stroke="#d6bd8a" stroke-width="35" fill="none" stroke-dasharray="1 6" stroke-linecap="round"/>`;
    s += caselle("#f1e3c2", "#a8875a");
    s += `<path d="${RIVER_D}" stroke="#4a5d3a" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    s += `<path d="${RIVER_D}" stroke="#1f3f66" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}
function caselle(fill, stroke) {
  return TAPPE.map((t) => `<rect x="${t.x - CASELLA / 2}" y="${t.y - CASELLA / 2}" width="${CASELLA}" height="${CASELLA}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`).join("");
}

/* ---------------- costruzione completa dell'SVG ---------------- */
function costruisciTabellone() {
  const cp = campiona(ROUTE_D, 1);
  const cf = campiona(RIVER_D, 3);
  const idx = {}; // posizione di ogni tappa lungo il sentiero (in mm)
  TAPPE.forEach((t) => { let best = 0, bd = 1e9; cp.forEach((p, i) => { const d = (p[0] - t.x) ** 2 + (p[1] - t.y) ** 2; if (d < bd) { bd = d; best = i; } }); idx[t.n] = best; });

  const L = []; // strati
  const strato = (id, from, until, html, extra = "") => L.push(`<g class="layer" id="ly-${id}" data-from="${from}" data-until="${until}" ${extra}>${html}</g>`);

  // 1 · Carta del progetto
  let carta = `<rect x="-14" y="-14" width="${W + 28}" height="${H + 28}" fill="#fbf8f0" stroke="#d8d0bd"/>`;
  for (let x = 0; x <= W; x += 100) carta += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#bcd2e6" stroke-width="${x % 200 ? .6 : 1}"/>`;
  for (let y = 0; y <= H; y += 100) carta += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#bcd2e6" stroke-width=".8"/>`;
  carta += `<rect width="${W}" height="${H}" fill="none" stroke="#33557a" stroke-width="2"/>`;
  for (let x = 0; x <= W; x += 100) carta += `<text x="${x}" y="-4" class="t-mini" text-anchor="middle" fill="#557">${x / 10} cm</text>`;
  for (let y = 100; y <= H; y += 100) carta += `<text x="-4" y="${y + 2}" class="t-mini" text-anchor="end" fill="#557">${y / 10}</text>`;
  strato("carta", 1, 1, carta);

  // 2 · Base in multistrato
  let base = `<rect width="${W}" height="${H}" fill="#d9b382"/><rect width="${W}" height="${H}" fill="url(#legno)"/>`;
  base += `<rect width="${W}" height="${H}" fill="none" stroke="#8a6238" stroke-width="3"/>`;
  strato("base", 2, 99, base);
  // listelli sotto (si vedono tratteggiati)
  strato("listelli", 2, 2, `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="#6b4a26" stroke-width="30" stroke-dasharray="6 5" opacity=".35"/><text x="400" y="494" class="t-mini" text-anchor="middle" fill="#4a3216">listelli 30 x 60 mm sotto la base</text>`);

  // Disegno a matita (fasi 1-3)
  let matita = `<path d="${ROUTE_D}" stroke="#555" stroke-width="35" fill="none" opacity=".10" stroke-linecap="round" stroke-linejoin="round"/>`;
  matita += `<path d="${ROUTE_D}" stroke="#444" stroke-width="1.2" fill="none" stroke-dasharray="6 4"/>`;
  matita += TAPPE.map((t) => `<rect x="${t.x - 37.5}" y="${t.y - 37.5}" width="75" height="75" rx="6" fill="none" stroke="#444" stroke-width="1"/>`).join("");
  matita += `<path d="${RIVER_D}" stroke="#1f5fbf" stroke-width="2" fill="none"/>`;
  matita += MONTI.map((m, i) => `<path d="${blob(m.x, m.y, m.rx, m.ry, i * 31)}" fill="none" stroke="#7a6a5a" stroke-width=".8" stroke-dasharray="2 3"/>`).join("");
  matita += PONTI.map(([x, y]) => `<rect x="${x - 6}" y="${y - 4}" width="12" height="8" fill="none" stroke="#c03" stroke-width="1"/>`).join("");
  strato("matita", 1, 3, matita);

  // 3 · Sotto la base: vaschetta, tubo, fori, passacavi
  let sotto = `<path d="M${NJ.x - 60},${NJ.y} L${NJ.x - 60},475 L${SORGENTE[0]},475 L${SORGENTE[0]},${SORGENTE[1]}" stroke="#2a8ad6" stroke-width="3" fill="none" stroke-dasharray="7 4"/>`;
  sotto += `<rect x="${NJ.x - 60}" y="${NJ.y - 40}" width="120" height="80" fill="#9fd3ff" fill-opacity=".45" stroke="#1a5f9a" stroke-width="2" stroke-dasharray="5 3"/>`;
  sotto += `<rect x="${NJ.x - 40}" y="${NJ.y - 30}" width="80" height="60" fill="#1d1a16" opacity=".75"/><text x="${NJ.x}" y="${NJ.y + 22}" class="t-mini" text-anchor="middle" fill="#fff">foro 8 x 6</text>`;
  sotto += `<rect x="${NJ.x - 18}" y="${NJ.y - 8}" width="22" height="16" rx="3" fill="#333"/><text x="${NJ.x}" y="${NJ.y - 22}" class="t-mini" text-anchor="middle" fill="#0d3c63">vaschetta + pompa</text>`;
  sotto += `<circle cx="${SORGENTE[0]}" cy="${SORGENTE[1]}" r="5" fill="#111" stroke="#2a8ad6" stroke-width="2"/><text x="${SORGENTE[0] + 9}" y="${SORGENTE[1] - 7}" class="t-mini" fill="#0d3c63">foro sorgente Ø 8-10</text>`;
  sotto += LUCI.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="3" fill="#111" stroke="#e0a000" stroke-width="1.2"/>`).join("");
  sotto += `<text x="300" y="470" class="t-mini" fill="#0d3c63">tubo in silicone Ø 6-8 mm (sotto la base)</text>`;
  sotto += `<path d="M${NJ.x + 4},${NJ.y} L790,${NJ.y} L790,${ALIMENTATORE[1]} L${ALIMENTATORE[0] - 16},${ALIMENTATORE[1]}" stroke="#222" stroke-width="1.6" fill="none" stroke-dasharray="4 3"/>`;
  strato("sotto", 3, 3, sotto, 'data-sotto="1"');

  // Alimentatore fuori dalla base
  strato("alim", 3, 99, `<rect x="${ALIMENTATORE[0] - 16}" y="${ALIMENTATORE[1] - 14}" width="32" height="28" rx="4" fill="#2b2f36" stroke="#000"/><text x="${ALIMENTATORE[0]}" y="${ALIMENTATORE[1] + 4}" class="t-mini" fill="#ffd34d" text-anchor="middle">12 V</text><text x="${ALIMENTATORE[0]}" y="${ALIMENTATORE[1] + 24}" class="t-mini" fill="#555" text-anchor="middle">fuori base</text>`);

  // 4-8 · Terreno
  strato("schiuma", 4, 4, terreno("schiuma"));
  strato("scavo", 5, 5, terreno("scavato"));
  strato("gesso", 6, 7, terreno("gesso"));
  strato("colore", 8, 99, terreno("dipinto"));

  // 7 · Acqua vera che scorre
  strato("acqua", 7, 99, `<path d="${RIVER_D}" stroke="#4fb3ff" stroke-width="6.5" fill="none" stroke-linecap="round"/><path d="${RIVER_D}" class="scorre" stroke="#e8f7ff" stroke-width="2" fill="none" stroke-dasharray="4 12" stroke-linecap="round"/><circle cx="${SORGENTE[0]}" cy="${SORGENTE[1]}" r="5" fill="#9fdcff"/>`);

  // 9 · Cavi sotto (si vedono solo in fase 9 o con "vedi sotto")
  let cavi = LUCI.map((l) => `<path d="M${l.x},${l.y} L${l.x},488 L790,488" stroke="#e0a000" stroke-width="1.1" fill="none" stroke-dasharray="3 3"/>`).join("");
  cavi += `<path d="M790,488 L${ALIMENTATORE[0] - 16},${ALIMENTATORE[1]}" stroke="#e0a000" stroke-width="2" fill="none"/>`;
  strato("cavi", 9, 9, cavi, 'data-sotto="1"');

  // 10 · Scene in 3D
  strato("scene", 10, 99, scene(cp, idx) + nuovaGerusalemme() + PONTI.map(([x, y]) => `<rect x="${x - 10}" y="${y - 7}" width="20" height="14" rx="2" fill="#8a5a2b" stroke="#4a2e12" stroke-width="1"/><line x1="${x - 10}" y1="${y - 4}" x2="${x + 10}" y2="${y - 4}" stroke="#5b3a1a" stroke-width=".7"/><line x1="${x - 10}" y1="${y + 4}" x2="${x + 10}" y2="${y + 4}" stroke="#5b3a1a" stroke-width=".7"/>`).join(""));

  // 11 · Riempimento
  strato("pieno", 11, 99, riempimento(cp, cf));

  // 12 · Targhette
  strato("targhe", 12, 99, TAPPE.map((t) => {
    const w = 34, sx = t.x > 680 ? t.x - 37 - w - 2 : t.x + 39;
    const yy = t.n === 23 ? t.y - 60 : t.y - 6;
    const xx = t.n === 23 ? t.x - 40 : sx;
    return `<g class="targa"><rect x="${xx}" y="${yy}" width="${w}" height="12" rx="2" fill="#fffaf0" stroke="#7a5a2a" stroke-width=".6"/><text x="${xx + 2.5}" y="${yy + 5.2}" class="t-targa-n">${t.n}</text><text x="${xx + 9}" y="${yy + 5.2}" class="t-targa">${ETICHETTE[t.n]}</text><text x="${xx + 9}" y="${yy + 10}" class="t-targa-r">${t.rif.split(";")[0]}</text></g>`;
  }).join(""));

  // Notte (velo scuro) e luci
  strato("notte", 9, 99, `<rect x="-40" y="-60" width="${W + 120}" height="${H + 100}" fill="#081030" opacity=".62"/>`, 'data-notte="1"');
  let luci = LUCI.map((l) => {
    const c = { calda: "#ffd27a", fuoco: "#ff8a1a", fredda: "#e8f4ff", stella: "#fff2a8" }[l.t];
    return `<circle cx="${l.x}" cy="${l.y}" r="14" fill="url(#alone-${l.t})" class="${l.t === "fuoco" ? "tremola" : ""}"/><circle cx="${l.x}" cy="${l.y}" r="2.6" fill="${c}" stroke="#fff" stroke-width=".6"/>`;
  }).join("");
  luci += `<rect x="${NJ.x - 47}" y="${NJ.y - 47}" width="94" height="94" fill="none" stroke="#fff4c2" stroke-width="3" class="striscia"/><rect x="${NJ.x - 47}" y="${NJ.y - 47}" width="94" height="94" fill="url(#alone-calda)" opacity=".5"/>`;
  strato("luci", 9, 99, luci);

  // 13 · Sfondo facoltativo
  let sf = `<rect x="-26" y="-52" width="${W + 52}" height="42" fill="url(#cielo)" stroke="#2a2a40" stroke-width="1.5"/>`;
  sf += `<rect x="-26" y="-10" width="16" height="${H + 10}" fill="url(#cieloL)" stroke="#2a2a40"/><rect x="${W + 10}" y="-10" width="16" height="${H + 10}" fill="url(#cieloR)" stroke="#2a2a40"/>`;
  const rs = rng(7);
  for (let i = 0; i < 90; i++) sf += `<circle cx="${f1(-20 + rs() * (W + 40))}" cy="${f1(-48 + rs() * 34)}" r="${f1(.4 + rs() * 1.1)}" fill="#fff" opacity="${f1(.5 + rs() * .5)}"/>`;
  sf += `<text x="400" y="-26" class="t-mini" text-anchor="middle" fill="#fff">sfondo dipinto (pannello posteriore 80 x 30 cm)</text>`;
  strato("sfondo", 13, 99, sf);

  // Numeri delle tappe (guida, non si costruisce) + zone cliccabili
  const numeri = TAPPE.map((t) => `<g class="num"><circle cx="${t.x - 28}" cy="${t.y - 28}" r="7" fill="${ZONE[t.zona].colore}" stroke="#3a2a1a" stroke-width="1"/><text x="${t.x - 28}" y="${t.y - 25.4}" text-anchor="middle" class="t-num">${t.n}</text></g>`).join("");
  const click = TAPPE.map((t) => `<rect class="hit" data-n="${t.n}" x="${t.x - 37.5}" y="${t.y - 37.5}" width="75" height="75" rx="9" tabindex="0" role="button" aria-label="Tappa ${t.n}: ${t.nome}"><title>${t.n}. ${t.nome}</title></rect>`).join("");

  const defs = `<defs>
    <pattern id="legno" width="800" height="24" patternUnits="userSpaceOnUse"><path d="M0,6 Q200,2 400,7 T800,5 M0,17 Q220,21 420,15 T800,18" stroke="#b88a57" stroke-width="1.2" fill="none" opacity=".6"/></pattern>
    <pattern id="pori" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1.2" fill="#c9ab55" opacity=".5"/><circle cx="10" cy="10" r=".9" fill="#c9ab55" opacity=".5"/></pattern>
    <pattern id="grana" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".7" fill="#000" opacity=".12"/><circle cx="7" cy="7" r=".6" fill="#fff" opacity=".25"/></pattern>
    <clipPath id="taglio"><rect width="800" height="500"/></clipPath>
    <filter id="sfuma" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="14"/></filter>
    <radialGradient id="alone-calda"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <radialGradient id="alone-fuoco"><stop offset="0" stop-color="#ff7a10" stop-opacity=".95"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient>
    <radialGradient id="alone-fredda"><stop offset="0" stop-color="#e8f4ff" stop-opacity=".9"/><stop offset="1" stop-color="#e8f4ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="alone-stella"><stop offset="0" stop-color="#fff6c0" stop-opacity="1"/><stop offset="1" stop-color="#fff6c0" stop-opacity="0"/></radialGradient>
    <linearGradient id="cielo" x1="0" x2="1"><stop offset="0" stop-color="#f3b07a"/><stop offset=".18" stop-color="#5a7fc0"/><stop offset=".5" stop-color="#0d1640"/><stop offset=".82" stop-color="#1d2a6a"/><stop offset="1" stop-color="#f6d77a"/></linearGradient>
    <linearGradient id="cieloL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3b07a"/><stop offset="1" stop-color="#5a7fc0"/></linearGradient>
    <linearGradient id="cieloR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a6a"/><stop offset="1" stop-color="#f6d77a"/></linearGradient>
  </defs>`;

  return `<svg id="tabellone" viewBox="-40 -60 920 580" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vista dall'alto del diorama">
    ${defs}
    <g id="mondo">${L.join("")}</g>
    <g id="ly-numeri" class="guida">${numeri}</g>
    <g id="ly-click">${click}</g>
    <g class="guida scala"><line x1="0" y1="512" x2="100" y2="512" stroke="#555" stroke-width="2"/><line x1="0" y1="507" x2="0" y2="517" stroke="#555" stroke-width="2"/><line x1="100" y1="507" x2="100" y2="517" stroke="#555" stroke-width="2"/><text x="108" y="515" class="t-mini" fill="#555">10 cm</text><text x="800" y="515" class="t-mini" text-anchor="end" fill="#555">tabellone 80 x 50 cm · vista dall'alto</text></g>
  </svg>`;
}
