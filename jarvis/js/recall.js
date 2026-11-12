// Memoria "al volo": sceglie i ricordi che c'entrano con quello che si sta dicendo,
// invece di rileggere tutto a ogni domanda (prompt più leggero = risposte più rapide).
import { store } from './store.js';

const STOP = new Set(['della', 'delle', 'dello', 'degli', 'dalla', 'nella', 'nelle', 'sulla', 'questo', 'questa', 'quello', 'quella',
  'sono', 'siamo', 'avere', 'essere', 'come', 'cosa', 'quando', 'dove', 'perché', 'perche', 'anche', 'ancora', 'molto', 'tutto', 'tutti',
  'signore', 'jarvis', 'fare', 'fatto', 'dimmi', 'vorrei', 'voglio', 'puoi', 'potresti', 'allora', 'quindi', 'adesso', 'oggi', 'ieri']);

// Parole chiave di un testo: minuscole, senza accenti, tagliate a 6 lettere (così "giochi" trova "gioco").
export function keys(text) {
  const out = new Set();
  const words = String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g) || [];
  for (const w of words) if (!STOP.has(w)) out.add(w.slice(0, 5));
  return out;
}

function score(queryKeys, text) {
  if (!queryKeys.size) return 0;
  let n = 0;
  for (const k of keys(text)) if (queryKeys.has(k)) n++;
  return n;
}

// Ricordi da mettere nel contesto: i fondamentali, i più recenti e quelli pertinenti alla frase.
export function pickMemories(query, all = store.get('memories', [])) {
  if (all.length <= 40) return all;
  const q = keys(query);
  const chosen = new Set();
  all.slice(0, 12).forEach((_, i) => chosen.add(i));                       // chi è il Signore
  for (let i = Math.max(0, all.length - 12); i < all.length; i++) chosen.add(i); // imparati da poco
  all.map((m, i) => ({ i, s: score(q, m) })).filter((x) => x.s > 0 && !chosen.has(x.i))
    .sort((a, b) => b.s - a.s).slice(0, 16).forEach((x) => chosen.add(x.i));
  return [...chosen].sort((a, b) => a - b).map((i) => all[i]);
}

// Diario: le ultime pagine, più quelle vecchie che parlano dello stesso argomento.
export function pickDiary(query, all = store.get('diary', [])) {
  const recent = all.slice(-4);
  const older = all.slice(0, -4);
  const q = keys(query);
  const related = older.map((d, i) => ({ d, i, s: score(q, d.text) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s).slice(0, 3).sort((a, b) => a.i - b.i).map((x) => x.d);
  return [...related, ...recent];
}

// Ricerca esplicita in tutta la memoria (strumento cerca_nei_ricordi).
export function searchEverything(query, history = [], summary = '') {
  const q = keys(query);
  const hits = [];
  const add = (dove, testo, bonus = 0) => { const s = score(q, testo); if (s > 0) hits.push({ dove, testo: String(testo).slice(0, 400), s: s + bonus }); };
  store.get('memories', []).forEach((m) => add('ricordo', m, 0.5));
  store.get('diary', []).forEach((d) => add(`diario del ${d.date}`, d.text, 0.3));
  Object.entries(store.get('boards', {})).forEach(([tema, idee]) => idee.forEach((i) => add(`idea del brainstorming «${tema}»`, i)));
  Object.entries(store.get('lists', {})).forEach(([nome, voci]) => add(`lista «${nome}»`, voci.join(', ')));
  if (summary) add('riassunto delle conversazioni passate', summary);
  history.forEach((m) => {
    const t = m.parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join(' ');
    if (t) add(m.role === 'user' ? 'il Signore ha detto' : 'io ho detto', t);
  });
  return hits.sort((a, b) => b.s - a.s).slice(0, 8).map(({ dove, testo }) => ({ dove, testo }));
}
