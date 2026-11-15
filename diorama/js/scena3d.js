/* =========================================================
   DIORAMA IN 3D (Three.js)
   Tutte le misure sono in MILLIMETRI, come nel disegno 2D:
   X = da sinistra a destra (0..800), Z = dal fondo al davanti (0..500),
   Y = altezza sopra la base. Una persona è alta 10 mm.
   ========================================================= */
(function () {
  const wrap = document.getElementById("vista3d");
  if (!wrap) return;
  if (!window.THREE || !THREE.OrbitControls) { window.Scena3D = null; return; }
  const T = THREE;

  /* ---------------- utilità ---------------- */
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const nz = (x, y) => Math.sin(x * 0.031 + 1.3) * Math.cos(y * 0.027 + 0.7) * 0.5 + Math.sin(x * 0.083 + y * 0.061) * 0.3 + Math.sin(x * 0.17 - y * 0.13 + 2) * 0.2;
  const V = (x, y, h) => new T.Vector3(x - 400, h, y - 250);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const rimbalzo = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
  const R = rng(99);

  /* ---------------- renderer, camera, controlli ---------------- */
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  wrap.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color("#bcd6ee");
  scene.fog = new T.Fog("#bcd6ee", 2200, 5200);
  const camera = new T.PerspectiveCamera(38, 1.6, 5, 9000);
  camera.position.set(0, 560, 660);
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 20, 30);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 35; controls.maxDistance = 2600;
  controls.screenSpacePanning = true;

  const hemi = new T.HemisphereLight("#dfeeff", "#8a7a5a", 0.5); scene.add(hemi);
  const amb = new T.AmbientLight("#ffffff", 0.06); scene.add(amb);
  const sole = new T.DirectionalLight("#fff3dc", 0.72);
  sole.position.set(-420, 900, 520); sole.castShadow = true;
  sole.shadow.mapSize.set(2048, 2048);
  Object.assign(sole.shadow.camera, { left: -560, right: 560, top: 460, bottom: -460, near: 100, far: 2600 });
  sole.shadow.camera.updateProjectionMatrix(); sole.shadow.bias = -0.0006; sole.shadow.normalBias = 0.6;
  scene.add(sole, sole.target);

  // Tavolo su cui appoggia tutto
  const tavolo = new T.Mesh(new T.PlaneGeometry(5000, 5000), new T.MeshStandardMaterial({ color: "#c9b79c", roughness: 0.95 }));
  tavolo.rotation.x = -Math.PI / 2; tavolo.position.y = -75; tavolo.receiveShadow = true; scene.add(tavolo);

  /* ---------------- materiali per fase (servono per evidenziare le novità) ---------------- */
  let FASE_MAT = 10;
  const mats = [], matCache = {}, geoCache = {};
  function M(color, o = {}) {
    const k = FASE_MAT + "|" + color + "|" + JSON.stringify(o, (kk, v) => (v && v.isTexture ? v.uuid : v));
    if (!matCache[k]) {
      const oo = Object.assign({ color, roughness: 0.85, metalness: 0 }, o); if (oo.metalness > 0.15) { oo.metalness = 0.15; oo.roughness = Math.max(oo.roughness, 0.45); }
      const m = new T.MeshStandardMaterial(oo);
      m.userData = { fase: FASE_MAT, em0: m.emissive.clone(), op0: m.opacity, tr0: m.transparent, dw0: m.depthWrite };
      matCache[k] = m; mats.push(m);
    }
    return matCache[k];
  }
  function regMat(m, fase) { m.userData = { fase, em0: m.emissive ? m.emissive.clone() : null, op0: m.opacity, tr0: m.transparent, dw0: m.depthWrite }; mats.push(m); return m; }
  const geo = (k, fn) => geoCache[k] || (geoCache[k] = fn());
  const GB = (w, h, d) => geo(`b${w}|${h}|${d}`, () => new T.BoxGeometry(w, h, d));
  const GC = (rt, rb, h, s = 10) => geo(`c${rt}|${rb}|${h}|${s}`, () => new T.CylinderGeometry(rt, rb, h, s));
  const GS = (r, w = 10, h = 8) => geo(`s${r}|${w}|${h}`, () => new T.SphereGeometry(r, w, h));
  const GK = (r, h, s = 8) => geo(`k${r}|${h}|${s}`, () => new T.ConeGeometry(r, h, s));
  function mesh(g, m, x = 0, y = 0, z = 0, ombra = true) {
    const o = new T.Mesh(g, m); o.position.set(x, y, z);
    o.castShadow = ombra; o.receiveShadow = true; return o;
  }

  /* ---------------- gruppi per categoria (servono per la vista "esploso") ---------------- */
  const CAT = {};
  ["sotto", "base", "terreno", "scene", "pieno", "luci", "targhe", "sfondo", "carta"].forEach((k) => { CAT[k] = new T.Group(); scene.add(CAT[k]); });
  const ESPLOSO = { sotto: -150, base: -75, terreno: 0, scene: 110, pieno: 110, luci: 110, targhe: 110, sfondo: 0, carta: 0 };
  const pezzi = []; // {obj, from, until, cat, anim}
  function reg(obj, from, until, cat, anim = "cade") { CAT[cat].add(obj); pezzi.push({ obj, from, until, cat, anim, y0: obj.position.y }); return obj; }

  /* =========================================================
     TERRENO: altezze calcolate dai monti, caselle spianate,
     sentiero e fiume scavati, fiume sempre in discesa.
     ========================================================= */
  const MONTI3D = [
    { x: 100, y: 228, rx: 76, ry: 92, h: 55, f: "altopiano" },
    { x: 197, y: 182, rx: 76, ry: 148, h: 138, f: "picco" },
    { x: 292, y: 96, rx: 44, ry: 38, h: 22, f: "collina" },
    { x: 405, y: 150, rx: 54, ry: 76, h: 92, f: "picco" },
    { x: 490, y: 190, rx: 46, ry: 42, h: 28, f: "collina" },
    { x: 503, y: 300, rx: 48, ry: 44, h: 34, f: "collina" },
    { x: 490, y: 415, rx: 46, ry: 38, h: 30, f: "collina" },
    { x: 600, y: 190, rx: 44, ry: 44, h: 18, f: "collina" },
    { x: 720, y: 115, rx: 48, ry: 48, h: 30, f: "collina" },
    { x: 30, y: 470, rx: 45, ry: 40, h: 16, f: "collina" },
    { x: 775, y: 30, rx: 40, ry: 40, h: 26, f: "collina" },
    { x: 250, y: 250, rx: 16, ry: 60, h: 14, f: "collina" },
  ];
  const MED = [[745, 262], [760, 257], [790, 258], [806, 262], [806, 385], [790, 389], [770, 390], [748, 378], [741, 345], [740, 300]];
  const LAGHI = [{ x: 565, y: 45, rx: 26, ry: 18 }, { x: 445, y: 474, rx: 30, ry: 16 }];

  function hNat(x, y) {
    let h = 12 + 2.5 * nz(x, y);
    for (const m of MONTI3D) {
      const dx = (x - m.x) / m.rx, dy = (y - m.y) / m.ry, a = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy) / (1 + 0.09 * Math.sin(3 * a + m.x) + 0.05 * Math.sin(5 * a + m.y));
      if (r < 1) {
        const t = 1 - r;
        const v = m.f === "altopiano" ? m.h * sstep(0, 0.4, t) : m.f === "picco" ? m.h * Math.pow(t, 1.15) * (0.93 + 0.07 * nz(x * 2.3, y * 2.3)) : m.h * sstep(0, 1, t);
        h = Math.max(h, v);
      }
    }
    for (const L of LAGHI) { const e = ((x - L.x) / L.rx) ** 2 + ((y - L.y) / L.ry) ** 2; if (e < 1.4) h = lerp(h, 2, sstep(1.4, 0.95, e)); }
    if (x > 730) { let w = dentro(MED, x, y) ? 1 : 0; if (!w) { let best = 1e9; for (const p of MED) best = Math.min(best, Math.hypot(p[0] - x, p[1] - y)); w = 1 - sstep(0, 14, best) ; w *= 0.6; } h = lerp(h, 2, w); }
    const ex = Math.max(Math.abs(x - NJ.x) - 47, 0), ey = Math.max(Math.abs(y - NJ.y) - 47, 0);
    h = lerp(h, 10, 1 - sstep(0, 26, Math.hypot(ex, ey)));
    return h;
  }
  const HC = {}; TAPPE.forEach((t) => (HC[t.n] = t.n === 23 ? 10 : hNat(t.x, t.y)));
  function hRaw(x, y) {
    let h = hNat(x, y);
    for (const t of TAPPE) {
      const ex = Math.max(0, Math.abs(x - t.x) - 37.5), ey = Math.max(0, Math.abs(y - t.y) - 37.5);
      const d = Math.hypot(ex, ey);
      if (d < 12) h = lerp(h, HC[t.n], 1 - sstep(0, 12, d));
    }
    return h;
  }

  // Campioni del sentiero e del fiume
  const CP = campiona(ROUTE_D, 1);
  const CP4 = CP.filter((_, i) => i % 4 === 0);
  const CR = campiona(RIVER_D, 2);
  const IDX = {}; TAPPE.forEach((t) => { let b = 0, bd = 1e9; CP.forEach((p, i) => { const d = (p[0] - t.x) ** 2 + (p[1] - t.y) ** 2; if (d < bd) { bd = d; b = i; } }); IDX[t.n] = b; });
  // Livello dell'acqua: sempre in discesa (almeno 1 mm ogni 25 mm)
  const LIV = []; CR.forEach((p, i) => { const tgt = hRaw(p[0], p[1]) - 3.5; LIV.push(i === 0 ? hRaw(p[0], p[1]) - 2 : Math.max(Math.min(5.5, LIV[i - 1]), Math.min(LIV[i - 1] - 0.012, tgt))); });
  // Salti (cascatelle)
  const SALTI3D = []; for (let i = 6; i < CR.length; i++) if (LIV[i - 6] - LIV[i] > 5 && (!SALTI3D.length || i - SALTI3D[SALTI3D.length - 1] > 15)) SALTI3D.push(i);

  const NX = 161, NY = 101, ST = 5;
  const HRAW = new Float32Array(NX * NY), HCAR = new Float32Array(NX * NY), DP = new Float32Array(NX * NY), DR = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = i * ST, y = j * ST, k = j * NX + i;
    let h = hRaw(x, y); HRAW[k] = h;
    let dp = 1e9; for (const p of CP4) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < dp) dp = d; } dp = Math.sqrt(dp);
    let dr = 1e9, kr = 0; for (let q = 0; q < CR.length; q += 2) { const p = CR[q], d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < dr) { dr = d; kr = q; } } dr = Math.sqrt(dr);
    DP[k] = dp; DR[k] = dr;
    if (dp < 19) h -= 3 * (1 - sstep(14, 19, dp));
    if (dr < 16) h = Math.min(h, LIV[kr] - 4 + Math.max(0, dr - 5) * 1.4);
    HCAR[k] = h;
  }
  function campH(arr, x, y) {
    const fx = Math.min(NX - 1.001, Math.max(0, x / ST)), fy = Math.min(NY - 1.001, Math.max(0, y / ST));
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * NX + i;
    return lerp(lerp(arr[k], arr[k + 1], u), lerp(arr[k + NX], arr[k + NX + 1], u), v);
  }
  const hAt = (x, y) => campH(HCAR, x, y);

  // Geometria del terreno
  const tGeo = new T.BufferGeometry();
  const tPos = new Float32Array(NX * NY * 3), tCol = new Float32Array(NX * NY * 3);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; tPos[k * 3] = i * ST - 400; tPos[k * 3 + 1] = HRAW[k]; tPos[k * 3 + 2] = j * ST - 250; }
  const idx = []; for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx.push(a, c, b, b, c, d); }
  tGeo.setIndex(idx); tGeo.setAttribute("position", new T.BufferAttribute(tPos, 3)); tGeo.setAttribute("color", new T.BufferAttribute(tCol, 3));
  const tMat = regMat(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 4);
  const terreno = new T.Mesh(tGeo, tMat); terreno.receiveShadow = true; terreno.castShadow = true;
  // Bordo (fianchi della schiuma)
  const bordoIdx = []; for (let i = 0; i < NX; i++) bordoIdx.push(i); for (let j = 1; j < NY; j++) bordoIdx.push(j * NX + NX - 1); for (let i = NX - 2; i >= 0; i--) bordoIdx.push((NY - 1) * NX + i); for (let j = NY - 2; j > 0; j--) bordoIdx.push(j * NX);
  bordoIdx.push(0);
  const sGeo = new T.BufferGeometry(), sPos = new Float32Array(bordoIdx.length * 6); const sI = [];
  bordoIdx.forEach((k, n) => { if (n < bordoIdx.length - 1) { const a = n * 2; sI.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  sGeo.setIndex(sI); sGeo.setAttribute("position", new T.BufferAttribute(sPos, 3));
  const sMat = regMat(new T.MeshStandardMaterial({ color: "#e9cf7a", roughness: 1, side: T.DoubleSide }), 4);
  const fianco = new T.Mesh(sGeo, sMat); fianco.receiveShadow = true;
  const gTerreno = new T.Group(); gTerreno.add(terreno, fianco);

  function applicaAltezze(H) {
    for (let k = 0; k < NX * NY; k++) tPos[k * 3 + 1] = H[k];
    tGeo.attributes.position.needsUpdate = true; tGeo.computeVertexNormals(); tGeo.computeBoundingSphere();
    bordoIdx.forEach((k, n) => { sPos.set([tPos[k * 3], tPos[k * 3 + 1], tPos[k * 3 + 2], tPos[k * 3], 0, tPos[k * 3 + 2]], n * 6); });
    sGeo.attributes.position.needsUpdate = true; sGeo.computeVertexNormals(); sGeo.computeBoundingSphere();
  }

  // Colori del terreno nelle varie fasi
  const C = (h) => new T.Color(h);
  const ZC = {}; Object.keys(ZONE).forEach((k) => (ZC[k] = C(ZONE[k].colore)));
  ZC.origini = C("#6fa04f"); ZC.patriarchi = C("#d6b06a"); ZC.re = C("#b3a58c"); ZC.vangeli = C("#ece2cc");
  function zonaCol(x, y) {
    const out = new T.Color(0, 0, 0); let n = 0;
    for (let a = -36; a <= 36; a += 36) for (let b = -36; b <= 36; b += 36) {
      let z = "origini"; for (const [k, p] of Object.entries(ZONE_POLY)) if (dentro(p, x + a, y + b)) { z = k; break; }
      out.add(ZC[z]); n++;
    }
    return out.multiplyScalar(1 / n);
  }
  function inCasella(x, y) { for (const t of TAPPE) { const dx = Math.abs(x - t.x), dy = Math.abs(y - t.y); if (dx < 37.5 && dy < 37.5) return Math.max(dx, dy); } return -1; }
  function coloriStadio(st) {
    const out = new Float32Array(NX * NY * 3), H = st === "schiuma" ? HRAW : HCAR, c = new T.Color();
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, x = i * ST, y = j * ST, h = H[k], n = nz(x * 3.1, y * 2.7);
      const sl = Math.hypot(campH(H, x + 3, y) - campH(H, x - 3, y), campH(H, x, y + 3) - campH(H, x, y - 3)) / 6;
      const cas = inCasella(x, y), dp = DP[k], dr = DR[k];
      if (st === "schiuma" || st === "scavato") {
        c.set("#e9cf7a").multiplyScalar(0.94 + 0.06 * n);
        if (st === "scavato") { if (cas >= 0) c.set("#f0da92"); if (dp < 17) c.lerp(C("#cfac57"), 0.8); if (dr < 7) c.set("#76552a"); }
      } else if (st === "gesso") {
        c.set("#ecebe5").multiplyScalar(0.95 + 0.05 * n);
        if (cas >= 0) c.set("#f6f5f1"); if (dp < 17) c.lerp(C("#dedad0"), 0.8); if (dr < 7.5) c.set("#1d1d1f");
      } else {
        c.copy(zonaCol(x, y)).multiplyScalar(0.9 + 0.12 * n);
        if (Math.hypot((x - 100) / 76, (y - 228) / 92) < 0.95) c.lerp(C("#5e9c43"), 0.6);
        c.lerp(C("#8d8473"), sstep(35, 95, h) * 0.75);
        if (Math.hypot((x - 405) / 54, (y - 150) / 76) < 1) c.lerp(C("#a0704a"), sstep(20, 70, h) * 0.8);
        if (Math.hypot((x - 197) / 76, (y - 182) / 148) < 1) c.lerp(C("#ffffff"), sstep(102, 122, h));
        c.multiplyScalar(1 - Math.min(0.3, sl * 0.25));
        if (dp < 18) c.lerp(dp > 15.5 ? C("#8c7048") : C("#cfb486"), 1 - sstep(16, 18.5, dp) * 0.4);
        if (cas >= 0) c.copy(cas > 34 ? C("#9c7a4c") : C("#dcc596")).multiplyScalar(0.95 + 0.05 * n);
        if (dr < 6.5) c.set("#1f4352"); else if (dr < 9) c.lerp(C("#566b3a"), 0.6);
        if (h < 4.5) c.lerp(C("#2f5e78"), 0.8);
        if (Math.abs(x - NJ.x) < 45 && Math.abs(y - NJ.y) < 45) c.set("#f5e9c6");
      }
      out[k * 3] = c.r; out[k * 3 + 1] = c.g; out[k * 3 + 2] = c.b;
    }
    return out;
  }
  const COLORI = { schiuma: coloriStadio("schiuma"), scavato: coloriStadio("scavato"), gesso: coloriStadio("gesso"), dipinto: coloriStadio("dipinto") };
  const FIANCO = { schiuma: "#e9cf7a", scavato: "#e9cf7a", gesso: "#ecebe5", dipinto: "#6e5538" };
  let statoTerreno = null, animColori = null, animAltezze = null;
  function impostaTerreno(st, anima) {
    if (st === statoTerreno) return;
    const prima = statoTerreno; statoTerreno = st;
    const H = st === "schiuma" ? HRAW : HCAR;
    tMat.userData.fase = { schiuma: 4, scavato: 5, gesso: 6, dipinto: 8 }[st];
    sMat.userData.fase = tMat.userData.fase;
    sMat.color.set(FIANCO[st]);
    if (anima && prima) {
      animColori = { da: tCol.slice(), a: COLORI[st], t0: performance.now(), dur: 1100 };
      const daH = new Float32Array(NX * NY); for (let k = 0; k < NX * NY; k++) daH[k] = tPos[k * 3 + 1];
      animAltezze = { da: daH, a: H, t0: performance.now(), dur: 1100 };
    } else { tCol.set(COLORI[st]); tGeo.attributes.color.needsUpdate = true; applicaAltezze(H); }
  }

  /* ---------------- acqua del fiume ---------------- */
  const canvasAcqua = document.createElement("canvas"); canvasAcqua.width = 64; canvasAcqua.height = 256;
  { const x = canvasAcqua.getContext("2d"); x.fillStyle = "#3c9be0"; x.fillRect(0, 0, 64, 256); for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`; x.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 8, 10 + Math.random() * 30); } }
  const texAcqua = new T.CanvasTexture(canvasAcqua); texAcqua.wrapS = texAcqua.wrapT = T.RepeatWrapping;
  const matAcqua = regMat(new T.MeshStandardMaterial({ map: texAcqua, color: "#9fd6ff", roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.88, emissive: "#0d3b66", emissiveIntensity: 0.35 }), 7);
  const aPos = [], aUv = [], aIdx = [];
  let s = 0;
  CR.forEach((p, i) => {
    const a = CR[Math.max(0, i - 1)], b = CR[Math.min(CR.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = 4.6, y = LIV[i] - 1;
    aPos.push(p[0] - ty * w - 400, y, p[1] + tx * w - 250, p[0] + ty * w - 400, y, p[1] - tx * w - 250);
    if (i) s += Math.hypot(p[0] - CR[i - 1][0], p[1] - CR[i - 1][1]);
    aUv.push(0, s / 40, 1, s / 40);
    if (i < CR.length - 1) { const q = i * 2; aIdx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
  });
  const aGeo = new T.BufferGeometry(); aGeo.setIndex(aIdx);
  aGeo.setAttribute("position", new T.Float32BufferAttribute(aPos, 3)); aGeo.setAttribute("uv", new T.Float32BufferAttribute(aUv, 2)); aGeo.computeVertexNormals();
  const fiume = new T.Mesh(aGeo, matAcqua); fiume.receiveShadow = true;
  const gAcqua = new T.Group(); gAcqua.add(fiume);
  // Schiuma bianca ai salti
  const spruzzi = [];
  SALTI3D.forEach((i) => { for (let q = 0; q < 10; q++) { const p = CR[Math.min(CR.length - 1, i + 1)]; const m = mesh(GS(1.1, 6, 4), M("#ffffff", { transparent: true, opacity: 0.85 }), p[0] - 400 + (R() - 0.5) * 8, LIV[i], p[1] - 250 + (R() - 0.5) * 8, false); m.userData.ph = R() * 6; m.userData.y0 = LIV[i] - 0.5; spruzzi.push(m); gAcqua.add(m); } });
  // Sorgente che zampilla
  const zampillo = mesh(GS(3.5, 10, 8), regMat(new T.MeshStandardMaterial({ color: "#c9ecff", transparent: true, opacity: 0.8, emissive: "#3a8ad0", emissiveIntensity: 0.4 }), 7), SORGENTE[0] - 400, LIV[0], SORGENTE[1] - 250, false);
  gAcqua.add(zampillo);
  FASE_MAT = 7;

  // Laghi e mari (resina, fase 8)
  FASE_MAT = 8;
  const matLago = M("#3d8fd0", { roughness: 0.1, metalness: 0.25, transparent: true, opacity: 0.86, emissive: "#0d3b66", emissiveIntensity: 0.3 });
  const gLaghi = new T.Group();
  LAGHI.forEach((L) => { const g = new T.Mesh(new T.CircleGeometry(1, 40), matLago); g.scale.set(L.rx, L.ry, 1); g.rotation.x = -Math.PI / 2; g.position.copy(V(L.x, L.y, 5.5)); g.receiveShadow = true; gLaghi.add(g); });
  { const sh = new T.Shape(); MED.forEach(([x, y], i) => (i ? sh.lineTo(x - 400, -(y - 250)) : sh.moveTo(x - 400, -(y - 250)))); const m = new T.Mesh(new T.ShapeGeometry(sh), matLago); m.rotation.x = -Math.PI / 2; m.position.y = 5.5; gLaghi.add(m); }

  /* =========================================================
     FASE 1 · Carta  ·  FASE 2 · Base  ·  FASE 3 · Sotto la base
     ========================================================= */
  const SVG_TXT = costruisciTabellone();
  function texDaSvg(tenere, cb, numeri = true) {
    const doc = new DOMParser().parseFromString(SVG_TXT, "image/svg+xml"), root = doc.documentElement;
    root.setAttribute("viewBox", "0 0 800 500"); root.setAttribute("width", "2400"); root.setAttribute("height", "1500");
    root.querySelectorAll("g.layer").forEach((g) => { if (!tenere.includes(g.id)) g.remove(); });
    root.querySelectorAll("#ly-click, .scala").forEach((g) => g.remove());
    if (!numeri) root.querySelectorAll("#ly-numeri").forEach((g) => g.remove());
    const st = doc.createElementNS("http://www.w3.org/2000/svg", "style");
    st.textContent = "text{font-family:Arial,sans-serif}.t-mini{font-size:8px}.t-num{font-size:8px;font-weight:700}";
    root.insertBefore(st, root.firstChild);
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = 2400; c.height = 1500; c.getContext("2d").drawImage(img, 0, 0, 2400, 1500); const t = new T.CanvasTexture(c); t.anisotropy = 4; cb(t); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(root));
  }
  FASE_MAT = 1;
  const matCarta = M("#ffffff", { roughness: 1 });
  const carta = mesh(new T.PlaneGeometry(800, 500), matCarta, 0, -74.5, 0, false); carta.rotation.x = -Math.PI / 2;
  reg(carta, 1, 1, "carta", "nessuna");
  texDaSvg(["ly-carta", "ly-matita"], (t) => { matCarta.map = t; matCarta.needsUpdate = true; });

  // Base in multistrato con i fori
  FASE_MAT = 2;
  const cLegno = document.createElement("canvas"); cLegno.width = cLegno.height = 512;
  { const x = cLegno.getContext("2d"); x.fillStyle = "#d8b07c"; x.fillRect(0, 0, 512, 512); for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(140,95,50,${0.08 + Math.random() * 0.18})`; x.lineWidth = 1 + Math.random() * 2.5; x.beginPath(); const y0 = Math.random() * 512; x.moveTo(0, y0); for (let k = 0; k <= 512; k += 32) x.lineTo(k, y0 + Math.sin(k / 60 + i) * 6); x.stroke(); } }
  const texLegno = new T.CanvasTexture(cLegno); texLegno.wrapS = texLegno.wrapT = T.RepeatWrapping; texLegno.repeat.set(1 / 260, 1 / 260);
  const matBase = M("#ffffff", { map: texLegno, roughness: 0.8 });
  const forma = new T.Shape(); forma.moveTo(-400, -250); forma.lineTo(400, -250); forma.lineTo(400, 250); forma.lineTo(-400, 250); forma.lineTo(-400, -250);
  const buco = (x, y, w, h) => { const p = new T.Path(); const X = x - 400, Y = -(y - 250); p.moveTo(X - w / 2, Y - h / 2); p.lineTo(X - w / 2, Y + h / 2); p.lineTo(X + w / 2, Y + h / 2); p.lineTo(X + w / 2, Y - h / 2); p.lineTo(X - w / 2, Y - h / 2); return p; };
  const tondo = (x, y, r) => { const p = new T.Path(); p.absarc(x - 400, -(y - 250), r, 0, Math.PI * 2, true); return p; };
  forma.holes.push(buco(NJ.x, NJ.y, 80, 60), tondo(SORGENTE[0], SORGENTE[1], 5));
  LUCI.forEach((l) => forma.holes.push(tondo(l.x, l.y, 4)));
  const baseGeo = new T.ExtrudeGeometry(forma, { depth: 15, bevelEnabled: false }); baseGeo.rotateX(-Math.PI / 2); baseGeo.translate(0, -15, 0);
  const base = mesh(baseGeo, matBase); const gBase = new T.Group(); gBase.add(base);
  const matListello = M("#c49a64", { roughness: 0.85 });
  [[0, -235, 800, 30], [0, 235, 800, 30], [-385, 0, 30, 440], [385, 0, 30, 440]].forEach(([x, z, w, d]) => gBase.add(mesh(GB(w, 60, d), matListello, x, -45, z)));
  reg(gBase, 2, 99, "base");
  const matDecal = M("#ffffff", { transparent: true, opacity: 0.9, depthWrite: false });
  const decal = mesh(new T.PlaneGeometry(800, 500), matDecal, 0, 0.6, 0, false); decal.rotation.x = -Math.PI / 2;
  reg(decal, 2, 3, "base", "nessuna");
  texDaSvg(["ly-matita"], (t) => { matDecal.map = t; matDecal.needsUpdate = true; });

  // Sotto la base: vaschetta, pompa, tubo, tubo rigido della sorgente, passacavi
  FASE_MAT = 3;
  const gSotto = new T.Group();
  const vx = NJ.x - 400, vz = NJ.y - 250;
  gSotto.add(mesh(GB(120, 50, 80), M("#bfe3ff", { transparent: true, opacity: 0.35, roughness: 0.1 }), vx, -42, vz));
  gSotto.add(mesh(GB(118, 34, 78), M("#4fa8e8", { transparent: true, opacity: 0.55 }), vx, -50, vz));
  gSotto.add(mesh(GB(26, 20, 18), M("#2b2f36"), vx - 20, -56, vz));
  [[-24], [24]].forEach(([dz]) => gSotto.add(mesh(GB(130, 4, 10), M("#8a6a44"), vx, -19, vz + dz * 1.9)));
  const tuboCurva = new T.CatmullRomCurve3([V(NJ.x - 20, NJ.y, -50), V(NJ.x - 20, NJ.y, -28), V(NJ.x - 70, NJ.y + 20, -22), V(NJ.x - 70, 470, -22), V(SORGENTE[0], 470, -22), V(SORGENTE[0], SORGENTE[1] + 20, -22), V(SORGENTE[0], SORGENTE[1], -18), V(SORGENTE[0], SORGENTE[1], LIV[0] - 4)], false, "catmullrom", 0.05);
  gSotto.add(mesh(new T.TubeGeometry(tuboCurva, 300, 3.5, 8, false), M("#e8f4ff", { transparent: true, opacity: 0.6, roughness: 0.2 })));
  const gocce = []; for (let i = 0; i < 40; i++) { const g = mesh(GS(2, 6, 4), M("#2a8ad6", { emissive: "#1a5fa0", emissiveIntensity: 0.6 }), 0, 0, 0, false); g.userData.u = i / 40; gocce.push(g); gSotto.add(g); }
  LUCI.forEach((l) => gSotto.add(mesh(GC(4, 4, 18, 8), M("#f4f4f4", { transparent: true, opacity: 0.7 }), l.x - 400, -6, l.y - 250, false)));
  reg(gSotto, 3, 99, "sotto");
  const alimentatore = new T.Group();
  alimentatore.add(mesh(GB(50, 30, 70), M("#2b2f36", { roughness: 0.5 }), 0, 15, 0));
  alimentatore.add(mesh(GB(20, 2, 12), M("#ffd34d", { emissive: "#ffb000", emissiveIntensity: 0.6 }), 0, 31, -15));
  alimentatore.position.set(470, -75, 180);
  reg(alimentatore, 3, 99, "sotto");
  const cavoAl = new T.CatmullRomCurve3([V(NJ.x + 30, NJ.y, -30), V(790, NJ.y, -30), V(830, 440, -60), V(870, 430, -60)]);
  reg(mesh(new T.TubeGeometry(cavoAl, 40, 1.6, 6), M("#151515")), 3, 99, "sotto");

  /* ---------------- terreno nella scena ---------------- */
  reg(gTerreno, 4, 99, "terreno", "schiuma");
  reg(gAcqua, 7, 99, "terreno", "acqua");
  reg(gLaghi, 8, 99, "terreno", "nessuna");
  // Canalette trasparenti nei salti (fase 5)
  FASE_MAT = 5;
  const gCanalette = new T.Group();
  SALTI3D.forEach((i) => { const pts = []; for (let q = -10; q <= 8; q += 2) { const k = Math.min(CR.length - 1, Math.max(0, i + q)); pts.push(V(CR[k][0], CR[k][1], LIV[k] - 3)); } gCanalette.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 5.5, 10, false), M("#e8f6ff", { transparent: true, opacity: 0.45, roughness: 0.05, side: T.DoubleSide }), 0, 0, 0, false)); });
  reg(gCanalette, 5, 99, "terreno");

  /* =========================================================
     MODELLI (fase 10): figure e costruzioni in scala
     ========================================================= */
  FASE_MAT = 10;
  const PELLE = "#e0b48a", FUOCHI = [], STELLE = [];
  const info = (o, txt, n) => { o.userData.info = txt; if (n) o.userData.tappa = n; return o; };
  function P(col = "#8a3b2a", s = 1) { const g = new T.Group(); g.add(mesh(GC(1.3, 2.2, 7, 8), M(col), 0, 3.5, 0)); g.add(mesh(GS(1.5, 8, 6), M(PELLE), 0, 8.6, 0)); if (s !== 1) g.scale.setScalar(s); return g; }
  function Seduto(col) { const g = P(col); g.scale.set(1, 0.62, 1); return g; }
  function Angelo() { const g = P("#ffffff"); g.add(mesh(GB(7, 3.5, 0.5), M("#ffffff"), 0, 6.5, -1.8)); return g; }
  function Quad(col, L, H) {
    const g = new T.Group(), b = mesh(GS(1, 10, 8), M(col), 0, H * 0.62, 0); b.scale.set(L / 2, H * 0.24, H * 0.2); g.add(b);
    g.add(mesh(GS(H * 0.15, 8, 6), M(col), L / 2 + H * 0.05, H * 0.8, 0));
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, c]) => g.add(mesh(GC(H * 0.05, H * 0.05, H * 0.5, 5), M(col), a * L * 0.33, H * 0.25, c * H * 0.12)));
    return g;
  }
  function Pecora() { const g = new T.Group(), b = mesh(GS(1, 8, 6), M("#f6f2e6"), 0, 2.4, 0); b.scale.set(2.6, 1.8, 1.8); g.add(b, mesh(GS(0.9, 6, 4), M("#3a3330"), 2.6, 2.9, 0)); return g; }
  function Cammello() { const g = Quad("#c49a5a", 10, 12); g.add(mesh(GS(2.2, 8, 6), M("#c49a5a"), -0.5, 9.6, 0)); const c = mesh(GC(0.9, 1.2, 6, 6), M("#c49a5a"), 5.5, 10, 0); c.rotation.z = -0.6; g.add(c); g.children[1].position.set(7.6, 12.6, 0); return g; }
  const Leone = () => { const g = Quad("#d9a03a", 6, 5); g.add(mesh(GS(1.6, 8, 6), M("#8a5a1a"), 3.1, 4.1, 0)); return g; };
  const Asino = () => Quad("#8a8078", 6, 6), Cavallo = () => Quad("#6b4a2b", 9, 10), Bue = () => Quad("#7a5a3a", 7, 6);
  const Elefante = () => { const g = Quad("#8d8d8d", 8, 8); g.add(mesh(GC(0.6, 0.9, 4, 6), M("#8d8d8d"), 5.6, 4.5, 0)); return g; };
  const Giraffa = () => { const g = Quad("#e0b050", 5, 6); const c = mesh(GC(0.6, 0.9, 7, 6), M("#e0b050"), 2.8, 8, 0); c.rotation.z = -0.25; g.add(c); g.children[1].position.set(3.8, 11.6, 0); return g; };
  function Tenda(w = 14, d = 10, h = 8, col = "#e6d3a8") {
    const g = geo(`tenda${w}|${d}|${h}`, () => { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0); const e = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); e.translate(0, 0, -d / 2); return e; });
    return mesh(g, M(col, { side: T.DoubleSide }));
  }
  function Casa(w = 10, d = 10, h = 9, col = "#e9dfcb") { const g = new T.Group(); g.add(mesh(GB(w, h, d), M(col), 0, h / 2, 0)); g.add(mesh(GB(w + 1, 1, d + 1), M("#cdbfa3"), 0, h + 0.5, 0)); g.add(mesh(GB(2.4, 4.5, 0.4), M("#4a3626"), 0, 2.25, d / 2 + 0.1, false)); return g; }
  function Albero(h = 24, r = 8, col = "#3f7d34") { const g = new T.Group(); g.add(mesh(GC(0.9, 1.5, h * 0.55, 6), M("#6b4a2b"), 0, h * 0.27, 0)); g.add(mesh(geo(`ico${r}`, () => new T.IcosahedronGeometry(r, 1)), M(col, { flatShading: true }), 0, h * 0.55 + r * 0.6, 0)); return g; }
  function Palma(h = 20) {
    const g = new T.Group(), tr = mesh(GC(0.7, 1.1, h, 6), M("#7a5a35"), 0, h / 2, 0); tr.rotation.z = 0.08; g.add(tr);
    for (let i = 0; i < 7; i++) { const f = mesh(GB(11, 0.4, 2.6), M("#3f7a32"), 0, h, 0); f.geometry = geo("foglia", () => new T.BoxGeometry(11, 0.4, 2.6).translate(5.5, 0, 0)); f.rotation.set(0, (i / 7) * Math.PI * 2, -0.45); g.add(f); }
    return g;
  }
  const Cespuglio = (r = 3, col = "#4f8a3a") => mesh(GS(r, 7, 5), M(col, { flatShading: true }), 0, r * 0.7, 0);
  function Fuoco(s = 1) {
    const g = new T.Group(), a = mesh(GK(3, 8, 7), M("#ff7a1a", { emissive: "#ff5a00", emissiveIntensity: 1 }), 0, 4, 0, false), b = mesh(GK(1.7, 5, 6), M("#ffd34d", { emissive: "#ffc400", emissiveIntensity: 1 }), 0, 3, 0, false);
    [[-2, 0.4], [2, -0.4]].forEach(([x, r]) => { const l = mesh(GC(0.6, 0.6, 7, 5), M("#4a2e14"), x * 0.6, 0.6, 0); l.rotation.set(Math.PI / 2, 0, r + 0.5); g.add(l); });
    g.add(a, b); g.scale.setScalar(s); FUOCHI.push(g); return g;
  }
  const Pietra = (w, h, d, col = "#9a9184") => mesh(GB(w, h, d), M(col, { flatShading: true }), 0, h / 2, 0);
  function Fumo(curva) { const g = new T.Group(); for (let i = 0; i < 9; i++) { const k = i / 8; g.add(mesh(GS(1.6 + k * 2.2, 7, 5), M("#cfcfcf", { transparent: true, opacity: 0.45, depthWrite: false }), curva * k * k * 14, 8 + i * 4.2, 0, false)); } return g; }
  function AlberoVita() {
    const g = new T.Group(), tr = mesh(GC(2.2, 3.6, 34, 9), M("#6b4a2b"), 0, 17, 0); g.add(tr);
    [[0.7, 0], [-0.7, 1.6], [0.6, 3.1], [-0.6, 4.6]].forEach(([r, a]) => { const b = mesh(GC(0.9, 1.4, 14, 6), M("#6b4a2b"), Math.cos(a) * 4, 30, Math.sin(a) * 4); b.rotation.set(Math.sin(a) * r, 0, -Math.cos(a) * r); g.add(b); });
    [[0, 44, 0, 15], [9, 40, 4, 11], [-9, 41, -3, 11], [3, 41, -10, 10], [-4, 40, 10, 10], [0, 52, 0, 10]].forEach(([x, y, z, r]) => g.add(mesh(geo(`ico${r}`, () => new T.IcosahedronGeometry(r, 1)), M("#2f8a3c", { flatShading: true }), x, y, z)));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, rr = 13 + (i % 3) * 2; g.add(mesh(GS(1.8, 8, 6), M("#f2c14e", { emissive: "#c98a00", emissiveIntensity: 0.45, metalness: 0.3 }), Math.cos(a) * rr, 38 + (i % 4) * 4, Math.sin(a) * rr)); }
    return g;
  }
  function Arca() {
    const g = new T.Group();
    const s = new T.Shape(); s.moveTo(-45, 4); s.lineTo(-38, -3); s.lineTo(38, -3); s.lineTo(45, 4); s.lineTo(-45, 4);
    const sc = mesh(geo("scafo", () => { const e = new T.ExtrudeGeometry(s, { depth: 15, bevelEnabled: false }); e.translate(0, 3, -7.5); return e; }), M("#7a4b23"));
    g.add(sc, mesh(GB(62, 5, 11), M("#a06a35"), 0, 9.5, 0));
    const tetto = mesh(geo("tettoArca", () => { const t = new T.Shape(); t.moveTo(-6.5, 0); t.lineTo(6.5, 0); t.lineTo(0, 3); t.lineTo(-6.5, 0); const e = new T.ExtrudeGeometry(t, { depth: 64, bevelEnabled: false }); e.translate(0, 0, -32); e.rotateY(Math.PI / 2); return e; }), M("#5b3518"), 0, 12, 0);
    g.add(tetto, mesh(GB(6, 4, 0.5), M("#3e2410"), 10, 9, 5.6));
    return g;
  }
  function Arcobaleno() { const g = new T.Group(); ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#3949ab", "#8e24aa"].forEach((c, i) => g.add(mesh(new T.TorusGeometry(58 - i * 1.8, 0.9, 6, 48, Math.PI), M(c, { emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 }), 0, 0, 0, false))); return g; }
  function Ziggurat() {
    const g = new T.Group(), col = ["#b98c5a", "#c39663", "#cca06c", "#d6ab78", "#dfb684", "#e7c191"];
    [45, 38, 31, 24, 18, 12].forEach((w, i) => { const h = 10; const b = mesh(GB(w, h, w), M(col[i], { flatShading: true }), 0, i * h + h / 2, 0); b.rotation.y = i * 0.12; g.add(b); });
    for (let i = 0; i < 6; i++) { const st = mesh(GC(0.4, 0.4, 16, 4), M("#8a6a40"), 4 + (i % 2) * 3, 66, -3 + i, false); st.rotation.z = 0.15 * (i % 3 - 1); g.add(st); }
    g.add(mesh(GB(8, 3, 3), M("#c39663"), -3, 61.5, 2));
    return g;
  }
  function Piramide(lato, h) { const p = mesh(GK(lato / Math.SQRT2, h, 4), M("#e2c27c", { flatShading: true }), 0, h / 2, 0); p.rotation.y = Math.PI / 4; return p; }
  function Tempio() {
    const g = new T.Group();
    g.add(mesh(GB(64, 4, 44), M("#e8dcc0"), 0, 2, 0));
    g.add(mesh(GB(50, 22, 30), M("#f4ecd8"), 0, 15, 0));
    g.add(mesh(GB(52, 2, 32), M("#d4a62a", { metalness: 0.6, roughness: 0.3 }), 0, 27, 0));
    g.add(mesh(GB(16, 18, 30.5), M("#ece2ca"), -17, 13, 0));
    [[-28, -7], [-28, 7]].forEach(([x, z]) => g.add(mesh(GC(1.6, 1.6, 18, 10), M("#b8862e", { metalness: 0.7, roughness: 0.3 }), x, 13, z)));
    g.add(mesh(GB(7, 5, 7), M("#b8862e", { metalness: 0.5 }), -36, 6.5, 14));
    g.add(mesh(GB(10, 2, 0.6), M("#3a2a1a"), -25.2, 12, 0));
    return g;
  }
  function MuraAnello(r, n, buchi, col = "#d8c8a8") { const g = new T.Group(); for (let i = 0; i < n; i++) { if (buchi.includes(i)) continue; const a = (i / n) * Math.PI * 2, b = mesh(GB((2 * Math.PI * r) / n + 0.6, 12, 3.5), M(col, { flatShading: true }), Math.cos(a) * r, 6, Math.sin(a) * r); b.rotation.y = -a + Math.PI / 2; g.add(b); } return g; }
  function Croce(h) { const g = new T.Group(); g.add(mesh(GB(1.8, h, 1.8), M("#5b3518"), 0, h / 2, 0), mesh(GB(h * 0.45, 1.6, 1.6), M("#5b3518"), 0, h * 0.75, 0)); return g; }
  function Nave() {
    const g = new T.Group(), s = new T.Shape(); s.moveTo(-15, 3); s.lineTo(-11, -1); s.lineTo(11, -1); s.lineTo(16, 4); s.lineTo(-15, 3);
    g.add(mesh(geo("scafoNave", () => { const e = new T.ExtrudeGeometry(s, { depth: 8, bevelEnabled: false }); e.translate(0, 1, -4); return e; }), M("#7a4b23")));
    g.add(mesh(GC(0.5, 0.6, 22, 6), M("#5b3518"), 0, 14, 0));
    const vela = mesh(geo("vela", () => new T.PlaneGeometry(12, 11)), M("#f6f0dc", { side: T.DoubleSide }), 0, 15, 0.6); vela.rotation.y = Math.PI / 2; g.add(vela);
    return g;
  }
  function Barca(l = 20) { const g = new T.Group(); g.add(mesh(GB(l, 3, l * 0.38), M("#7a4b23"), 0, 1.5, 0), mesh(GC(0.4, 0.4, 12, 5), M("#5b3518"), 0, 7, 0)); return g; }
  function Stella(r = 6) {
    const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const m = mesh(new T.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false }), M("#ffd75a", { emissive: "#ffb800", emissiveIntensity: 0.9, metalness: 0.4 }), 0, 0, 0, false); STELLE.push(m); return m;
  }
  function Ponte() {
    const g = new T.Group();
    g.add(mesh(GB(26, 2.4, 13), M("#8a5a2b"), 0, 0, 0));
    [-6, 6].forEach((z) => { g.add(mesh(GB(26, 0.8, 0.8), M("#5b3a1a"), 0, 5, z)); for (let x = -12; x <= 12; x += 6) g.add(mesh(GB(0.8, 5, 0.8), M("#5b3a1a"), x, 2.5, z)); });
    return g;
  }

  // Gruppo di ogni tappa
  const GT = {}; let gCorr = null, nCorr = 0;
  function tappa(n) { nCorr = n; gCorr = GT[n] = new T.Group(); gCorr.userData.tappa = n; return gCorr; }
  function put(o, x, y, opt = {}) {
    const h = opt.h !== undefined ? opt.h : hAt(x, y);
    o.position.set(x - 400, h + (opt.dy || 0), y - 250);
    if (opt.rot !== undefined) o.rotation.y = opt.rot;
    if (opt.s) o.scale.multiplyScalar(opt.s);
    if (opt.info) info(o, opt.info, nCorr);
    gCorr.add(o); return o;
  }
  const dirAt = (i) => { const a = CP[Math.max(0, i - 3)], b = CP[Math.min(CP.length - 1, i + 3)]; return -Math.atan2(b[1] - a[1], b[0] - a[0]); };
  function lungo(n, da, a, passo, fn) { for (let s = da; s <= a; s += passo) { const i = IDX[n] + s, p = CP[i]; if (p) fn(p[0], p[1], dirAt(i), s); } }
  const cols = ["#8a3b2a", "#3b5ca8", "#6b8a2a", "#a87a2a", "#7a2a6a", "#2a7a7a", "#c9b07a", "#b85a3a", "#4a4a7a"];
  const colR = () => cols[Math.floor(R() * cols.length)];

  // 1 · Creazione
  tappa(1);
  { const d1 = mesh(new T.CylinderGeometry(30, 30, 2.5, 40, 1, false, 0, Math.PI), M("#141a3a"), 0, 1.25, 0); const d2 = mesh(new T.CylinderGeometry(30, 30, 2.5, 40, 1, false, Math.PI, Math.PI), M("#fff3c8", { emissive: "#ffe39a", emissiveIntensity: 0.35 }), 0, 1.25, 0); const g = new T.Group(); g.add(d1, d2); g.rotation.y = Math.PI / 4; put(info(g, "Disco luce e buio · Ø 6 cm"), 55, 55); }
  put(mesh(GS(7, 16, 12), M("#ffe27a", { emissive: "#ffcc33", emissiveIntensity: 0.9 }), 0, 0, 0), 65, 65, { dy: 16, info: "Disco della luce · Ø 3 cm" });
  for (let i = 0; i < 12; i++) put(Stella(1.6), 30 + R() * 30, 30 + R() * 22, { dy: 5 + R() * 18 });
  // 2 · Eden
  tappa(2);
  put(AlberoVita(), SORGENTE[0], SORGENTE[1], { info: "Albero della vita · alto 6 cm, chioma Ø 4 cm (stampato 2 volte)" });
  { const a = put(Albero(26, 8, "#4f8c3a"), 52, 258, { info: "Albero della conoscenza · alto 4,5 cm" }); for (let i = 0; i < 6; i++) a.add(mesh(GS(1.4, 6, 4), M("#c62828"), Math.cos(i) * 6, 17 + (i % 3) * 2, Math.sin(i) * 6)); const pts = []; for (let k = 0; k < 40; k++) pts.push(new T.Vector3(Math.cos(k * 0.6) * 2.2, 2 + k * 0.35, Math.sin(k * 0.6) * 2.2)); a.add(info(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.55, 5), M("#3c7a1f")), "Serpente · 1,5 cm")); }
  put(P("#d9b38c"), 76, 246, { info: "Adamo · 1 cm" }); put(P("#d9b38c"), 83, 249, { info: "Eva · 1 cm" });
  [[Leone, 95, 198], [Pecora, 101, 203], [Elefante, 48, 205], [Giraffa, 62, 196], [Cavallo, 92, 268], [Bue, 40, 230]].forEach(([f, x, y]) => put(f(), x, y, { rot: R() * 6, info: "Animali in pace · 3-10 mm" }));
  for (let i = 0; i < 40; i++) put(mesh(GS(1.1, 5, 4), M(["#f2c14e", "#e86a8a", "#ffffff", "#b07ae0"][i % 4])), 38 + R() * 70, 190 + R() * 80, { dy: 1 });
  // 3 · Caino e Abele
  tappa(3);
  put(info(Pietra(11, 9, 10), "Altare di Abele · 1 x 1 x 0,8 cm", 3), 117, 418); put(info(Pietra(11, 9, 10, "#8a8174"), "Altare di Caino · 1 x 1 x 0,8 cm", 3), 92, 418);
  put(Fuoco(0.8), 117, 418, { dy: 9 }); put(Fuoco(0.6), 92, 418, { dy: 9 });
  put(Fumo(0), 117, 418, { dy: 12 }); put(Fumo(-1), 92, 418, { dy: 12 });
  put(P("#7a5a2a"), 104, 404, { info: "Abele · 1 cm" }); put(P("#5a3a2a"), 82, 404, { info: "Caino · 1 cm" });
  for (let i = 0; i < 5; i++) put(mesh(GB(22, 1.4, 1.6), M("#6a4a24")), 83, 438 + i * 4);
  for (let i = 0; i < 6; i++) put(Pecora(), 120 + R() * 14, 436 + R() * 12, { rot: R() * 6 });
  // 4 · Ararat
  tappa(4);
  put(info(Arca(), "Arca di Noè · 9 x 1,5 x 1 cm (300 x 50 x 30 cubiti)", 4), 195, 150, { rot: 0.2 });
  put(info(Arcobaleno(), "Arcobaleno · filo di ferro dipinto", 4), 197, 120, { dy: 2 });
  put(mesh(GS(1.4, 6, 4), M("#ffffff")), 205, 150, { dy: 15, info: "Colomba · 3 mm" });
  for (let i = 0; i < 8; i++) put(P(colR()), 175 + (i % 4) * 7, 172 + Math.floor(i / 4) * 7, { info: "Noè e famiglia · 1 cm" });
  { const anim = [Elefante, Giraffa, Leone, Pecora, Cavallo, Bue, Asino, Cammello]; lungo(3, 55, 320, 11, (x, y, r, s) => { const f = anim[(s / 11) % anim.length | 0]; put(f(), x - 4, y, { rot: r, info: "Animali a coppie in fila · 3-10 mm" }); put(f(), x + 4, y, { rot: r }); }); }
  // 5 · Babele
  tappa(5);
  put(info(Ziggurat(), "Torre di Babele · base 4,5 cm, alta 6-7 cm", 5), 305, 82);
  [[268, 118], [272, 124], [322, 120], [328, 116], [262, 70], [260, 78], [282, 60], [330, 60], [334, 92]].forEach(([x, y]) => put(P("#6a5acd"), x, y, { info: "Popoli che si disperdono · 1 cm" }));
  put(mesh(GB(8, 4, 5), M("#8a5a2b")), 276, 110, { info: "Carretto di mattoni · 8 mm" });
  // 6 · Abramo
  tappa(6);
  put(info(Tenda(30, 20, 15, "#e6d3a8"), "Tenda grande · 3 x 2 x 1,5 cm", 6), 312, 192, { rot: 0.2 });
  put(Tenda(14, 10, 9), 282, 210, { rot: 0.8 }); put(Tenda(13, 10, 8), 286, 184, { rot: -0.4 }); put(Tenda(12, 9, 8, "#d9c49a"), 330, 178, { rot: 1.4 });
  put(P("#8b2e2e"), 300, 214, { info: "Abramo che guarda le stelle · 1 cm" }); put(P("#5a6a9a"), 306, 216, { info: "Sara · 1 cm" });
  put(Cammello(), 330, 214, { rot: 0.6, info: "Cammelli · 1,2 cm" }); put(Cammello(), 325, 228, { rot: -0.2 }); put(Cammello(), 272, 232, { rot: 2 });
  for (let i = 0; i < 10; i++) put(Pecora(), 268 + R() * 18, 165 + R() * 20, { rot: R() * 6 });
  for (let i = 0; i < 26; i++) put(Stella(1.4), 270 + R() * 60, 168 + R() * 60, { dy: 60 + R() * 60 });
  // 7 · Sodoma
  tappa(7);
  [[272, 292, 12], [284, 288, 8], [278, 314, 6], [266, 305, 10], [262, 286, 5]].forEach(([x, y, h]) => put(Casa(10, 10, h, "#4a3a32"), x, y, { rot: R(), info: "Case in rovina · 1,5 x 1,5 cm" }));
  put(Fuoco(1.3), 275, 300); put(Fuoco(0.9), 287, 308); put(Fuoco(0.8), 266, 294);
  put(info(P("#ffffff"), "Statua di sale · 1 cm, bianca", 7), 306, 322, { rot: Math.PI });
  lungo(7, 24, 48, 7, (x, y, r, s) => put(s === 24 || s === 31 ? Angelo() : P("#3b5ca8"), x, y, { rot: r, info: "Lot, le figlie e due angeli · 1 cm" }));
  // 8 · Patriarchi
  tappa(8);
  { const sc = new T.Group(); [-4, 4].forEach((z) => sc.add(mesh(GB(1, 52, 1), M("#c9a14a", { metalness: 0.5 }), 0, 26, z))); for (let y = 4; y < 52; y += 6) sc.add(mesh(GB(1, 1, 8), M("#c9a14a", { metalness: 0.5 }), 0, y, 0)); sc.rotation.z = -0.35; put(info(sc, "Scala di Giacobbe · alta 5 cm", 8), 330, 425); [[18], [30], [42]].forEach(([y], i) => { const a = Angelo(); a.position.set(1.4, y, i % 2 ? 3 : -3); sc.add(a); }); }
  { const g = P("#7b4a2a"); g.rotation.z = Math.PI / 2; put(info(g, "Giacobbe che dorme · 1 cm", 8), 322, 440, { dy: 2 }); put(Pietra(4, 3, 4), 315, 440); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; put(P("#7b4a2a"), 290 + Math.cos(a) * 12, 440 + Math.sin(a) * 9, { rot: -a, info: "I dodici figli di Giacobbe · 1 cm" }); }
  put(Tenda(13, 10, 8), 325, 405, { rot: 0.3 }); put(Tenda(12, 9, 8), 286, 408, { rot: -0.2 });
  put(info(mesh(GC(5, 5, 4, 14), M("#8a8174")), "Pozzo · Ø 1 cm", 8), 296, 400);
  // 9 · Egitto
  tappa(9);
  [[360, 430, 44, 30], [374, 456, 32, 22], [428, 440, 28, 19]].forEach(([x, y, l, h]) => put(Piramide(l, h), x, y, { info: "Piramidi · base 3 cm, alte 2 cm" }));
  [[418, 392], [426, 400], [416, 405], [430, 390]].forEach(([x, y]) => { put(mesh(GC(4, 4, 4, 12), M("#d9b779")), x, y, { dy: 2, info: "Granai a cupola · Ø 1 cm" }); put(mesh(new T.SphereGeometry(4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M("#e0c085")), x, y, { dy: 4 }); });
  put(info(mesh(GC(5, 5, 4, 14), M("#8a8174")), "Pozzo di Giuseppe · Ø 1 cm", 9), 404, 416);
  for (let i = 0; i < 14; i++) put(mesh(GC(0.4, 0.4, 14, 4), M("#4f8a3a")), 352 + i * 7, 333 + (i % 3) * 3, { dy: 6, info: "Papiri sul Nilo · 1,5 cm" });
  put(P("#c9a14a"), 400, 384, { info: "Giuseppe viceré · 1 cm" });
  for (let i = 0; i < 6; i++) put(P("#8a6a4a"), 385 + i * 4, 390, {});
  put(Cammello(), 350, 400, { rot: 1.5 }); put(Cammello(), 352, 412, { rot: 1.5 });
  // 10 · Esodo
  tappa(10);
  [[383], [427]].forEach(([x]) => put(info(mesh(GB(18, 30, 70), M("#2f7fc4", { transparent: true, opacity: 0.72, roughness: 0.05, emissive: "#0d3b66", emissiveIntensity: 0.25 })), "Muro d'acqua del Mar Rosso · resina/silicone", 10), x, 285, { dy: 13 }));
  put(Cespuglio(4.5, "#3f6a2a"), 392, 268, { info: "Roveto ardente · Ø 1,5 cm" }); put(Fuoco(0.9), 392, 268, { dy: 3 });
  put(P("#5a3a2a"), 405, 252, { info: "Mosè col bastone · 1 cm" });
  lungo(10, -26, 28, 6, (x, y, r) => { put(P(colR()), x - 3, y, { rot: r, info: "Il popolo che attraversa · 1 cm" }); put(P(colR()), x + 3, y + 2, { rot: r }); });
  // 11 · Sinai
  tappa(11);
  put(P("#7a3b2a"), 400, 152, { info: "Mosè sul Sinai · 1 cm" });
  put(info(mesh(GB(5, 7, 1.2), M("#d8d4cc")), "Tavole della legge · 8 x 6 mm", 11), 402, 147, { dy: 6 });
  { const t = new T.Group(); t.add(mesh(GB(40, 0.6, 0.6), M("#8a7b5a"), 0, 7, -10), mesh(GB(40, 0.6, 0.6), M("#8a7b5a"), 0, 7, 10), mesh(GB(0.6, 0.6, 20), M("#8a7b5a"), -20, 7, 0), mesh(GB(0.6, 0.6, 20), M("#8a7b5a"), 20, 7, 0)); [[-20, -10], [20, -10], [-20, 10], [20, 10], [0, -10], [0, 10]].forEach(([x, z]) => t.add(mesh(GC(0.4, 0.4, 7, 4), M("#8a7b5a"), x, 3.5, z))); t.add(mesh(GB(40, 5, 0.3), M("#f4efe2", { transparent: true, opacity: 0.85 }), 0, 4, -10), mesh(GB(40, 5, 0.3), M("#f4efe2", { transparent: true, opacity: 0.85 }), 0, 4, 10)); t.add(mesh(GB(14, 9, 8), M("#c9a14a"), 6, 4.5, 0)); put(info(t, "Tenda del convegno con recinto · 4 x 2 cm", 11), 423, 168, { rot: 0.1 }); }
  put(mesh(GB(4, 3, 4), M("#8a8174")), 372, 186); put(info(Quad("#f5c84b", 5, 5), "Vitello d'oro · 8 mm", 11), 372, 186, { dy: 3 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; put(P(colR()), 372 + Math.cos(a) * 10, 186 + Math.sin(a) * 10, { rot: -a, info: "Popolo intorno al vitello · 1 cm" }); }
  { const s = new T.Group(); s.add(mesh(GC(0.5, 0.5, 20, 5), M("#8a5a2a"), 0, 10, 0)); const pts = []; for (let k = 0; k < 30; k++) pts.push(new T.Vector3(Math.cos(k * 0.7) * 1.5, 8 + k * 0.4, Math.sin(k * 0.7) * 1.5)); s.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.5, 5), M("#b07a2a", { metalness: 0.7, roughness: 0.3 }))); put(info(s, "Serpente di bronzo su asta · 2 cm", 11), 440, 132); }
  // 12 · Gerico e Giudici
  tappa(12);
  put(info(MuraAnello(20, 24, [3, 4, 5, 6]), "Mura di Gerico (un tratto crollato) · Ø 5 cm, alte 1,2 cm", 12), 480, 75);
  for (let i = 0; i < 9; i++) put(Pietra(3 + R() * 3, 2, 3 + R() * 3, "#c8b898"), 496 + R() * 10, 85 + R() * 10, { rot: R() * 3 });
  [[478, 70], [486, 80], [472, 82]].forEach(([x, y]) => put(Casa(7, 7, 7), x, y));
  for (let i = 0; i < 7; i++) { const a = 0.7 + i * 0.35; put(P("#ffffff"), 480 + Math.cos(a) * 30, 75 + Math.sin(a) * 30, { info: "Sacerdoti con le trombe · 1 cm" }); }
  for (let i = 0; i < 36; i++) put(mesh(GC(0.35, 0.35, 7, 4), M("#d9b13a")), 512 + (i % 6) * 3.4, 104 + Math.floor(i / 6) * 3.4, { dy: 3.5, info: "Campo di grano di Booz" });
  put(P("#7a4b8a"), 520, 126, { info: "Rut che spigola · 1 cm" }); put(P("#3a5a3a"), 532, 118, { info: "Booz · 1 cm" });
  [[455, 108], [466, 108]].forEach(([x, y], i) => { const c = mesh(GC(2, 2, 14, 10), M("#d8d0c0"), 0, 7, 0); c.rotation.z = i ? 0.3 : -0.25; const g = new T.Group(); g.add(c); put(info(g, "Colonne spezzate di Sansone · 1,5 cm", 12), x, y); });
  put(P("#7a3a1a", 1.1), 460, 110, { info: "Sansone · 1 cm" });
  // 13 · Samuele, Saul, Davide e Golia
  tappa(13);
  { const g = P("#6d6d6d", 2); g.add(mesh(GC(3, 3, 0.6, 12), M("#9a8a5a", { metalness: 0.5 }), 2.4, 4.5, 0)); g.children[g.children.length - 1].rotation.z = Math.PI / 2; put(info(g, "Golia · 2 cm (il doppio degli altri)", 13), 485, 196); }
  put(P("#c9853a"), 497, 185, { info: "Davide con la fionda · 1 cm" });
  for (let i = 0; i < 6; i++) { put(P("#4a4a6a"), 466 + i * 6, 214, { info: "Soldati filistei · 1 cm" }); put(P("#7a3b2a"), 472 + i * 6, 166, { info: "Soldati di Saul · 1 cm" }); }
  put(info(Tenda(20, 15, 11, "#b84a3a"), "Tenda reale di Saul · 2 x 1,5 cm", 13), 512, 172);
  put(P("#ffffff"), 520, 160, { info: "Samuele · 1 cm" });
  // 14 · Tempio
  tappa(14);
  put(info(Tempio(), "Tempio di Salomone · 5 x 3 cm, alto 2,5 cm", 14), 503, 300);
  { const g = new T.Group(); [[0, -33, 78, 3], [0, 33, 78, 3], [-39, 0, 3, 66], [39, 0, 3, 66]].forEach(([x, z, w, d]) => g.add(mesh(GB(w, 9, d), M("#cbbd9f", { flatShading: true }), x, 4.5, z))); [[-39, -33], [39, -33], [-39, 33], [39, 33]].forEach(([x, z]) => g.add(mesh(GB(7, 13, 7), M("#b8aa8c"), x, 6.5, z))); put(info(g, "Mura di Gerusalemme con torri", 14), 501, 301, { h: HC[14] }); }
  [[472, 278], [474, 324], [530, 280], [532, 322], [486, 324], [518, 322]].forEach(([x, y]) => put(Casa(8, 8, 8 + R() * 3), x, y, { rot: R(), info: "Case di Gerusalemme · 1-1,5 cm" }));
  put(P("#7a2a6a"), 490, 318, { info: "Re Salomone · 1 cm" });
  // 15 · Carmelo e Giona
  tappa(15);
  put(info(Pietra(13, 6, 10), "Altare di Elia con la legna · 1,5 x 1 cm", 15), 482, 403); put(Fuoco(1.3), 482, 403, { dy: 6 });
  put(P("#ffffff"), 470, 412, { info: "Elia · 1 cm" });
  for (let i = 0; i < 6; i++) put(P("#5a3a6a"), 503 + i * 4, 432 - i * 2, { info: "Profeti di Baal · 1 cm" });
  { const f = new T.Group(), b = mesh(GS(1, 14, 10), M("#5a6a7a"), 0, 0, 0); b.scale.set(15, 5, 6); f.add(b); const c = mesh(GK(5, 8, 4), M("#5a6a7a"), -16, 0, 0); c.rotation.z = Math.PI / 2; f.add(c); put(info(f, "Grande pesce di Giona · 3 cm", 15), 440, 476, { h: 6 }); }
  put(Barca(18), 456, 466, { h: 5.5, rot: 0.4, info: "Barchetta · 2 cm" });
  // 16 · Deportazioni
  tappa(16);
  { const g = new T.Group(); g.add(mesh(GB(32, 24, 10), M("#2f5fa8"), 0, 12, 0), mesh(GB(12, 16, 10.4), M("#152a4a"), 0, 8, 0), mesh(GB(33, 2, 11), M("#d4a62a", { metalness: 0.6 }), 0, 20, 0)); [-18, 18].forEach((x) => g.add(mesh(GB(7, 30, 12), M("#2f5fa8"), x, 15, 0))); put(info(g, "Porta di Babilonia · 3 x 1 cm, alta 2,5 cm", 16), 578, 398); }
  { const g = new T.Group(); g.add(mesh(GC(12, 12, 1, 24), M("#3a2a1a"), 0, 0.5, 0)); for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; const b = mesh(GB(4, 5, 2), M("#8a8174"), Math.cos(a) * 12, 2.5, Math.sin(a) * 12); b.rotation.y = -a; g.add(b); } put(info(g, "Fossa dei leoni · scavata nella schiuma", 16), 615, 432); }
  put(P("#2f5fa8"), 615, 432, { dy: 1, info: "Daniele · 1 cm" });
  [[607, 426], [623, 428], [609, 440], [622, 438]].forEach(([x, y]) => put(Leone(), x, y, { dy: 1, rot: R() * 6, info: "Leoni · 6 mm" }));
  lungo(16, -64, -24, 5, (x, y, r) => put(P("#6a6a6a"), x, y, { rot: r, info: "Prigionieri deportati · 1 cm" }));
  // 17 · Neemia
  tappa(17);
  { const g = new T.Group(); g.add(mesh(GB(50, 16, 5), M("#c2b292", { flatShading: true }), 0, 8, 0), mesh(GB(5, 8, 25), M("#c2b292"), 25, 4, 12), mesh(GB(5, 3, 25), M("#c2b292"), 25, 1.5, 37)); for (let i = 0; i < 4; i++) g.add(mesh(GC(0.4, 0.4, 20, 4), M("#8a6a40"), 30, 10, 6 + i * 7)); put(info(g, "Mura in ricostruzione · moduli 3 x 0,5 x 1,5 cm", 17), 600, 276); }
  [[588, 292], [600, 318], [612, 296]].forEach(([x, y]) => put(Casa(9, 9, 9), x, y));
  for (let i = 0; i < 14; i++) put(Pietra(3, 3, 3, "#d0c2a2"), 630 + R() * 8, 286 + R() * 30);
  [[632, 282], [634, 298], [628, 312], [606, 286]].forEach(([x, y]) => put(P("#8a5a3a"), x, y, { info: "Muratori di Neemia · 1 cm" }));
  // 18 · Betlemme
  tappa(18);
  { const g = new T.Group(); g.add(mesh(GB(30, 16, 1.5), M("#8b6a45"), 0, 8, -10), mesh(GB(1.5, 16, 20), M("#8b6a45"), -15, 8, 0), mesh(GB(1.5, 16, 20), M("#8b6a45"), 15, 8, 0)); const t = mesh(GB(34, 1.5, 24), M("#6b4a2b"), 0, 17, 0); t.rotation.x = 0.18; g.add(t, mesh(GB(6, 3, 3), M("#c9a46a"), 0, 1.5, -2)); put(info(g, "Stalla · 3 x 2 cm, alta 2 cm", 18), 600, 196); }
  put(P("#3a5aa8"), 594, 200, { info: "Maria · 1 cm" }); put(P("#8a5a2a"), 606, 200, { info: "Giuseppe · 1 cm" }); put(mesh(GS(1.5, 8, 6), M("#fff3e0", { emissive: "#ffe0a0", emissiveIntensity: 0.5 })), 600, 194, { dy: 3, info: "Gesù Bambino · 4 mm" });
  put(Bue(), 590, 190, { rot: 0.5 }); put(Asino(), 610, 190, { rot: 2.5 });
  { const g = new T.Group(); g.add(mesh(GC(0.25, 0.25, 40, 4), M("#999999"), 0, 20, 0)); const st = Stella(6); st.position.y = 42; g.add(st); put(info(g, "Stella cometa su filo · con LED", 18), 604, 172); }
  [[574, 214], [580, 220], [628, 212], [625, 222], [568, 172]].forEach(([x, y]) => put(P("#6b5a3a"), x, y, { info: "Pastori · 1 cm" }));
  for (let i = 0; i < 14; i++) put(Pecora(), 565 + R() * 24, 160 + R() * 14, { rot: R() * 6, info: "Pecore · 4 mm" });
  lungo(18, -70, -36, 11, (x, y, r, s) => { put(Cammello(), x + 5, y, { rot: r, info: "Magi con i cammelli · 1-1,2 cm" }); put(P(["#7a2a6a", "#2a5a8a", "#c9a14a"][Math.abs(s / 11) % 3 | 0]), x - 6, y, { rot: r }); });
  // 19 · Galilea
  tappa(19);
  put(Barca(20), 560, 45, { h: 5.5, rot: 0.3, info: "Barca dei pescatori · 2 cm" }); put(P("#3a5a7a"), 557, 45, { h: 8 }); put(P("#7a3a2a"), 563, 46, { h: 8 });
  for (let i = 0; i < 14; i++) put(Seduto(colR()), 612 + (i % 5) * 7, 100 + Math.floor(i / 5) * 7, { info: "Folla seduta sull'erba · 1 cm" });
  for (let i = 0; i < 6; i++) put(mesh(GC(2, 1.6, 2.5, 8), M("#b08040")), 640 + (i % 3) * 5, 62 + Math.floor(i / 3) * 5, { dy: 1.2, info: "Ceste dei pani e dei pesci · 4 mm" });
  put(P("#ffffff"), 630, 80, { info: "Gesù · 1 cm" });
  lungo(19, 38, 90, 10, (x, y, r) => { put(Palma(16), x - 12, y, {}); put(P("#3a7a5a"), x + 9, y, { rot: r, info: "Folla con rami di palma · 1 cm" }); });
  { const g = Asino(), gs = P("#ffffff", 0.9); gs.position.set(0, 4, 0); g.add(gs); lungo(19, 64, 64, 1, (x, y, r) => put(info(g, "Gesù sull'asinello · 1,2 cm", 19), x, y, { rot: r })); }
  // 20 · Calvario
  tappa(20);
  [[708, 105, 22], [720, 98, 28], [732, 105, 22]].forEach(([x, y, h]) => put(Croce(h), x, y, { info: "Croci · alte 2,5 cm (centrale 3 cm)" }));
  { const g = new T.Group(); g.add(mesh(GB(22, 15, 16), M("#8f877a", { flatShading: true }), 0, 7.5, 0), mesh(GC(5, 5, 0.6, 16), M("#1a1a1a"), 0, 6, 8.1)); g.children[1].rotation.x = Math.PI / 2; put(info(g, "Sepolcro vuoto · 2 x 1,5 cm", 20), 752, 135, { rot: -0.4 }); }
  { const p = mesh(GC(6, 6, 2.2, 18), M("#a59d8f")); p.rotation.x = Math.PI / 2; p.position.y = 6; const g = new T.Group(); g.add(p); put(info(g, "Pietra rotonda rotolata · Ø 1,2 cm", 20), 740, 150, { rot: -0.4 }); }
  put(Angelo(), 742, 140, { info: "Angelo · 1 cm" }); put(P("#5a4a8a"), 732, 146, { info: "Le donne al sepolcro · 1 cm" }); put(P("#8a3a4a"), 728, 140, {});
  put(P("#7a7a7a"), 700, 120, { info: "Soldati romani · 1 cm" });
  // 21 · Pentecoste
  tappa(21);
  { const g = new T.Group(); [[0, -12, 30, 1.5], [0, 12, 30, 1.5]].forEach(([x, z, w, d]) => g.add(mesh(GB(w, 16, d), M("#e9dfcb"), x, 8, z))); [-15, 15].forEach((x) => g.add(mesh(GB(1.5, 16, 25), M("#e9dfcb"), x, 8, 0))); put(info(g, "Cenacolo (tetto aperto) · 3 x 2,5 cm", 21), 715, 222); }
  for (let i = 0; i < 13; i++) { const a = (i / 13) * Math.PI * 2; put(P(i === 0 ? "#3a5aa8" : "#7a5a3a"), 715 + Math.cos(a) * 8, 222 + Math.sin(a) * 6, { info: "Apostoli e Maria · 1 cm" }); put(mesh(GK(1, 3, 6), M("#ff8a1a", { emissive: "#ff6a00", emissiveIntensity: 1 })), 715 + Math.cos(a) * 8, 222 + Math.sin(a) * 6, { dy: 13, info: "Lingue di fuoco · 3 mm" }); }
  for (let i = 0; i < 8; i++) put(P(colR()), 690 + R() * 10, 240 + R() * 16, { info: "Folla di tutti i popoli · 1 cm" });
  // 22 · Paolo
  tappa(22);
  put(info(Nave(), "Nave di Paolo · 3 cm", 22), 772, 322, { h: 5.5, rot: 1.2 });
  { const g = P("#8a2a2a"); g.rotation.z = Math.PI / 2; put(info(g, "Paolo caduto a terra · 1 cm", 22), 696, 334, { dy: 2 }); }
  put(Cavallo(), 708, 342, { rot: 0.8, info: "Cavallo · 1,3 cm" });
  put(info(mesh(geo("raggio", () => new T.CylinderGeometry(4, 10, 80, 16, 1, true)), M("#fff8d0", { transparent: true, opacity: 0.18, emissive: "#fff2a0", emissiveIntensity: 1, depthWrite: false, side: T.DoubleSide }), 0, 0, 0, false), "Luce dal cielo sulla via di Damasco", 22), 698, 334, { dy: 40 });
  for (let i = 0; i < 4; i++) put(P(colR()), 684 + i * 4, 318, { info: "Compagni di viaggio · 1 cm" });
  // 23 · Nuova Gerusalemme
  tappa(23);
  { const g = new T.Group(), L = 90, h = 15, mo = M("#f2d36b", { metalness: 0.55, roughness: 0.3, emissive: "#a8781a", emissiveIntensity: 0.15 });
    [[0, -L / 2, L, 3], [0, L / 2, L, 3], [-L / 2, 0, 3, L], [L / 2, 0, 3, L]].forEach(([x, z, w, d]) => g.add(mesh(GB(w, h, d), mo, x, h / 2, z)));
    for (let i = 1; i <= 3; i++) { const o = -L / 2 + (L / 4) * i; [[o, -L / 2], [o, L / 2], [-L / 2, o], [L / 2, o]].forEach(([x, z]) => g.add(mesh(GB(8, 18, 8), M("#fffaf0", { metalness: 0.2, roughness: 0.2, emissive: "#fff0c0", emissiveIntensity: 0.2 }), x, 9, z))); }
    g.add(mesh(GB(L - 6, 1, L - 6), M("#fff3c4", { transparent: true, opacity: 0.5, metalness: 0.4, roughness: 0.2 }), 0, 1, 0));
    put(info(g, "Nuova Gerusalemme · 9 x 9 cm, 12 porte (piazza staccabile: sotto c'è la pompa)", 23), NJ.x, NJ.y, { h: 10 }); }
  put(AlberoVita(), FOCE[0], FOCE[1], { h: 10, info: "Albero della vita · identico a quello dell'Eden" });
  for (let i = 0; i < 18; i++) put(P(i % 3 ? "#ffffff" : colR()), 700 + R() * 70, 405 + R() * 60, { h: 11, info: "Popoli in festa · 1 cm" });
  // Ponticelli
  tappa(0);
  PONTI.forEach(([x, y]) => { let k = 0, bd = 1e9; CR.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; k = i; } }); const a = CR[Math.max(0, k - 3)], b = CR[Math.min(CR.length - 1, k + 3)]; put(info(Ponte(), "Ponticello · 4 x 2 cm (dove il fiume incrocia il sentiero)"), x, y, { h: LIV[k] + 3, rot: -Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2 }); });

  const gScene = new T.Group(); Object.values(GT).forEach((g) => gScene.add(g));
  Object.entries(GT).forEach(([n, g]) => reg(g, 10, 99, "scene", "cade"));

  /* =========================================================
     FASE 11 · Riempimento "presepe napoletano" (instanced)
     ========================================================= */
  FASE_MAT = 11;
  {
    const tiles = TAPPE.map((t) => [t.x, t.y]);
    const vietati = [[195, 150, 50], [305, 82, 28], [360, 436, 32], [NJ.x, NJ.y, 55], [565, 45, 30], [445, 474, 34], [503, 300, 42], [480, 75, 26], [405, 285, 36], [SORGENTE[0], SORGENTE[1], 24]];
    const lista = { persona: [], pecora: [], albero: [], palma: [], tenda: [], casa: [], fiore: [], cespuglio: [], roccia: [], cammello: [] };
    const tipi = {
      origini: ["albero", "cespuglio", "fiore", "fiore", "albero", "pecora", "cespuglio", "roccia"],
      patriarchi: ["pecora", "pecora", "cammello", "tenda", "palma", "persona", "palma", "roccia"],
      re: ["casa", "persona", "albero", "pecora", "persona", "casa", "cespuglio", "roccia"],
      vangeli: ["persona", "pecora", "palma", "pecora", "persona", "casa", "albero", "cespuglio"],
    };
    const r = rng(2024); let fatti = 0, prove = 0;
    while (fatti < 820 && prove < 20000) {
      prove++;
      const x = 8 + r() * 784, y = 8 + r() * 484;
      let ok = true;
      for (let q = 0; q < CP4.length && ok; q++) if ((CP4[q][0] - x) ** 2 + (CP4[q][1] - y) ** 2 < 440) ok = false;
      for (let q = 0; q < CR.length && ok; q += 3) if ((CR[q][0] - x) ** 2 + (CR[q][1] - y) ** 2 < 110) ok = false;
      if (!ok || tiles.some(([tx, ty]) => Math.abs(tx - x) < 41 && Math.abs(ty - y) < 41)) continue;
      if (vietati.some(([vx, vy, vr]) => (vx - x) ** 2 + (vy - y) ** 2 < vr * vr) || dentro(MED, x, y) || hAt(x, y) < 5) continue;
      let z = "origini"; for (const [k, p] of Object.entries(ZONE_POLY)) if (dentro(p, x, y)) { z = k; break; }
      const t = tipi[z][Math.floor(r() * 8)], h = hAt(x, y), rot = r() * 6.28;
      if (t === "pecora") { for (let k = 0; k < 4 + (r() * 4 | 0); k++) { const px = x + (r() - 0.5) * 14, py = y + (r() - 0.5) * 10; lista.pecora.push([px, py, hAt(px, py), r() * 6.28, 1]); } lista.persona.push([x + 8, y, hAt(x + 8, y), 0, 1, "#6b5a3a"]); }
      else if (t === "persona") { for (let k = 0; k < 2 + (r() * 4 | 0); k++) { const px = x + (r() - 0.5) * 12, py = y + (r() - 0.5) * 10; lista.persona.push([px, py, hAt(px, py), 0, 1, cols[Math.floor(r() * cols.length)]]); } }
      else if (t === "fiore") { for (let k = 0; k < 6; k++) lista.fiore.push([x + (r() - 0.5) * 10, y + (r() - 0.5) * 10, h + 1, 0, 1, ["#f2c14e", "#e86a8a", "#ffffff", "#b07ae0"][k % 4]]); }
      else lista[t].push([x, y, h, rot, 0.8 + r() * 0.5]);
      fatti++;
    }
    const gPieno = new T.Group();
    const dummy = new T.Object3D(), col = new T.Color();
    function inst(g, m, arr, dy = 0, sc = [1, 1, 1], colori = false) {
      if (!arr.length) return;
      const im = new T.InstancedMesh(g, m, arr.length); im.castShadow = true; im.receiveShadow = true;
      arr.forEach((a, i) => { dummy.position.set(a[0] - 400, a[2] + dy * (a[4] || 1), a[1] - 250); dummy.rotation.set(0, a[3], 0); dummy.scale.set(sc[0] * (a[4] || 1), sc[1] * (a[4] || 1), sc[2] * (a[4] || 1)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); if (colori) im.setColorAt(i, col.set(a[5])); });
      gPieno.add(im);
    }
    inst(GC(1.3, 2.2, 7, 8), M("#ffffff"), lista.persona, 3.5, [1, 1, 1], true);
    inst(GS(1.5, 8, 6), M(PELLE), lista.persona, 8.6);
    inst(GS(1, 8, 6), M("#f6f2e6"), lista.pecora, 2.4, [2.6, 1.8, 1.8]);
    inst(GC(0.9, 1.5, 13, 6), M("#6b4a2b"), lista.albero, 6.5);
    inst(new T.IcosahedronGeometry(7, 1), M("#3f7d34", { flatShading: true }), lista.albero, 17);
    inst(GC(0.7, 1.1, 18, 6), M("#7a5a35"), lista.palma, 9);
    inst(GK(8, 3, 7), M("#3f7a32", { flatShading: true }), lista.palma, 18.5);
    inst(geo("tenda11|9|8", () => { const s = new T.Shape(); s.moveTo(-5.5, 0); s.lineTo(5.5, 0); s.lineTo(0, 8); s.lineTo(-5.5, 0); const e = new T.ExtrudeGeometry(s, { depth: 9, bevelEnabled: false }); e.translate(0, 0, -4.5); return e; }), M("#e6d3a8", { side: T.DoubleSide }), lista.tenda, 0);
    inst(GB(9, 9, 9), M("#e9dfcb"), lista.casa, 4.5);
    inst(GB(10, 1, 10), M("#cdbfa3"), lista.casa, 9.5);
    inst(GS(1.1, 5, 4), M("#ffffff"), lista.fiore, 0, [1, 1, 1], true);
    inst(GS(3, 7, 5), M("#4f8a3a", { flatShading: true }), lista.cespuglio, 2);
    inst(new T.DodecahedronGeometry(3, 0), M("#8f877a", { flatShading: true }), lista.roccia, 1.5);
    inst(GS(1, 10, 8), M("#c49a5a"), lista.cammello, 7.4, [5, 2.6, 2.2]);
    inst(GS(2, 8, 6), M("#c49a5a"), lista.cammello, 9.6);
    reg(gPieno, 11, 99, "pieno", "cade");
  }

  /* =========================================================
     FASE 9 · Luci a 12 V
     ========================================================= */
  FASE_MAT = 9;
  const cGlow = document.createElement("canvas"); cGlow.width = cGlow.height = 64;
  { const x = cGlow.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const texGlow = new T.CanvasTexture(cGlow);
  const gLuci = new T.Group(), ALONI = [], PUNTI = [];
  LUCI.forEach((l) => {
    const c = { calda: "#ffd27a", fuoco: "#ff8a1a", fredda: "#e8f4ff", stella: "#fff2a8" }[l.t];
    const h = hAt(l.x, l.y) + (l.t === "stella" ? 42 : l.t === "fuoco" ? 6 : 8);
    gLuci.add(mesh(GS(1.8, 8, 6), M(c, { emissive: c, emissiveIntensity: 1 }), l.x - 400, h, l.y - 250, false));
    const sp = new T.Sprite(new T.SpriteMaterial({ map: texGlow, color: c, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
    sp.position.set(l.x - 400, h, l.y - 250); sp.scale.setScalar(l.t === "stella" ? 50 : 42); sp.userData = { fuoco: l.t === "fuoco", base: l.t === "stella" ? 50 : 42 }; gLuci.add(sp); ALONI.push(sp);
    const pl = new T.PointLight(c, 0, 150, 2); pl.position.set(l.x - 400, h + 4, l.y - 250); pl.userData.fuoco = l.t === "fuoco"; gLuci.add(pl); PUNTI.push(pl);
  });
  { const L = 94, mo = M("#fff4c2", { emissive: "#fff0b0", emissiveIntensity: 1 }); [[0, -L / 2, L, 1.5], [0, L / 2, L, 1.5], [-L / 2, 0, 1.5, L], [L / 2, 0, 1.5, L]].forEach(([x, z, w, d]) => gLuci.add(mesh(GB(w, 1.5, d), mo, NJ.x - 400 + x, 26, NJ.y - 250 + z, false)));
    [[-25, -25], [25, 25]].forEach(([dx, dz]) => { const pl = new T.PointLight("#fff2c0", 0, 220, 2); pl.position.set(NJ.x - 400 + dx, 40, NJ.y - 250 + dz); gLuci.add(pl); PUNTI.push(pl); });
    const sp = new T.Sprite(new T.SpriteMaterial({ map: texGlow, color: "#fff2c0", blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 })); sp.position.set(NJ.x - 400, 30, NJ.y - 250); sp.scale.setScalar(170); sp.userData = { base: 170 }; gLuci.add(sp); ALONI.push(sp); }
  // cavi sotto la base (fase 9)
  const gCavi = new T.Group();
  LUCI.forEach((l) => gCavi.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(l.x, l.y, -15), V(l.x, l.y, -24), V(l.x, 488, -24), V(780, 488, -24), V(800, 470, -40)]), 30, 0.8, 4), M("#c62828"), 0, 0, 0, false)));
  reg(gLuci, 9, 99, "luci", "nessuna");
  reg(gCavi, 9, 99, "sotto", "nessuna");

  /* ---------------- FASE 12 · Targhette ---------------- */
  FASE_MAT = 12;
  const gTarghe = new T.Group();
  TAPPE.forEach((t) => {
    const c = document.createElement("canvas"); c.width = 384; c.height = 140; const x = c.getContext("2d");
    x.fillStyle = "#fffaf0"; x.fillRect(0, 0, 384, 140); x.strokeStyle = "#7a5a2a"; x.lineWidth = 8; x.strokeRect(4, 4, 376, 132);
    x.fillStyle = "#7a3b12"; x.font = "bold 64px Georgia, serif"; x.fillText(String(t.n), 18, 80);
    x.fillStyle = "#2b2016"; x.font = "bold 40px Arial, sans-serif"; x.fillText(ETICHETTE[t.n], t.n > 9 ? 98 : 72, 62);
    x.fillStyle = "#6b5a44"; x.font = "italic 30px Georgia, serif"; x.fillText(t.rif.split(";")[0], t.n > 9 ? 98 : 72, 108);
    const tex = new T.CanvasTexture(c); tex.anisotropy = 4;
    const g = new T.Group(), pl = mesh(geo("targa", () => new T.BoxGeometry(30, 11, 1)), [M("#d8c8a8"), M("#d8c8a8"), M("#d8c8a8"), M("#d8c8a8"), regMat(new T.MeshStandardMaterial({ map: tex, roughness: 0.7 }), 12), M("#d8c8a8")]);
    pl.position.y = 12; pl.rotation.x = -0.5; g.add(pl, mesh(GC(0.5, 0.5, 12, 4), M("#8a6a40"), 0, 6, 0));
    const px = t.n === 23 ? t.x - 22 : t.x > 680 ? t.x - 56 : t.x + 55, py = t.n === 23 ? t.y - 60 : t.y + 8;
    g.position.copy(V(px, py, hAt(px, py))); gTarghe.add(g);
  });
  reg(gTarghe, 12, 99, "targhe", "cade");

  /* ---------------- FASE 13 · Sfondo dipinto ---------------- */
  FASE_MAT = 13;
  function texCielo(w, h, stops, stelle) { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); const gr = x.createLinearGradient(0, 0, w, 0); stops.forEach(([o, col]) => gr.addColorStop(o, col)); x.fillStyle = gr; x.fillRect(0, 0, w, h); const g2 = x.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, "rgba(0,0,30,.35)"); g2.addColorStop(1, "rgba(255,255,255,.12)"); x.fillStyle = g2; x.fillRect(0, 0, w, h); for (let i = 0; i < stelle; i++) { const sx = Math.random() * w, a = 1 - Math.abs(sx / w - 0.55) * 1.6; if (a <= 0) continue; x.fillStyle = `rgba(255,255,255,${a * (0.4 + Math.random() * 0.6)})`; x.beginPath(); x.arc(sx, Math.random() * h * 0.8, Math.random() * 2.2 + 0.4, 0, 7); x.fill(); } return new T.CanvasTexture(c); }
  const gSfondo = new T.Group();
  { const p = mesh(new T.PlaneGeometry(816, 300), M("#ffffff", { map: texCielo(2048, 760, [[0, "#f3b07a"], [0.16, "#6a8fd0"], [0.45, "#0d1640"], [0.8, "#1d2a6a"], [1, "#f6d77a"]], 900), roughness: 1 }), 0, 135, -258, false); gSfondo.add(p, mesh(GB(820, 300, 4), M("#8a6a44"), 0, 135, -261)); }
  [[-1, [[0, "#f3b07a"], [1, "#6a8fd0"]]], [1, [[0, "#1d2a6a"], [1, "#f6d77a"]]]].forEach(([s, st]) => { const p = mesh(new T.PlaneGeometry(500, 300), M("#ffffff", { map: texCielo(1024, 600, st, s > 0 ? 200 : 0), roughness: 1 }), s * 406, 135, 0, false); p.rotation.y = -s * Math.PI / 2; gSfondo.add(p); });
  reg(gSfondo, 13, 99, "sfondo", "cade");

  /* ---------------- zone cliccabili delle tappe ---------------- */
  const gHit = new T.Group(); scene.add(gHit);
  const matHit = new T.MeshBasicMaterial({ visible: false });
  TAPPE.forEach((t) => { const m = new T.Mesh(GB(75, 6, 75), matHit); m.position.copy(V(t.x, t.y, HC[t.n] + 2)); m.userData.tappa = t.n; gHit.add(m); });
  const anello = new T.LineSegments(new T.EdgesGeometry(GB(77, 2, 77)), new T.LineBasicMaterial({ color: "#ffc400" })); anello.visible = false; scene.add(anello);

  /* =========================================================
     STATO, FASI, ANIMAZIONI
     ========================================================= */
  const ui = { fase: 1, focus: false, sotto: false, esploso: 0, esplosoT: 0, misura: false };
  const ORA = {
    alba:     { bg: "#f6c49a", hemi: 0.45, hc: "#ffd9b0", sole: 0.7, sc: "#ffb07a", pos: [-900, 260, 200], luci: 0.55 },
    giorno:   { bg: "#bcd6ee", hemi: 0.5, hc: "#dfeeff", sole: 0.72, sc: "#fff3dc", pos: [-420, 900, 520], luci: 0 },
    tramonto: { bg: "#e48e6c", hemi: 0.4, hc: "#ffb090", sole: 0.6, sc: "#ff8a5a", pos: [900, 240, 260], luci: 0.65 },
    notte:    { bg: "#0b1030", hemi: 0.13, hc: "#4a5a9a", sole: 0.12, sc: "#9fb4ff", pos: [300, 900, -300], luci: 1 },
  };
  let oraCorr = "giorno"; const oraVal = { bg: new T.Color(ORA.giorno.bg), hemi: 0.5, hc: new T.Color(ORA.giorno.hc), sole: 0.72, sc: new T.Color(ORA.giorno.sc), pos: new T.Vector3(...ORA.giorno.pos), luci: 0 };
  let centralina = null;

  function aggiornaVisibilita(anima, prima) {
    const f = ui.fase;
    pezzi.forEach((p) => {
      let vis = f >= p.from && f <= p.until;
      if (p.cat === "sotto") vis = vis && (f === p.from || ui.sotto || (p.from === 3 && f === 3));
      if (p.cat === "carta") vis = f === 1;
      p.obj.visible = vis;
    });
    gSotto.visible = f >= 3 && (f === 3 || ui.sotto);
    alimentatore.visible = f >= 3; // sempre visibile fuori dalla base
    tavolo.visible = !(ui.sotto && camera.position.y < -20);
    const st = f >= 8 ? "dipinto" : f >= 6 ? "gesso" : f >= 5 ? "scavato" : "schiuma";
    impostaTerreno(st, anima);
    base.material.transparent = ui.sotto || f === 3; base.material.opacity = base.material.transparent ? 0.38 : 1; base.material.depthWrite = !base.material.transparent;
    gLaghi.visible = f >= 8;
    if (anima) avviaAnimazioni(f, prima);
    applicaEvidenza();
  }
  // Animazioni d'ingresso dei pezzi nuovi
  const animInCorso = [];
  function avviaAnimazioni(f, prima) {
    if (prima !== f - 1) return;
    const t0 = performance.now();
    pezzi.filter((p) => p.from === f).forEach((p, i) => {
      if (p.anim === "cade") { const d = p.cat === "scene" ? (p.obj.userData.tappa || 0) * 110 : i * 60; animInCorso.push({ p, t0: t0 + d, dur: 900, tipo: "cade" }); p.obj.position.y = p.y0 + 260; }
      if (p.anim === "schiuma") { animInCorso.push({ p, t0, dur: 1600, tipo: "cresce" }); p.obj.scale.y = 0.01; }
    });
    if (f === 7) { aGeo.setDrawRange(0, 0); animInCorso.push({ t0, dur: 4500, tipo: "acqua" }); }
  }
  // Evidenzia novità e "solo novità"
  const ORO = new T.Color("#ffb300");
  function applicaEvidenza() {
    const f = ui.fase;
    mats.forEach((m) => {
      const ud = m.userData; if (ud.fase === undefined) return;
      const vecchio = ui.focus && ud.fase !== f && f < 14;
      m.transparent = vecchio ? true : ud.tr0; m.opacity = vecchio ? 0.12 : ud.op0; m.depthWrite = vecchio ? false : ud.dw0;
      if (m === base.material && (ui.sotto || f === 3)) { m.transparent = true; m.opacity = Math.min(m.opacity, 0.38); m.depthWrite = false; }
      m.needsUpdate = true;
    });
  }

  function vaiFase(f) { const prima = ui.fase; ui.fase = f; aggiornaVisibilita(true, prima); }

  /* ---------------- camera: voli e viste ---------------- */
  let volo = null, tour = null;
  function vola(pos, tgt, dur = 1200) { volo = { p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos.clone(), t1: tgt.clone(), t0: performance.now(), dur }; }
  const VISTE = {
    davanti: [new T.Vector3(0, 560, 660), new T.Vector3(0, 20, 30)],
    alto: [new T.Vector3(0, 1080, 2), new T.Vector3(0, 0, 0)],
    lato: [new T.Vector3(-860, 300, 120), new T.Vector3(0, 30, 0)],
    sotto: [new T.Vector3(60, -460, 420), new T.Vector3(0, -30, 0)],
    vicino: [new T.Vector3(-260, 140, 300), new T.Vector3(-150, 40, 20)],
    esploso: [new T.Vector3(-640, 360, 780), new T.Vector3(0, 10, 0)],
  };
  const fattore = () => Math.max(1, 1.55 / camera.aspect);
  function vista(n) { fermaTour(); const v = VISTE[n], f = n === "vicino" || n === "sotto" ? 1 : fattore(); vola(v[1].clone().add(v[0].clone().sub(v[1]).multiplyScalar(f)), v[1]); }
  function volaTappa(n, apri) { const t = TAPPE[n - 1], tg = V(t.x, t.y, HC[n] + 12); vola(tg.clone().add(new T.Vector3(n > 19 ? -90 : 70, 120, 150)), tg, 1300); if (apri && window.apriTappa) setTimeout(() => window.apriTappa(n), 1350); }

  const didascalia = document.createElement("div"); didascalia.className = "didascalia3d"; didascalia.hidden = true; wrap.appendChild(didascalia);
  function mostraDidascalia(html) { didascalia.innerHTML = html; didascalia.hidden = !html; }
  function fermaTour() { if (tour) { tour = null; controls.enabled = true; mostraDidascalia(""); document.dispatchEvent(new CustomEvent("diorama3d:tour", { detail: false })); } }
  function tourFiume() {
    fermaTour();
    const pts = CR.filter((_, i) => i % 6 === 0).map((p, i) => V(p[0], p[1], LIV[i * 6] + 28));
    tour = { tipo: "fiume", curva: new T.CatmullRomCurve3(pts), t0: performance.now(), dur: 48000 };
    controls.enabled = false; document.dispatchEvent(new CustomEvent("diorama3d:tour", { detail: true }));
  }
  function tourTappe() { fermaTour(); tour = { tipo: "tappe", n: 0, t0: performance.now() - 99999 }; controls.enabled = false; document.dispatchEvent(new CustomEvent("diorama3d:tour", { detail: true })); }

  /* ---------------- interazione: passaggio del mouse, clic, misura ---------------- */
  const ray = new T.Raycaster(), mouse = new T.Vector2();
  const tip = document.createElement("div"); tip.className = "tip3d"; tip.hidden = true; wrap.appendChild(tip);
  let giu = null, ultimoHover = 0, tipFisso = 0;
  function colpo(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const obj = [gHit]; if (GT[1].visible) obj.unshift(gScene); if (ui.fase >= 4) obj.push(terreno); else if (ui.fase >= 2) obj.push(base);
    const hits = ray.intersectObjects(obj, true).filter((h) => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
    return hits;
  }
  function trovaInfo(o) { while (o) { if (o.userData && o.userData.info) return o; o = o.parent; } return null; }
  function tappaDi(o) { while (o) { if (o.userData && o.userData.tappa) return o.userData.tappa; o = o.parent; } return 0; }
  renderer.domElement.addEventListener("pointerdown", (e) => { giu = [e.clientX, e.clientY]; if (tour) fermaTour(); });
  renderer.domElement.addEventListener("pointermove", (e) => {
    const now = performance.now(); if (now - ultimoHover < 70 || tipFisso > now) return; ultimoHover = now;
    const h = colpo(e)[0]; const r = wrap.getBoundingClientRect();
    if (!h) { tip.hidden = true; anello.visible = false; renderer.domElement.style.cursor = ""; return; }
    const io = trovaInfo(h.object), n = tappaDi(h.object);
    if (io) tip.innerHTML = `<b>${io.userData.info}</b>${n ? `<small>Tappa ${n} · ${TAPPE[n - 1].nome}</small>` : ""}`;
    else if (n) tip.innerHTML = `<b>${n}. ${TAPPE[n - 1].nome}</b><small>${TAPPE[n - 1].sotto} · tocca per la scheda</small>`;
    else if (ui.misura) tip.innerHTML = `<b>📏 Tocca due punti</b>`;
    else { tip.hidden = true; anello.visible = false; renderer.domElement.style.cursor = ""; return; }
    tip.hidden = false; tip.style.left = Math.min(r.width - 230, e.clientX - r.left + 14) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px";
    renderer.domElement.style.cursor = "pointer";
    if (n) { anello.visible = true; anello.position.copy(V(TAPPE[n - 1].x, TAPPE[n - 1].y, HC[n] + 1)); } else anello.visible = false;
  });
  renderer.domElement.addEventListener("pointerleave", () => { tip.hidden = true; anello.visible = false; });
  // misura
  const gMisura = new T.Group(); scene.add(gMisura); let puntoA = null;
  const mMis = new T.MeshBasicMaterial({ color: "#e53935", depthTest: false });
  function pulisciMisura() { gMisura.clear(); puntoA = null; }
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!giu || Math.hypot(e.clientX - giu[0], e.clientY - giu[1]) > 6) return;
    const hits = colpo(e), h = hits[0]; if (!h) return;
    const r = wrap.getBoundingClientRect();
    if (ui.misura) {
      const hp = hits.find((q) => q.object === terreno || q.object === base) || h; const p = hp.point.clone();
      const pal = new T.Mesh(GS(3, 10, 8), mMis); pal.position.copy(p); pal.renderOrder = 9; gMisura.add(pal);
      if (!puntoA) { if (gMisura.children.length > 1) { gMisura.clear(); gMisura.add(pal); } puntoA = p; tip.innerHTML = "<b>📏 Ora tocca il secondo punto</b>"; }
      else {
        const linea = new T.Line(new T.BufferGeometry().setFromPoints([puntoA, p]), new T.LineBasicMaterial({ color: "#e53935", depthTest: false, linewidth: 2 })); linea.renderOrder = 9; gMisura.add(linea);
        const dp = Math.hypot(p.x - puntoA.x, p.z - puntoA.z) / 10, dh = Math.abs(p.y - puntoA.y) / 10;
        tip.innerHTML = `<b>📏 ${dp.toFixed(1).replace(".", ",")} cm in pianta</b><small>dislivello ${dh.toFixed(1).replace(".", ",")} cm</small>`; puntoA = null;
      }
      tip.hidden = false; tip.style.left = Math.min(r.width - 230, e.clientX - r.left + 14) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px"; tipFisso = performance.now() + 2500;
      return;
    }
    const n = tappaDi(h.object), io = trovaInfo(h.object);
    if (io && !(h.object.parent === gHit)) {
      tip.innerHTML = `<b>${io.userData.info}</b>${n ? `<button class="tip-btn" data-n="${n}">Scheda tappa ${n} ›</button>` : ""}`;
      tip.hidden = false; tip.style.left = Math.min(r.width - 230, e.clientX - r.left + 14) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px"; tipFisso = performance.now() + 4000;
      const b = tip.querySelector(".tip-btn"); if (b) b.onclick = () => { tip.hidden = true; volaTappa(n, true); };
    } else if (n) volaTappa(n, true);
  });

  /* ---------------- dimensioni ---------------- */
  function ridimensiona() { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(ridimensiona).observe(wrap); ridimensiona();
  { const v = VISTE.davanti, f = fattore(); camera.position.copy(v[1].clone().add(v[0].clone().sub(v[1]).multiplyScalar(f))); controls.target.copy(v[1]); }

  /* ---------------- ciclo di disegno ---------------- */
  let tPrec = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!wrap.offsetParent || document.hidden) return;
    const dt = Math.min(0.05, (now - tPrec) / 1000); tPrec = now; const t = now / 1000;
    // animazioni d'ingresso
    for (let i = animInCorso.length - 1; i >= 0; i--) {
      const a = animInCorso[i], k = Math.min(1, Math.max(0, (now - a.t0) / a.dur));
      if (a.tipo === "cade") a.p.obj.position.y = a.p.y0 + 260 * (1 - rimbalzo(k));
      if (a.tipo === "cresce") a.p.obj.scale.y = Math.max(0.01, ease(k));
      if (a.tipo === "acqua") aGeo.setDrawRange(0, Math.floor(aIdx.length * k / 6) * 6);
      if (k >= 1) { if (a.tipo === "acqua") aGeo.setDrawRange(0, Infinity); animInCorso.splice(i, 1); }
    }
    if (animColori) { const k = ease(Math.min(1, (now - animColori.t0) / animColori.dur)); for (let i = 0; i < tCol.length; i++) tCol[i] = lerp(animColori.da[i], animColori.a[i], k); tGeo.attributes.color.needsUpdate = true; if (k >= 1) animColori = null; }
    if (animAltezze) { const k = ease(Math.min(1, (now - animAltezze.t0) / animAltezze.dur)); const H = new Float32Array(NX * NY); for (let i = 0; i < H.length; i++) H[i] = lerp(animAltezze.da[i], animAltezze.a[i], k); applicaAltezze(H); if (k >= 1) animAltezze = null; }
    // vista esplosa
    ui.esplosoT += (ui.esploso - ui.esplosoT) * Math.min(1, dt * 4);
    Object.entries(CAT).forEach(([k, g]) => (g.position.y = ESPLOSO[k] * ui.esplosoT));
    // acqua che scorre
    texAcqua.offset.y -= dt * 0.9;
    spruzzi.forEach((s) => { const k = (t * 1.6 + s.userData.ph) % 1; s.position.y = s.userData.y0 + Math.sin(k * Math.PI) * 4; s.scale.setScalar(0.6 + k); });
    zampillo.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
    gocce.forEach((g) => { g.userData.u = (g.userData.u + dt * 0.06) % 1; g.position.copy(tuboCurva.getPointAt(g.userData.u)); });
    // fuochi e stelle
    FUOCHI.forEach((f, i) => { f.children[f.children.length - 2].scale.y = 0.8 + Math.sin(t * 13 + i) * 0.15 + Math.random() * 0.12; f.children[f.children.length - 1].scale.y = 0.8 + Math.sin(t * 17 + i * 2) * 0.2; });
    STELLE.forEach((s, i) => { s.rotation.y = t * 0.6 + i; });
    // ora del giorno (centralina)
    const O = ORA[oraCorr], k = Math.min(1, dt * 2.2);
    oraVal.bg.lerp(new T.Color(O.bg), k); oraVal.hc.lerp(new T.Color(O.hc), k); oraVal.sc.lerp(new T.Color(O.sc), k); oraVal.pos.lerp(new T.Vector3(...O.pos), k);
    oraVal.hemi = lerp(oraVal.hemi, O.hemi, k); oraVal.sole = lerp(oraVal.sole, O.sole, k); oraVal.luci = lerp(oraVal.luci, O.luci, k);
    scene.background.copy(oraVal.bg); scene.fog.color.copy(oraVal.bg); hemi.color.copy(oraVal.hc); hemi.intensity = oraVal.hemi; amb.intensity = oraVal.hemi * 0.12;
    sole.color.copy(oraVal.sc); sole.intensity = oraVal.sole; sole.position.copy(oraVal.pos);
    ALONI.forEach((a) => { const fl = a.userData.fuoco ? 0.85 + Math.random() * 0.3 : 1; a.material.opacity = (0.35 + oraVal.luci * 0.65) * fl; a.scale.setScalar(a.userData.base * (0.8 + oraVal.luci * 0.5) * fl); });
    PUNTI.forEach((p) => (p.intensity = oraVal.luci * 1.6 * (p.userData.fuoco ? 0.75 + Math.random() * 0.5 : 1)));
    // evidenzia le novità: bagliore dorato che pulsa
    const puls = 0.5 + 0.5 * Math.sin(t * 3.2), f = ui.fase;
    mats.forEach((m) => { const ud = m.userData; if (!ud.em0 || ud.fase === undefined) return; if (ud.fase === f && f < 14 && f !== 9) m.emissive.copy(ud.em0).lerp(ORO, 0.12 + puls * 0.2); else m.emissive.copy(ud.em0); });
    // voli della camera
    if (volo) { const q = ease(Math.min(1, (now - volo.t0) / volo.dur)); camera.position.lerpVectors(volo.p0, volo.p1, q); controls.target.lerpVectors(volo.t0v, volo.t1, q); if (q >= 1) volo = null; }
    if (tour && tour.tipo === "fiume") {
      const u = Math.min(1, (now - tour.t0) / tour.dur), p = tour.curva.getPointAt(u), q = tour.curva.getPointAt(Math.min(1, u + 0.02));
      camera.position.copy(p).add(new T.Vector3(0, 10, 0)); controls.target.copy(q);
      let best = 1, bd = 1e9; TAPPE.forEach((tt) => { const d = (tt.x - 400 - p.x) ** 2 + (tt.y - 250 - p.z) ** 2; if (d < bd) { bd = d; best = tt.n; } });
      mostraDidascalia(`<b>Lungo il fiume della vita</b><span>vicino a: ${best}. ${TAPPE[best - 1].nome}</span><i style="width:${u * 100}%"></i>`);
      if (u >= 1) fermaTour();
    }
    if (tour && tour.tipo === "tappe" && now - tour.t0 > 3300) {
      tour.n++; tour.t0 = now;
      if (tour.n > 23) fermaTour(); else { const tt = TAPPE[tour.n - 1]; volaTappa(tour.n); mostraDidascalia(`<b>${tt.n}. ${tt.nome}</b><span>${tt.sotto} · <em>${tt.rif}</em></span><i style="width:${(tour.n / 23) * 100}%"></i>`); }
    }
    if (!tour) controls.update();
    else camera.lookAt(controls.target);
    renderer.render(scene, camera);
  }
  impostaTerreno("schiuma", false);

  /* =========================================================
     ANTEPRIMA 3D DELLA TAPPA (dentro la scheda)
     ========================================================= */
  let prev = null;
  function anteprima(n, el) {
    if (!prev) {
      const r = new T.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true;
      const sc = new T.Scene(); sc.background = new T.Color("#e9eef5");
      sc.add(new T.HemisphereLight("#ffffff", "#8a7a5a", 0.75)); const d = new T.DirectionalLight("#fff3dc", 0.8); d.position.set(-150, 300, 200); d.castShadow = true; d.shadow.mapSize.set(1024, 1024); Object.assign(d.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150 }); d.shadow.camera.updateProjectionMatrix(); sc.add(d);
      const cam = new T.PerspectiveCamera(40, 1.6, 1, 4000); const ct = new T.OrbitControls(cam, r.domElement); ct.enableDamping = true; ct.autoRotate = true; ct.autoRotateSpeed = 1.6;
      prev = { r, sc, cam, ct, grp: null, attivo: false };
      const loop = () => { requestAnimationFrame(loop); if (!prev.attivo) return; prev.ct.update(); prev.r.render(prev.sc, prev.cam); };
      loop();
    }
    if (prev.grp) prev.sc.remove(prev.grp);
    const grp = new T.Group(), t = TAPPE[n - 1];
    const src = GT[n].clone(true); src.position.set(0, 0, 0); src.visible = true; src.traverse((o) => (o.visible = true)); grp.add(src);
    // pezzetto di terreno dipinto intorno alla tappa
    const R0 = 70, i0 = Math.max(0, Math.floor((t.x - R0) / ST)), i1 = Math.min(NX - 1, Math.ceil((t.x + R0) / ST)), j0 = Math.max(0, Math.floor((t.y - R0) / ST)), j1 = Math.min(NY - 1, Math.ceil((t.y + R0) / ST));
    const pos = [], col = [], id = [], w = i1 - i0 + 1, D = COLORI.dipinto;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * NX + i; pos.push(i * ST - 400, HCAR[k], j * ST - 250); col.push(D[k * 3], D[k * 3 + 1], D[k * 3 + 2]); }
    for (let j = 0; j < j1 - j0; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i; id.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
    const g = new T.BufferGeometry(); g.setIndex(id); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const tm = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); tm.receiveShadow = true; grp.add(tm);
    prev.sc.add(grp); prev.grp = grp;
    const c = V(t.x, t.y, HC[n] + 10);
    prev.cam.position.copy(c).add(new T.Vector3(70, 75, 95)); prev.ct.target.copy(c);
    el.innerHTML = ""; el.appendChild(prev.r.domElement);
    const ww = el.clientWidth || 500, hh = el.clientHeight || 240; prev.r.setSize(ww, hh, false); prev.r.domElement.style.width = "100%"; prev.r.domElement.style.height = "100%"; prev.cam.aspect = ww / hh; prev.cam.updateProjectionMatrix();
    prev.attivo = true;
  }
  function fermaAnteprima() { if (prev) prev.attivo = false; }

  /* ---------------- interfaccia pubblica ---------------- */
  window.Scena3D = {
    fase: vaiFase,
    opzioni(o) { Object.assign(ui, o); if (o.misura === false) pulisciMisura(); aggiornaVisibilita(false); },
    vista, volaTappa, tourFiume, tourTappe, fermaTour,
    esploso(v) { ui.esploso = v ? 1 : 0; },
    ora(n) { if (centralina) { clearInterval(centralina); centralina = null; } oraCorr = n; },
    centralina() { if (centralina) { clearInterval(centralina); centralina = null; return false; } const seq = ["alba", "giorno", "tramonto", "notte"]; let i = seq.indexOf(oraCorr); centralina = setInterval(() => { i = (i + 1) % 4; oraCorr = seq[i]; document.dispatchEvent(new CustomEvent("diorama3d:ora", { detail: oraCorr })); }, 4500); return true; },
    anteprima, fermaAnteprima,
    pronta: true,
  };
  requestAnimationFrame(frame);
})();
