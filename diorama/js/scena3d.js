/* =========================================================
   DIORAMA IN 3D REALISTICO (Three.js r147)
   Misure in MILLIMETRI: X = sinistra→destra (0..800),
   Z = fondo→davanti (0..500), Y = altezza. Una persona = 10 mm.
   Grafica: cielo fisico, riflessi d'ambiente, ombre morbide,
   acqua lucida, erba al vento, bagliore (bloom), effetto miniatura.
   ========================================================= */
(function () {
  const wrap = document.getElementById("vista3d");
  if (!wrap) return;
  if (!window.THREE || !THREE.OrbitControls || !THREE.Sky || !THREE.BufferGeometryUtils) { window.Scena3D = null; return; }
  const T = THREE;
  T.ColorManagement.legacyMode = false;

  // Segnaposto: l'app può chiamare questi metodi anche prima che il 3D sia pronto
  const coda = { fase: 1, opz: {} };
  const S3 = (window.Scena3D = {
    pronta: false,
    fase(f) { coda.fase = f; }, opzioni(o) { Object.assign(coda.opz, o); },
    vista() {}, volaTappa() {}, tourFiume() {}, tourTappe() {}, fermaTour() {}, esploso() {}, ora() {},
    centralina() { return false; }, anteprima() {}, fermaAnteprima() {}, miniatura() {}, impostaQualita() {},
  });
  const stato = (txt) => { const c = document.getElementById("carica3d"); if (c) c.textContent = txt; };
  const pausa = () => new Promise((r) => setTimeout(r, 16));

  /* ---------------- qualità grafica ---------------- */
  const mobile = matchMedia("(pointer: coarse)").matches || innerWidth < 700;
  let QN = mobile ? "media" : "alta"; try { QN = localStorage.getItem("diorama-qualita") || QN; } catch (e) {}
  const Q = { alta: { pr: 2, ombra: 4096, post: true, erba: 34000, st: 2, gocce: 90000 }, media: { pr: 1.5, ombra: 2048, post: true, erba: 14000, st: 2.5, gocce: 45000 }, bassa: { pr: 1, ombra: 1024, post: false, erba: 4000, st: 4, gocce: 12000 } }[QN] || { pr: 1.5, ombra: 2048, post: true, erba: 14000, st: 2.5, gocce: 45000 };
  S3.qualita = QN;

  /* ---------------- utilità ---------------- */
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const nz = (x, y) => Math.sin(x * 0.031 + 1.3) * Math.cos(y * 0.027 + 0.7) * 0.5 + Math.sin(x * 0.083 + y * 0.061) * 0.3 + Math.sin(x * 0.17 - y * 0.13 + 2) * 0.2;
  const fbm = (x, y) => nz(x, y) * 0.5 + nz(x * 2.13 + 17, y * 2.07 - 9) * 0.25 + nz(x * 4.3 - 31, y * 4.1 + 5) * 0.15 + nz(x * 8.7 + 3, y * 8.3 + 41) * 0.1;
  const ridge = (x, y) => 1 - Math.abs(Math.sin(x * 0.09 + Math.sin(y * 0.05) * 2) * Math.cos(y * 0.07 + Math.sin(x * 0.04) * 2));
  const V = (x, y, h) => new T.Vector3(x - 400, h, y - 250);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const rimbalzo = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
  const R = rng(99);
  const BGU = T.BufferGeometryUtils;

  /* =========================================================
     TEXTURE PROCEDURALI (disegnate al volo, nessun file esterno)
     ========================================================= */
  function rumore(size, ott, seed) {
    const r = rng(seed), out = new Float32Array(size * size);
    let amp = 1, tot = 0;
    for (let o = 0; o < ott; o++) {
      const f = 4 << o, g = new Float32Array(f * f); for (let i = 0; i < g.length; i++) g[i] = r();
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const fx = (x / size) * f, fy = (y / size) * f, i0 = Math.floor(fx), j0 = Math.floor(fy), u = fx - i0, v = fy - j0;
        const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), i1 = (i0 + 1) % f, j1 = (j0 + 1) % f;
        out[y * size + x] += amp * lerp(lerp(g[j0 * f + i0], g[j0 * f + i1], su), lerp(g[j1 * f + i0], g[j1 * f + i1], su), sv);
      }
      tot += amp; amp *= 0.55;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  function tela(size, fn) { const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"); const im = x.createImageData(size, size); for (let y = 0; y < size; y++) for (let k = 0; k < size; k++) { const v = fn(k, y), i = (y * size + k) * 4; im.data[i] = v[0]; im.data[i + 1] = v[1]; im.data[i + 2] = v[2]; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c; }
  function texC(canvas) { const t = new T.CanvasTexture(canvas); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t; }
  function texN(h, size, forza) {
    const g = (a, b) => h[((b + size) % size) * size + ((a + size) % size)];
    const c = tela(size, (x, y) => { const dx = (g(x + 1, y) - g(x - 1, y)) * forza, dy = (g(x, y + 1) - g(x, y - 1)) * forza, l = Math.hypot(dx, dy, 1); return [(-dx / l * 0.5 + 0.5) * 255, (-dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255]; });
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
  }
  const TEX = {};
  function preparaTexture() {
    { const n = rumore(512, 7, 11); TEX.terreno = { map: texC(tela(512, (x, y) => { const v = 175 + n[y * 512 + x] * 80; return [v, v, v]; })), normal: texN(n, 512, 9) }; }
    { const n = rumore(256, 5, 23); TEX.acqua = { normal: texN(n, 256, 14) }; }
    { const S = 512, h = new Float32Array(S * S), col = new Float32Array(S * S), n = rumore(S, 6, 5), r = rng(7), rh = 48;
      for (let row = 0; row < S / rh; row++) { let x = row % 2 ? -40 : 0; while (x < S) { const w = 70 + r() * 70, c = 0.82 + r() * 0.3; for (let y = row * rh + 3; y < row * rh + rh - 3; y++) for (let k = Math.max(0, Math.floor(x) + 3); k < Math.min(S, x + w - 3); k++) { h[y * S + k] = 1; col[y * S + k] = c; } x += w; } }
      for (let i = 0; i < S * S; i++) h[i] = h[i] * (0.75 + n[i] * 0.5);
      TEX.pietra = { map: texC(tela(S, (x, y) => { const i = y * S + x, b = h[i] > 0.1 ? col[i] * (0.8 + n[i] * 0.35) : 0.55; return [222 * b, 208 * b, 184 * b]; })), normal: texN(h, S, 6) }; }
    { const n = rumore(256, 6, 31); TEX.intonaco = { map: texC(tela(256, (x, y) => { const v = 0.86 + n[y * 256 + x] * 0.22; return [240 * v, 232 * v, 214 * v]; })), normal: texN(n, 256, 3) }; }
    { const S = 256, n = rumore(S, 6, 41), h = new Float32Array(S * S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (x % 32 < 2 ? 0 : 1) * (0.7 + 0.3 * Math.sin(y * 0.15 + n[y * S + x] * 9));
      TEX.legno = { map: texC(tela(S, (x, y) => { const v = h[y * S + x] ? 0.82 + 0.18 * Math.sin(y * 0.11 + n[y * S + x] * 12 + Math.floor(x / 32) * 3) : 0.5; return [235 * v, 200 * v, 160 * v]; })), normal: texN(h, S, 5) }; }
    { const S = 128, n = rumore(S, 5, 51); TEX.tenda = { map: texC(tela(S, (x, y) => { const b = [0.3, 0.85, 0.5][Math.floor(y / 16) % 3] * (0.85 + n[y * S + x] * 0.3); return [200 * b, 175 * b, 140 * b]; })), normal: texN(n, S, 4) }; }
    { const S = 64, n = rumore(S, 4, 61); TEX.stoffa = { map: texC(tela(S, (x, y) => { const v = 0.85 + n[y * S + x] * 0.2 + ((x + y) % 4 === 0 ? 0.04 : 0); return [255 * v, 255 * v, 255 * v]; })), normal: texN(n, S, 3) }; }
    { const S = 512, n = rumore(S, 6, 71), r = rng(73), h = new Float32Array(S * S), col = new Float32Array(S * S), ps = [];
      for (let i = 0; i < 70; i++) ps.push([r() * S, r() * S, 0.8 + r() * 0.3]);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let d1 = 1e9, d2 = 1e9, c = 1; for (const p of ps) { let dx = Math.abs(p[0] - x), dy = Math.abs(p[1] - y); dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy); const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; c = p[2]; } else if (d < d2) d2 = d; } const e = Math.sqrt(d2) - Math.sqrt(d1); h[y * S + x] = e < 4 ? (e / 4) * 0.6 : 0.6 + n[y * S + x] * 0.4; col[y * S + x] = c; }
      TEX.lastricato = { map: texC(tela(S, (x, y) => { const i = y * S + x, b = h[i] < 0.5 ? 0.45 : col[i] * (0.8 + n[i] * 0.3); return [214 * b, 196 * b, 160 * b]; })), normal: texN(h, S, 5) }; }
    TEX.strati = { map: texC(tela(64, (x, y) => { const v = Math.floor(y / 6.4) % 2 ? 0.95 : 0.72; return [220 * v, 180 * v, 128 * v]; })) };
    { const n = rumore(512, 6, 81); TEX.betulla = { map: texC(tela(512, (x, y) => { const v = 0.82 + 0.12 * Math.sin(y * 0.05 + n[y * 512 + x] * 14) + n[y * 512 + x] * 0.08; return [236 * v, 206 * v, 160 * v]; })) }; }
    { const n = rumore(512, 6, 91); TEX.noce = { map: texC(tela(512, (x, y) => { const v = 0.55 + 0.25 * Math.sin(y * 0.04 + n[y * 512 + x] * 18) + n[y * 512 + x] * 0.15; return [120 * v, 78 * v, 48 * v]; })) }; }
    { const n = rumore(512, 6, 131), m = rumore(512, 4, 137); TEX.roccia = { map: texC(tela(512, (x, y) => { const k = y * 512 + x, st = 0.6 + 0.22 * Math.sin(y * 0.21 + n[k] * 7 + m[k] * 3) + 0.25 * (n[k] - 0.5) + (Math.abs(Math.sin(y * 0.09 + n[k] * 4)) < 0.06 ? -0.25 : 0); return [205 * st, 192 * st, 176 * st]; })) }; }
    { const n = rumore(256, 5, 97); TEX.terra = { map: texC(tela(256, (x, y) => { const s = 0.75 + 0.2 * Math.sin(y * 0.18 + n[y * 256 + x] * 6) + n[y * 256 + x] * 0.12; return [132 * s, 100 * s, 70 * s]; })) }; }
    const sprite = (fn) => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); fn(x); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; };
    TEX.fiamma = sprite((x) => { const g = x.createRadialGradient(32, 38, 0, 32, 32, 30); g.addColorStop(0, "rgba(255,240,180,1)"); g.addColorStop(0.3, "rgba(255,170,60,.9)"); g.addColorStop(0.7, "rgba(230,70,10,.35)"); g.addColorStop(1, "rgba(120,20,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    TEX.fumo = sprite((x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(200,200,200,.55)"); g.addColorStop(1, "rgba(200,200,200,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), r = rng(141);
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, 12, 12); // angolo opaco usato da tronchi e rami
      for (let i = 0; i < 150; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 100, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d, l = 10 + r() * 12, v = Math.floor(170 + r() * 85);
        x.save(); x.translate(cx, cy); x.rotate(r() * 6.28); x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.ellipse(0, 0, l, l * 0.42, 0, 0, 7); x.fill();
        x.strokeStyle = `rgba(0,0,0,.25)`; x.lineWidth = 1; x.beginPath(); x.moveTo(-l, 0); x.lineTo(l, 0); x.stroke(); x.restore(); }
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; TEX.foglie = { map: t }; }
    TEX.alone = sprite((x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.2, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  }

  /* =========================================================
     RENDERER, CAMERA, CIELO, LUCI, POST-PRODUZIONE
     ========================================================= */
  const NUVOLE = [];
  let renderer, scene, camera, controls, sky, sole, luna, hemi, pmrem, envScene, envSky, envRT, stelleCielo, composer, bloom, tiltH, tiltV, finale;
  function preparaMotore() {
    renderer = new T.WebGLRenderer({ antialias: !Q.post, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(36, 1.6, 4, 40000);
    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.07; controls.minDistance = 30; controls.maxDistance = 2600; controls.screenSpacePanning = true;
    sky = new T.Sky(); sky.scale.setScalar(30000); scene.add(sky);
    envScene = new T.Scene(); envSky = new T.Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
    pmrem = new T.PMREMGenerator(renderer);
    { const n = 2500, p = new Float32Array(n * 3), r = rng(5); for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); p.set([Math.cos(a) * s * 20000, Math.abs(u) * 20000, Math.sin(a) * s * 20000], i * 3); }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(p, 3));
      stelleCielo = new T.Points(g, new T.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); scene.add(stelleCielo); }
    scene.fog = new T.FogExp2("#c9d8e6", 0.00022);
    { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), r = rng(17);
      for (let i = 0; i < 26; i++) { const cx = 20 + r() * 88, cy = 50 + r() * 34, rad = 14 + r() * 26, g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
      const tn = new T.CanvasTexture(c); tn.encoding = T.sRGBEncoding; NUVOLE.length = 0; const r2 = rng(19);
      for (let i = 0; i < 16; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: tn, color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false, fog: false })); const a = r2() * Math.PI * 2, d = 7000 + r2() * 5000; sp.position.set(Math.cos(a) * d, 1800 + r2() * 2600, Math.sin(a) * d); sp.scale.set(5000 + r2() * 4000, 2000 + r2() * 1200, 1); sp.userData.a = a; sp.userData.d = d; scene.add(sp); NUVOLE.push(sp); } }
    hemi = new T.HemisphereLight("#cfe2ff", "#6b5a40", 0.35); scene.add(hemi);
    sole = new T.DirectionalLight("#fff1dc", 2.6); sole.castShadow = true;
    sole.shadow.mapSize.set(Q.ombra, Q.ombra);
    Object.assign(sole.shadow.camera, { left: -560, right: 560, top: 460, bottom: -460, near: 50, far: 4000 }); sole.shadow.camera.updateProjectionMatrix();
    sole.shadow.bias = -0.00035; sole.shadow.normalBias = 0.35;
    scene.add(sole, sole.target);
    luna = new T.DirectionalLight("#9fb6ff", 0); luna.position.set(500, 1100, -700); scene.add(luna);
    if (Q.post) {
      const sz = new T.Vector2(); renderer.getDrawingBufferSize(sz);
      const rt = new T.WebGLRenderTarget(Math.max(1, sz.x), Math.max(1, sz.y), { type: T.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
      composer = new T.EffectComposer(renderer, rt);
      composer.addPass(new T.RenderPass(scene, camera));
      bloom = new T.UnrealBloomPass(new T.Vector2(512, 512), 0.18, 0.55, 0.88); composer.addPass(bloom);
      tiltH = new T.ShaderPass(T.HorizontalTiltShiftShader); tiltV = new T.ShaderPass(T.VerticalTiltShiftShader);
      composer.addPass(tiltH); composer.addPass(tiltV);
      finale = new T.ShaderPass({
        uniforms: { tDiffuse: { value: null }, vign: { value: 0.3 }, tempo: { value: 0 }, sat: { value: 1.12 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: "uniform sampler2D tDiffuse; uniform float vign; uniform float tempo; uniform float sat; varying vec2 vUv; float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= mix(1.0, smoothstep(0.85, 0.3, d), vign); vec3 l = max(c.rgb, vec3(0.0)); vec3 s = mix(l * 12.92, 1.055 * pow(l, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), l)); float y = dot(s, vec3(0.299, 0.587, 0.114)); s = mix(vec3(y), s, sat); s = (s - 0.5) * 1.06 + 0.5; s += vec3(0.012, 0.004, -0.012) * (1.0 - y); s += (rnd(vUv * 900.0 + tempo) - 0.5) * 0.018; gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0); }",
      }); composer.addPass(finale);
    }
  }

  /* ---------------- materiali per fase ---------------- */
  let FASE_MAT = 10;
  const mats = [], matCache = {}, geoCache = {};
  const UVSCALA = { stoffa: 6, pietra: 30, legno: 18, tenda: 10, intonaco: 22, terreno: 40, lastricato: 60 };
  function M(color, o = {}) {
    const k = FASE_MAT + "|" + color + "|" + JSON.stringify(o, (kk, v) => (v && v.isTexture ? v.uuid : v));
    if (!matCache[k]) {
      const oo = Object.assign({ color, roughness: 0.85, metalness: 0 }, o), tx = oo.tex; delete oo.tex; delete oo.uv;
      if (tx && TEX[tx]) { oo.map = TEX[tx].map; if (TEX[tx].normal) { oo.normalMap = TEX[tx].normal; oo.normalScale = new T.Vector2(0.7, 0.7); } }
      const m = new T.MeshStandardMaterial(oo);
      m.userData = { fase: FASE_MAT, em0: m.emissive.clone(), op0: m.opacity, tr0: m.transparent, dw0: m.depthWrite, uv: o.uv || UVSCALA[tx] || 22 };
      matCache[k] = m; mats.push(m);
    }
    return matCache[k];
  }
  function regMat(m, fase) { m.userData = Object.assign(m.userData || {}, { fase, em0: m.emissive ? m.emissive.clone() : null, op0: m.opacity, tr0: m.transparent, dw0: m.depthWrite }); mats.push(m); return m; }
  const geo = (k, fn) => geoCache[k] || (geoCache[k] = fn());
  const GB = (w, h, d) => geo(`b${w}|${h}|${d}`, () => new T.BoxGeometry(w, h, d));
  const GC = (rt, rb, h, s = 10) => geo(`c${rt}|${rb}|${h}|${s}`, () => new T.CylinderGeometry(rt, rb, h, s));
  const GS = (r, w = 12, h = 9) => geo(`s${r}|${w}|${h}`, () => new T.SphereGeometry(r, w, h));
  const GK = (r, h, s = 8) => geo(`k${r}|${h}|${s}`, () => new T.ConeGeometry(r, h, s));
  function mesh(g, m, x = 0, y = 0, z = 0, ombra = true) { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = ombra; o.receiveShadow = true; return o; }
  const MHIT = new T.MeshBasicMaterial({ visible: false });

  /* ---------------- geometrie colorate (creature, piante) ---------------- */
  const CC = new T.Color(), MX = new T.Matrix4(), QQ = new T.Quaternion(), EE = new T.Euler();
  function parte(g, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    g = g.index ? g.toNonIndexed() : g.clone();
    MX.compose(new T.Vector3(x, y, z), QQ.setFromEuler(EE.set(rx, ry, rz)), new T.Vector3(sx, sy, sz)); g.applyMatrix4(MX);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    let grad = null; if (Array.isArray(col)) grad = [new T.Color(col[0]), new T.Color(col[1]), col[2]]; else CC.set(col);
    for (let i = 0; i < n; i++) { if (grad) CC.copy(grad[0]).lerp(grad[1], Math.min(1, Math.max(0, (g.attributes.position.getY(i) - grad[2].r) / grad[2].g))); c.set([CC.r, CC.g, CC.b], i * 3); }
    g.setAttribute("color", new T.BufferAttribute(c, 3));
    if (!g.attributes.uv) g.setAttribute("uv", new T.BufferAttribute(new Float32Array(n * 2), 2));
    return g;
  }
  const unisci = (parti) => { const g = BGU.mergeBufferGeometries(parti, false); g.computeBoundingSphere(); return g; };
  function deforma(g, amp, seed) {
    const p = g.attributes.position, r = rng(seed), ph = [r() * 6, r() * 6, r() * 6];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amp * (Math.sin(x * 0.9 + ph[0]) * Math.cos(z * 0.8 + ph[1]) * 0.6 + Math.sin(y * 1.3 + ph[2]) * 0.4); p.setXYZ(i, x * k, y * k, z * k); }
    g.computeVertexNormals(); return g;
  }
  const senzaColore = (g) => { g.deleteAttribute("color"); return g; };
  const PELLI = ["#c99a72", "#b07d55", "#d8ad85", "#8c5f3e", "#e0b896"];
  const VESTI = ["#7a2f24", "#2f4f7a", "#6b7a3a", "#a5772f", "#6a3a5c", "#2f6a66", "#cdbb92", "#8a5a3a", "#4a4a6a", "#e8e0cc", "#5a3a2a", "#9a3a2a"];
  const LATHE_VESTE = [[0, 0], [2.5, 0], [2.4, 1.2], [2.0, 3.5], [1.65, 5.6], [1.95, 6.6], [1.6, 7.5], [0.7, 8.0], [0, 8.05]].map(([a, b]) => new T.Vector2(a, b));
  const G_VESTE = () => geo("veste", () => senzaColore(unisci([parte(new T.LatheGeometry(LATHE_VESTE, 12), "#fff"), parte(GC(0.5, 0.55, 4.4, 6), "#fff", 1.9, 5.4, 0.3, 0.25, 0, 0.32), parte(GC(0.5, 0.55, 4.4, 6), "#fff", -1.9, 5.4, 0.3, 0.25, 0, -0.32)])));
  const G_TESTA = () => geo("testa", () => senzaColore(parte(new T.SphereGeometry(1.35, 12, 10), "#fff", 0, 9.0, 0, 0, 0, 0, 1, 1.08, 1)));
  const G_VELO = () => geo("velo", () => senzaColore(unisci([parte(new T.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), "#fff", 0, 9.05, -0.15), parte(GB(3.0, 3.2, 0.5), "#fff", 0, 7.9, -1.3, 0.25)])));
  const G_MANI = () => geo("mani", () => senzaColore(unisci([parte(GS(0.55, 6, 5), "#fff", 2.45, 3.4, 0.9), parte(GS(0.55, 6, 5), "#fff", -2.45, 3.4, 0.9)])));
  function P(col = "#7a2f24", s = 1, opt = {}) {
    const g = new T.Group(), velo = opt.velo || VESTI[Math.floor(R() * VESTI.length)], pelle = opt.pelle || PELLI[Math.floor(R() * PELLI.length)];
    g.add(mesh(G_VESTE(), M(col, { tex: "stoffa", roughness: 0.95 })), mesh(G_TESTA(), M(pelle, { roughness: 0.7 })), mesh(G_MANI(), M(pelle, { roughness: 0.7 })));
    if (opt.velo !== false) g.add(mesh(G_VELO(), M(velo, { tex: "stoffa", roughness: 0.95 })));
    g.add(mesh(GC(1.75, 1.75, 0.5, 12), M("#3a2a1a"), 0, 4.6, 0));
    if (opt.bastone) { const b = mesh(GC(0.28, 0.28, 13, 5), M("#6b4a2b"), 2.6, 6, 0.9); b.rotation.z = -0.08; g.add(b); }
    if (opt.corona) { const c = mesh(new T.TorusGeometry(1.2, 0.35, 5, 10), M("#e0b040", { metalness: 0.9, roughness: 0.3 }), 0, 10.1, 0); c.rotation.x = Math.PI / 2; g.add(c); }
    g.rotation.y = R() * 0.6 - 0.3; if (s !== 1) g.scale.setScalar(s); return g;
  }
  const Seduto = (col) => { const g = P(col); g.scale.set(1, 0.62, 1); return g; };
  const G_ALA = () => geo("ala", () => { const sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(4, 3, 6.5, 1); sh.quadraticCurveTo(4, -1, 0, -3); sh.lineTo(0, 0); return new T.ShapeGeometry(sh); });
  function Angelo() {
    const g = P("#f6f3ea", 1, { velo: false, pelle: "#f0d2b0" });
    const al = mesh(GS(1.75, 10, 6), M("#ffe9a0", { emissive: "#ffd060", emissiveIntensity: 0.6 }), 0, 10.8, 0); al.scale.set(1, 0.18, 1); g.add(al);
    [-1, 1].forEach((s) => { const a = mesh(G_ALA(), M("#ffffff", { side: T.DoubleSide, roughness: 0.6 }), s, 6.5, -1.6); a.rotation.y = s > 0 ? -0.5 : Math.PI + 0.5; g.add(a); });
    return g;
  }
  const MV = () => M("#ffffff", { vertexColors: true, roughness: 0.9 });
  const G_PECORA = () => geo("pecora", () => unisci([
    ...[[-1.5, 2.6, 0, 1.45], [0, 2.9, 0, 1.65], [1.3, 2.7, 0, 1.45], [0, 3.3, 0.85, 1.15], [0, 3.3, -0.85, 1.15], [-0.6, 3.6, 0, 1.2], [0.7, 3.5, 0, 1.15]].map(([x, y, z, r], i) => parte(new T.IcosahedronGeometry(r, 1), i % 2 ? "#ece4d0" : "#f4eedf", x, y, z)),
    parte(new T.SphereGeometry(0.85, 8, 6), "#2f2a26", 2.75, 3.15, 0, 0, 0, 0, 1.35, 1, 0.9),
    parte(GB(0.9, 0.3, 0.5), "#2f2a26", 2.4, 3.6, 0.75, 0.3), parte(GB(0.9, 0.3, 0.5), "#2f2a26", 2.4, 3.6, -0.75, -0.3),
    ...[[1.1, 0.7], [1.1, -0.7], [-1.2, 0.7], [-1.2, -0.7]].map(([x, z]) => parte(GC(0.22, 0.2, 2, 5), "#2f2a26", x, 1, z)),
  ]));
  function G_QUAD(col, L, H, k, extra = []) {
    return geo("quad" + k, () => unisci([
      parte(new T.SphereGeometry(1, 12, 9), col, 0, H * 0.62, 0, 0, 0, 0, L / 2, H * 0.24, H * 0.21),
      parte(new T.SphereGeometry(H * 0.13, 10, 8), col, L / 2 + H * 0.12, H * 0.84, 0, 0, 0, 0, 1.45, 1, 0.85),
      parte(GC(H * 0.08, H * 0.1, H * 0.3, 6), col, L / 2 - H * 0.02, H * 0.74, 0, 0, 0, -0.7),
      ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, c]) => parte(GC(H * 0.055, H * 0.045, H * 0.52, 5), col, a * L * 0.32, H * 0.26, c * H * 0.12)),
      parte(GC(H * 0.025, H * 0.015, H * 0.3, 4), col, -L / 2 - 0.2, H * 0.55, 0, 0, 0, 0.5),
      ...extra,
    ]));
  }
  const G_CAMMELLO = () => geo("cammello", () => unisci([
    parte(new T.SphereGeometry(1, 14, 10), "#b88f58", 0, 8, 0, 0, 0, 0, 5, 2.3, 2.1),
    parte(new T.SphereGeometry(2.3, 12, 9), "#b88f58", -0.4, 9.7, 0, 0, 0, 0, 1.35, 1, 1),
    parte(GC(0.75, 1.05, 6.5, 8), "#b88f58", 5.3, 9.6, 0, 0, 0, -0.85),
    parte(new T.SphereGeometry(1, 10, 8), "#a8804c", 7.7, 12.1, 0, 0, 0, 0, 1.9, 0.85, 0.8),
    ...[[3.2, 1.1], [3.2, -1.1], [-3.2, 1.1], [-3.2, -1.1]].map(([x, z]) => parte(GC(0.45, 0.35, 7.6, 6), "#a8804c", x, 3.8, z)),
    parte(GB(4.6, 0.5, 4.7), "#8e2b2b", -0.4, 11.75, 0), parte(GB(4.8, 1.6, 0.25), "#c9a14a", -0.4, 11, 2.35), parte(GB(4.8, 1.6, 0.25), "#c9a14a", -0.4, 11, -2.35),
    parte(GC(0.15, 0.08, 3, 4), "#8a6a3a", -5, 7, 0, 0, 0, 0.4),
  ]));
  const Pecora = () => mesh(G_PECORA(), MV());
  const Cammello = () => mesh(G_CAMMELLO(), MV());
  const Leone = () => mesh(G_QUAD("#c8923a", 6, 5, "leone", [parte(new T.IcosahedronGeometry(1.5, 1), "#7a4a1a", 3.1, 4.2, 0)]), MV());
  const Asino = () => mesh(G_QUAD("#8a8078", 6, 6.5, "asino", [parte(GB(1.2, 1.2, 0.3), "#6a605a", 3.9, 6.6, 0.4, 0, 0, 0.3), parte(GB(1.2, 1.2, 0.3), "#6a605a", 3.9, 6.6, -0.4, 0, 0, 0.3)]), MV());
  const Cavallo = () => mesh(G_QUAD("#5a3a22", 9, 10.5, "cavallo", [parte(GB(3, 1.5, 0.4), "#2a1a10", 4.4, 9.5, 0, 0, 0, -0.7)]), MV());
  const Bue = () => mesh(G_QUAD("#7a5a3a", 7.5, 6.5, "bue", [parte(GC(0.2, 0.35, 2, 5), "#e0d8c0", 4.6, 6.4, 0.9, 0.8), parte(GC(0.2, 0.35, 2, 5), "#e0d8c0", 4.6, 6.4, -0.9, -0.8)]), MV());
  const Elefante = () => mesh(G_QUAD("#8a8784", 8, 8.5, "elefante", [parte(GC(0.45, 0.8, 5, 8), "#8a8784", 5.6, 4.6, 0, 0, 0, 0.2), parte(GB(0.4, 3, 2.6), "#7a7774", 4.4, 7.4, 1.4, 0, 0.3), parte(GB(0.4, 3, 2.6), "#7a7774", 4.4, 7.4, -1.4, 0, -0.3)]), MV());
  const Giraffa = () => mesh(G_QUAD("#d8a84a", 5, 6, "giraffa", [parte(GC(0.45, 0.7, 8, 6), "#d8a84a", 3.4, 8.6, 0, 0, 0, -0.3), parte(new T.SphereGeometry(0.8, 8, 6), "#c8983a", 4.7, 12.4, 0, 0, 0, 0, 1.6, 0.8, 0.8)]), MV());
  const Capra = () => mesh(G_QUAD("#4a3a2c", 4, 4.2, "capra"), MV());

  const MVEG = () => M("#ffffff", { vertexColors: true, roughness: 0.92, side: T.DoubleSide });
  const DEPTH_FOGLIE = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaTest: 0.45 });
  const MFOG = () => { const m = M("#ffffff", { vertexColors: true, roughness: 0.85, side: T.DoubleSide, alphaTest: 0.45, tex: "foglie" }); m.userData.foglie = true; DEPTH_FOGLIE.map = TEX.foglie.map; return m; };
  const uvFisso = (g) => { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.02, 0.98); return g; };
  // una chioma = tanti ciuffi (quadrati di foglie trasparenti) disposti su sfere
  function ciuffi(blobs, scuro, chiaro, seed, densita = 1) {
    const r = rng(seed), out = [], cS = new T.Color(scuro), cC = new T.Color(chiaro);
    blobs.forEach(([bx, by, bz, br]) => {
      const n = Math.round(br * br * 0.9 * densita) + 6;
      for (let i = 0; i < n; i++) {
        const u = r() * 2 - 1, a = r() * 6.283, q = Math.sqrt(1 - u * u), d = br * (0.35 + 0.65 * Math.sqrt(r()));
        const dx = Math.cos(a) * q, dy = u, dz = Math.sin(a) * q, sz = br * (0.7 + r() * 0.5);
        const g = new T.PlaneGeometry(sz, sz).toNonIndexed(); g.rotateX(r() * 6.28); g.rotateY(r() * 6.28); g.rotateZ(r() * 6.28);
        g.translate(bx + dx * d, by + dy * d * 0.8, bz + dz * d);
        const k = Math.min(1, Math.max(0, 0.35 + dy * 0.45 + (d / br) * 0.3 + (r() - 0.5) * 0.25)), c = cS.clone().lerp(cC, k), col = new Float32Array(18);
        for (let v = 0; v < 6; v++) col.set([c.r, c.g, c.b], v * 3);
        const nor = new Float32Array(18); for (let v = 0; v < 6; v++) nor.set([dx, dy * 0.8 + 0.2, dz], v * 3);
        g.setAttribute("normal", new T.BufferAttribute(nor, 3)); g.setAttribute("color", new T.BufferAttribute(col, 3)); out.push(g);
      }
    });
    return out;
  }
  function G_ALBERO(v) {
    return geo("albero" + v, () => {
      const r = rng(300 + v), parti = [parte(GC(0.9, 1.7, 14, 7), "#5a4030", 0, 7, 0), parte(GC(0.5, 0.8, 8, 5), "#5a4030", 2.2, 13, 0, 0, 0, -0.7), parte(GC(0.5, 0.8, 8, 5), "#5a4030", -1.8, 13.5, 1, 0.5, 0, 0.7), parte(GC(0.4, 0.6, 6, 5), "#5a4030", 0, 15, -2, -0.7, 0, 0)].map(uvFisso);
      const verdi = [["#22451a", "#6a9a3a"], ["#2a4f1e", "#7aa845"], ["#1e3f18", "#5a8a32"], ["#33582a", "#8fb24f"]][v % 4], blobs = [];
      for (let i = 0; i < 6 + (v % 3); i++) { const a = r() * 6.28, d = i ? 3 + r() * 3.5 : 0; blobs.push([Math.cos(a) * d, 18 + r() * 5 + (i ? 0 : 2), Math.sin(a) * d, 4.2 + r() * 2.4]); }
      return unisci(parti.concat(ciuffi(blobs, verdi[0], verdi[1], 900 + v)));
    });
  }
  const G_CIPRESSO = () => geo("cipresso", () => unisci([parte(GC(0.7, 1, 5, 6), "#5a4030", 0, 2.5, 0), parte(deforma(new T.SphereGeometry(1, 10, 14), 0.08, 3), ["#1f3a1c", "#3d5e2c", { r: 3, g: 22 }], 0, 14, 0, 0, 0, 0, 3.6, 12, 3.6)]));
  const G_ULIVO = (v) => geo("ulivo" + v, () => { const r = rng(400 + v), p = [parte(GC(0.9, 1.6, 8, 6), "#6a5a4a", 0, 4, 0, 0, 0, 0.25), parte(GC(0.7, 0.9, 6, 5), "#6a5a4a", 1.5, 8, 0, 0, 0, -0.5), parte(GC(0.5, 0.7, 5, 5), "#6a5a4a", -1.2, 8.5, 0.5, 0.4, 0, 0.6)].map(uvFisso), b = []; for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = r() * 4; b.push([Math.cos(a) * d + 1, 11.5 + r() * 2, Math.sin(a) * d, 3.4 + r() * 1.4]); } return unisci(p.concat(ciuffi(b, "#4a5634", "#a8b488", 950 + v, 1.2))); });
  function G_PALMA(v) {
    return geo("palma" + v, () => {
      const r = rng(500 + v), h = 18 + v * 3, curva = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(1 + v * 0.5, h * 0.5, 0), new T.Vector3(2 + v, h, 0.5)]);
      const tr = new T.TubeGeometry(curva, 12, 0.8, 6, false).toNonIndexed(), tp = tr.attributes.position, cc = new Float32Array(tp.count * 3);
      for (let i = 0; i < tp.count; i++) { CC.set(Math.floor(tp.getY(i) / 1.4) % 2 ? "#7a5a3a" : "#5e432a"); cc.set([CC.r, CC.g, CC.b], i * 3); }
      tr.setAttribute("color", new T.BufferAttribute(cc, 3));
      const parti = [tr], top = curva.getPoint(1);
      for (let i = 0; i < 10; i++) {
        const f = new T.PlaneGeometry(13, 3, 10, 1).toNonIndexed(), p = f.attributes.position;
        for (let k = 0; k < p.count; k++) { const x = p.getX(k) + 6.5, y = p.getY(k); p.setXYZ(k, x, -0.045 * x * x + 0.25 * x, y * (1 - x / 15)); }
        f.rotateY((i / 10) * Math.PI * 2 + r() * 0.3); f.translate(top.x, top.y, top.z); f.computeVertexNormals();
        const cf = new Float32Array(p.count * 3); for (let k = 0; k < p.count; k++) { CC.set("#2f5a1f").lerp(new T.Color("#7a9a3a"), Math.min(1, Math.abs(p.getY(k) - top.y) / 5 + 0.2 * r())); cf.set([CC.r, CC.g, CC.b], k * 3); } f.setAttribute("color", new T.BufferAttribute(cf, 3));
        parti.push(f);
      }
      parti.push(parte(new T.IcosahedronGeometry(1.3, 0), "#6b4a1a", top.x, top.y - 0.5, top.z));
      return unisci(parti);
    });
  }
  const G_CESPUGLIO = (v) => geo("cesp" + v, () => { const r = rng(600 + v), b = []; for (let i = 0; i < 4; i++) b.push([(r() - 0.5) * 4, 1.8 + r(), (r() - 0.5) * 4, 2 + r() * 1.5]); return unisci(ciuffi(b, "#24401a", v % 2 ? "#7a8a42" : "#6a9a3a", 980 + v, 1.6)); });
  const Albero = (v = 0, s = 1) => { const m = mesh(G_ALBERO(v), MFOG()); m.scale.setScalar(s); m.rotation.y = R() * 6.28; return m; };
  const Palma = (v = 0) => { const m = mesh(G_PALMA(v % 3), MVEG()); m.rotation.y = R() * 6.28; return m; };
  const Cespuglio = (s = 1) => { const m = mesh(G_CESPUGLIO(Math.floor(R() * 4)), MFOG()); m.scale.setScalar(s); return m; };

  function Tenda(w = 14, d = 10, h = 8, col = "#cdbb98") {
    const g = geo(`tenda${w}|${d}|${h}`, () => { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.quadraticCurveTo(-w * 0.2, h * 0.75, 0, h); s.quadraticCurveTo(w * 0.2, h * 0.75, w / 2, 0); s.lineTo(-w / 2, 0); const e = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 6 }); e.translate(0, 0, -d / 2); return e; });
    const t = new T.Group(); t.add(mesh(g, M(col, { tex: "tenda", side: T.DoubleSide, roughness: 1 }))); t.add(mesh(GB(w * 0.25, h * 0.55, 0.3), M("#1a120c"), 0, h * 0.27, d / 2 + 0.05, false));
    [-1, 1].forEach((s) => { const c = mesh(GC(0.12, 0.12, h * 0.9, 3), M("#d8c8a0"), s * w * 0.62, h * 0.35, d / 2 + 1.5, false); c.rotation.z = -s * 0.8; t.add(c); });
    return t;
  }
  function Casa(w = 10, d = 10, h = 9, col = "#e2d6bd") {
    const g = new T.Group(); g.add(mesh(GB(w, h, d), M(col, { tex: "intonaco" }), 0, h / 2, 0));
    g.add(mesh(GB(w + 0.8, 0.8, d + 0.8), M("#b8a688", { tex: "intonaco" }), 0, h + 0.4, 0));
    g.add(mesh(GB(w + 0.8, 1.2, 0.5), M("#cfc0a2", { tex: "intonaco" }), 0, h + 1.1, d / 2 + 0.2), mesh(GB(w + 0.8, 1.2, 0.5), M("#cfc0a2", { tex: "intonaco" }), 0, h + 1.1, -d / 2 - 0.2));
    g.add(mesh(GB(2.4, 4.6, 0.3), M("#3a2818", { tex: "legno" }), w * 0.18, 2.3, d / 2 + 0.05, false));
    g.add(mesh(GB(1.4, 1.4, 0.3), M("#1a140e"), -w * 0.25, h * 0.66, d / 2 + 0.05, false));
    if (R() < 0.4) g.add(mesh(GB(2, 2.4, 2), M(col, { tex: "intonaco" }), -w * 0.3, h + 1.2, -d * 0.2));
    return g;
  }
  const Pietra = (w, h, d, col = "#a09684") => mesh(GB(w, h, d), M(col, { tex: "pietra", uv: 14 }), 0, h / 2, 0);
  function AlberoVita() {
    const g = new T.Group();
    g.add(mesh(deforma(new T.LatheGeometry([[0, 0], [4.5, 0], [3.4, 2], [2.6, 10], [2.2, 24], [2.6, 32], [0, 33]].map(([a, b]) => new T.Vector2(a, b)), 12), 0.05, 9), M("#6a4a32", { roughness: 0.95 })));
    [[0.75, 0], [-0.7, 1.6], [0.65, 3.1], [-0.6, 4.6], [0.5, 5.6]].forEach(([r, a]) => { const b = mesh(GC(0.9, 1.6, 16, 7), M("#6a4a32"), Math.cos(a) * 4.5, 31, Math.sin(a) * 4.5); b.rotation.set(Math.sin(a) * r, 0, -Math.cos(a) * r); g.add(b); });
    const ch = [], r = rng(77);
    g.add(mesh(geo("chiomaVita", () => unisci(ciuffi([[0, 46, 0, 13], [10, 41, 4, 10], [-10, 42, -3, 10], [3, 41, -11, 9.5], [-4, 40, 11, 9.5], [0, 55, 0, 9], [7, 50, -6, 8], [-7, 50, 6, 8]], "#15451c", "#62b048", 1777, 1.3))), MFOG()));
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, rr = 11 + r() * 5; g.add(mesh(GS(1.6, 8, 6), M("#f0b93a", { emissive: "#c98a00", emissiveIntensity: 0.35, roughness: 0.4 }), Math.cos(a) * rr, 38 + r() * 14, Math.sin(a) * rr)); }
    return g;
  }
  function Arca() {
    const g = new T.Group(), s = new T.Shape(); s.moveTo(-45, 5); s.quadraticCurveTo(-42, -1, -36, -3); s.lineTo(36, -3); s.quadraticCurveTo(42, -1, 45, 5); s.lineTo(-45, 5);
    g.add(mesh(geo("scafo", () => { const e = new T.ExtrudeGeometry(s, { depth: 15, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2 }); e.translate(0, 3, -7.5); return e; }), M("#6a4220", { tex: "legno" })));
    g.add(mesh(GB(62, 5, 11), M("#8a5a30", { tex: "legno" }), 0, 10.5, 0));
    g.add(mesh(geo("tettoArca", () => { const t = new T.Shape(); t.moveTo(-7, 0); t.lineTo(7, 0); t.lineTo(0, 3.5); t.lineTo(-7, 0); const e = new T.ExtrudeGeometry(t, { depth: 64, bevelEnabled: false }); e.translate(0, 0, -32); e.rotateY(Math.PI / 2); return e; }), M("#4a2c14", { tex: "legno" }), 0, 13, 0));
    for (let i = -2; i <= 2; i++) g.add(mesh(GB(2.5, 2, 0.4), M("#1e140c"), i * 11, 10.5, 5.6, false));
    g.add(mesh(GB(8, 6, 0.5), M("#3e2410", { tex: "legno" }), 18, 7, 7.8)); const ramp = mesh(GB(8, 0.6, 16), M("#5a3a1a", { tex: "legno" }), 18, 3, 15); ramp.rotation.x = 0.45; g.add(ramp);
    return g;
  }
  function Arcobaleno() { const g = new T.Group(); ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0a84ff", "#5856d6", "#af52de"].forEach((c, i) => g.add(mesh(new T.TorusGeometry(58 - i * 1.5, 0.75, 6, 64, Math.PI), M(c, { emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.28, depthWrite: false }), 0, 0, 0, false))); g.userData.vivo = true; return g; }
  function Ziggurat() {
    const g = new T.Group(), col = ["#b08a5e", "#b8916a", "#c09a72", "#c6a27a", "#cca882", "#d2af8a"];
    [46, 39, 32, 25, 19, 13].forEach((w, i) => { const b = mesh(GB(w, 10, w), M(col[i], { tex: "pietra", uv: 12 }), 0, i * 10 + 5, 0); b.rotation.y = i * 0.13; g.add(b); const r = mesh(GB(w * 0.22, 1, 7), M("#a58560", { tex: "pietra", uv: 12 }), w * 0.39, i * 10 + 10.3, w * 0.25); r.rotation.y = i * 0.13; g.add(r); });
    for (let i = 0; i < 8; i++) { const st = mesh(GC(0.35, 0.35, 18, 4), M("#7a5a38"), -5 + (i % 4) * 3.5, 69, -4 + Math.floor(i / 4) * 8); st.rotation.z = 0.12 * ((i % 3) - 1); g.add(st); }
    g.add(mesh(GB(16, 0.5, 9), M("#7a5a38", { tex: "legno" }), 0, 72, 0));
    return g;
  }
  function Piramide(lato, h) { const g = new T.Group(), p = mesh(GK(lato / Math.SQRT2, h, 4), M("#d8bc86", { tex: "pietra", uv: 10, flatShading: true }), 0, h / 2, 0); p.rotation.y = Math.PI / 4; const c = mesh(GK((lato / Math.SQRT2) * 0.12, h * 0.12, 4), M("#f0d28a", { metalness: 0.8, roughness: 0.3 }), 0, h * 0.94, 0); c.rotation.y = Math.PI / 4; g.add(p, c); return g; }
  function Tempio() {
    const g = new T.Group(), pietra = M("#efe6d2", { tex: "pietra", uv: 18 }), oro = M("#e2b04a", { metalness: 0.95, roughness: 0.28 });
    g.add(mesh(GB(66, 4, 46), M("#d8ccb2", { tex: "pietra", uv: 14 }), 0, 2, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(GB(4, 1.3, 16), M("#d8ccb2", { tex: "pietra" }), -34 - i * 1.6, 1.3 * (i + 0.5), 0));
    g.add(mesh(GB(50, 22, 30), pietra, 0, 15, 0), mesh(GB(16, 30, 31), pietra, -18, 19, 0));
    g.add(mesh(GB(52, 1.6, 32), oro, 0, 26.8, 0), mesh(GB(17, 1.6, 32), oro, -18, 34.8, 0));
    for (let i = 0; i < 6; i++) g.add(mesh(GB(0.6, 3, 0.6), oro, -8 + i * 6, 28.6, 15.6));
    [[-28, -7], [-28, 7]].forEach(([x, z]) => { g.add(mesh(GC(1.7, 1.9, 18, 14), M("#b07a30", { metalness: 0.9, roughness: 0.35 }), x, 13, z)); g.add(mesh(GS(2.3, 12, 8), oro, x, 23, z)); });
    g.add(mesh(GB(7, 5, 7), M("#9a7a3a", { metalness: 0.7, roughness: 0.4 }), -40, 6.5, 14));
    g.add(mesh(GB(0.5, 14, 9), M("#2a1c10", { tex: "legno" }), -26.2, 11, 0, false));
    g.add(mesh(GC(4, 3.5, 3, 16), M("#a0742e", { metalness: 0.9, roughness: 0.35 }), -40, 6, -14));
    return g;
  }
  function MuraAnello(r, n, buchi, col = "#d0c0a0") { const g = new T.Group(); for (let i = 0; i < n; i++) { if (buchi.includes(i)) continue; const a = (i / n) * Math.PI * 2, b = mesh(GB((2 * Math.PI * r) / n + 0.6, 12, 3.6), M(col, { tex: "pietra", uv: 10 }), Math.cos(a) * r, 6, Math.sin(a) * r); b.rotation.y = -a + Math.PI / 2; g.add(b); if (i % 2 === 0) { const m = mesh(GB(1.4, 1.6, 3.8), M(col, { tex: "pietra", uv: 10 }), Math.cos(a) * r, 12.8, Math.sin(a) * r); m.rotation.y = -a + Math.PI / 2; g.add(m); } } return g; }
  function Croce(h) { const g = new T.Group(); g.add(mesh(GB(1.8, h, 1.8), M("#4a2e18", { tex: "legno" }), 0, h / 2, 0), mesh(GB(h * 0.45, 1.6, 1.6), M("#4a2e18", { tex: "legno" }), 0, h * 0.75, 0)); return g; }
  function Nave() {
    const g = new T.Group(), s = new T.Shape(); s.moveTo(-15, 4); s.quadraticCurveTo(-13, -1, -9, -1.5); s.lineTo(10, -1.5); s.quadraticCurveTo(15, 0, 17, 5); s.lineTo(-15, 4);
    g.add(mesh(geo("scafoNave", () => { const e = new T.ExtrudeGeometry(s, { depth: 8, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 2 }); e.translate(0, 1, -4); return e; }), M("#5a3a1e", { tex: "legno" })));
    g.add(mesh(GC(0.45, 0.6, 24, 6), M("#4a2e18"), 0, 15, 0));
    const pen = mesh(GC(0.25, 0.25, 14, 5), M("#4a2e18"), 0, 24, 0); pen.rotation.x = Math.PI / 2; g.add(pen);
    const vela = mesh(geo("vela", () => { const p = new T.PlaneGeometry(13, 12, 6, 6), q = p.attributes.position; for (let i = 0; i < q.count; i++) q.setZ(i, Math.cos((q.getX(i) / 13) * Math.PI) * 1.8); p.computeVertexNormals(); return p; }), M("#efe4c6", { tex: "stoffa", side: T.DoubleSide }), 0, 17, 0.8); vela.rotation.y = Math.PI / 2; g.add(vela);
    for (let i = 0; i < 6; i++) { const r = mesh(GC(0.2, 0.2, 8, 3), M("#6a4a2a"), -6 + i * 2.4, 3, 4.6); r.rotation.x = 0.9; g.add(r); }
    return g;
  }
  function Barca(l = 20) { const g = new T.Group(), s = new T.Shape(); s.moveTo(-l / 2, 3); s.quadraticCurveTo(-l / 2 + 2, 0, -l / 4, -0.5); s.lineTo(l / 4, -0.5); s.quadraticCurveTo(l / 2 - 2, 0, l / 2, 3); s.lineTo(-l / 2, 3); const e = new T.ExtrudeGeometry(s, { depth: l * 0.36, bevelEnabled: false }); e.translate(0, 0.5, -l * 0.18); g.add(mesh(e, M("#6a4422", { tex: "legno" })), mesh(GC(0.35, 0.4, 13, 5), M("#4a2e18"), 0, 8, 0)); return g; }
  const FUOCHI = [], STELLE = [];
  function Stella(r = 6) {
    const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const m = mesh(new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 1 }), M("#ffe17a", { emissive: "#ffc830", emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.3 }), 0, 0, 0, false);
    m.userData.vivo = true; STELLE.push(m); return m;
  }
  function Ponte() {
    const g = new T.Group(), lg = M("#7a5230", { tex: "legno" });
    g.add(mesh(geo("arcoPonte", () => { const s = new T.Shape(); s.moveTo(-14, -3); s.lineTo(-14, 1); s.quadraticCurveTo(0, 4, 14, 1); s.lineTo(14, -3); s.lineTo(9, -3); s.quadraticCurveTo(0, 1.5, -9, -3); s.lineTo(-14, -3); const e = new T.ExtrudeGeometry(s, { depth: 13, bevelEnabled: false }); e.translate(0, 0, -6.5); return e; }), M("#9a8a70", { tex: "pietra", uv: 12 })));
    [-6, 6].forEach((z) => { g.add(mesh(GB(28, 0.8, 0.8), lg, 0, 6.5, z)); for (let x = -12; x <= 12; x += 4) g.add(mesh(GB(0.8, 4.5, 0.8), lg, x, 3.8, z)); });
    return g;
  }
  function Recinto(w, d) { const g = new T.Group(), lg = M("#7a5a3a", { tex: "legno" }); [[0, -d / 2, w, 0], [0, d / 2, w, 0], [-w / 2, 0, d, 1], [w / 2, 0, d, 1]].forEach(([x, z, l, r]) => { for (let k = -l / 2; k <= l / 2; k += 4) g.add(mesh(GC(0.3, 0.3, 4, 4), lg, r ? x : x + k, 2, r ? z + k : z)); const b = mesh(GB(l, 0.5, 0.5), lg, x, 3.2, z); b.rotation.y = r ? Math.PI / 2 : 0; g.add(b); }); return g; }

  /* ---------------- fuoco vero: fiamme e fumo ---------------- */
  function Fuoco(s = 1) {
    const g = new T.Group(); g.userData.vivo = true;
    [[-2, 0.4], [2, -0.4], [0, 1.6]].forEach(([x, r]) => { const l = mesh(GC(0.6, 0.7, 7, 5), M("#3a2410", { tex: "legno" }), x * 0.5, 0.7, 0); l.rotation.set(Math.PI / 2, r, r + 0.5); g.add(l); });
    const br = mesh(GS(2.2, 8, 4), M("#ff6a10", { emissive: "#ff4a00", emissiveIntensity: 2.2 }), 0, 0.4, 0, false); br.scale.y = 0.35; g.add(br);
    const parts = [];
    for (let i = 0; i < 9; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: TEX.fiamma, color: new T.Color(3.2, 1.6, 0.5), blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); sp.userData = { f: i / 9, tipo: "fiamma", vel: 0.9 + R() * 0.6, dx: (R() - 0.5) * 2 }; g.add(sp); parts.push(sp); }
    for (let i = 0; i < 6; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: TEX.fumo, color: "#8a8a8a", depthWrite: false, transparent: true, opacity: 0.5 })); sp.userData = { f: i / 6, tipo: "fumo", vel: 0.25 + R() * 0.15, dx: (R() - 0.5) * 3 }; g.add(sp); parts.push(sp); }
    g.userData.parts = parts; g.scale.setScalar(s); FUOCHI.push(g); return g;
  }
  function animaFuochi(t, dt) {
    FUOCHI.forEach((g) => { let o = g; while (o) { if (!o.visible) return; o = o.parent; } g.userData.parts.forEach((p) => {
      const u = p.userData; u.f = (u.f + dt * u.vel) % 1;
      if (u.tipo === "fiamma") { p.position.set(u.dx * (1 - u.f) * 0.6 + Math.sin(t * 9 + u.dx * 5) * 0.4 * u.f, 1 + u.f * 9, 0); const sc = (1 - u.f) * 6 + 1.5; p.scale.set(sc, sc * 1.3, 1); p.material.opacity = Math.sin(u.f * Math.PI); }
      else { p.position.set(u.dx * u.f * 2 + Math.sin(t + u.dx) * u.f * 2, 8 + u.f * 34, 0); const sc = 4 + u.f * 14; p.scale.set(sc, sc, 1); p.material.opacity = 0.35 * Math.sin(u.f * Math.PI); }
    }); });
  }

  /* =========================================================
     TERRENO
     ========================================================= */
  const MONTI3D = [
    { x: 100, y: 228, rx: 76, ry: 92, h: 55, f: "altopiano" }, { x: 197, y: 182, rx: 78, ry: 150, h: 140, f: "picco" },
    { x: 292, y: 96, rx: 44, ry: 38, h: 22, f: "collina" }, { x: 405, y: 150, rx: 56, ry: 78, h: 94, f: "picco" },
    { x: 490, y: 190, rx: 46, ry: 42, h: 28, f: "collina" }, { x: 503, y: 300, rx: 48, ry: 44, h: 34, f: "collina" },
    { x: 490, y: 415, rx: 46, ry: 38, h: 32, f: "collina" }, { x: 600, y: 190, rx: 44, ry: 44, h: 20, f: "collina" },
    { x: 720, y: 115, rx: 48, ry: 48, h: 32, f: "collina" }, { x: 30, y: 470, rx: 45, ry: 40, h: 18, f: "collina" },
    { x: 775, y: 30, rx: 40, ry: 40, h: 28, f: "collina" }, { x: 250, y: 250, rx: 16, ry: 60, h: 14, f: "collina" },
    { x: 350, y: 30, rx: 40, ry: 26, h: 16, f: "collina" }, { x: 650, y: 470, rx: 30, ry: 26, h: 14, f: "collina" },
  ];
  const MED = [[745, 262], [760, 257], [790, 258], [806, 262], [806, 385], [790, 389], [770, 390], [748, 378], [741, 345], [740, 300]];
  const LAGHI = [{ x: 565, y: 45, rx: 26, ry: 18 }, { x: 445, y: 474, rx: 30, ry: 16 }];
  // deformazione del dominio: i contorni dei monti diventano irregolari come in natura
  const warp = (x, y) => [x + 22 * fbm(x * 0.011 + 3, y * 0.011 - 7), y + 22 * fbm(x * 0.011 - 11, y * 0.011 + 5)];
  // creste multifrattali: cime affilate, crinali e valli
  function creste(x, y) { let s = 0, a = 0.55, f = 1, w = 1; for (let o = 0; o < 6; o++) { let n = 1 - Math.abs(nz(x * f * 0.045 + o * 13.1, y * f * 0.045 - o * 7.3)); n = n * n * w; w = Math.min(1, n * 1.9); s += n * a; a *= 0.5; f *= 2.07; } return s; }
  const smax = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + (b - a) / (2 * k))); return a * (1 - h) + b * h + k * h * (1 - h); };
  function hMonti(x, y) {
    let h = 12 + 3.2 * fbm(x * 0.45, y * 0.45) + 1.6 * fbm(x * 1.6 + 9, y * 1.6 - 4);
    const [wx, wy] = warp(x, y);
    for (const m of MONTI3D) {
      const dx = (wx - m.x) / m.rx, dy = (wy - m.y) / m.ry, r = Math.hypot(dx, dy);
      if (r >= 1.05) continue;
      const t = Math.max(0, 1 - r);
      let v;
      if (m.f === "picco") v = m.h * Math.pow(sstep(0, 1, t), 1.25) * (0.42 + 0.7 * creste(x, y));
      else if (m.f === "altopiano") v = m.h * sstep(0, 0.38, t) * (0.94 + 0.06 * fbm(x * 2, y * 2)) + (1 - sstep(0, 0.3, t)) * t * 18 * creste(x * 1.3, y * 1.3);
      else v = m.h * sstep(0, 1, t) * (0.72 + 0.4 * creste(x * 0.8 + 50, y * 0.8));
      h = smax(h, v, 5);
    }
    return h;
  }
  let NATG = null, EROS = null;
  function hNat(x, y) {
    let h = NATG ? campH(NATG, x, y) : hMonti(x, y);
    for (const L of LAGHI) { const e = ((x - L.x) / L.rx) ** 2 + ((y - L.y) / L.ry) ** 2; if (e < 1.4) h = lerp(h, 2, sstep(1.4, 0.95, e)); }
    if (x > 730) { let w = dentro(MED, x, y) ? 1 : 0; if (!w) { let b = 1e9; for (const p of MED) b = Math.min(b, Math.hypot(p[0] - x, p[1] - y)); w = (1 - sstep(0, 14, b)) * 0.6; } h = lerp(h, 2, w); }
    const ex = Math.max(Math.abs(x - NJ.x) - 47, 0), ey = Math.max(Math.abs(y - NJ.y) - 47, 0);
    return lerp(h, 10, 1 - sstep(0, 26, Math.hypot(ex, ey)));
  }
  // EROSIONE IDRAULICA: gocce di pioggia virtuali scavano canaloni e depositano detriti
  function erodi(H, W, Hh, gocce, seed) {
    const r = rng(seed), RAD = 3, pennello = [];
    let tot = 0; for (let j = -RAD; j <= RAD; j++) for (let i = -RAD; i <= RAD; i++) { const d = Math.hypot(i, j); if (d <= RAD) { const w = 1 - d / RAD; pennello.push([i, j, w]); tot += w; } }
    pennello.forEach((p) => (p[2] /= tot));
    const grad = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, k = j * W + i; const a = H[k], b = H[k + 1], c = H[k + W], d = H[k + W + 1]; return [a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v, (b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u]; };
    for (let n = 0; n < gocce; n++) {
      let x = 1 + r() * (W - 3), y = 1 + r() * (Hh - 3), dx = 0, dy = 0, vel = 1, acqua = 1, sed = 0;
      for (let vita = 0; vita < 34; vita++) {
        const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j;
        const [h, gx, gy] = grad(x, y);
        dx = dx * 0.06 - gx * 0.94; dy = dy * 0.06 - gy * 0.94; const l = Math.hypot(dx, dy); if (l < 1e-6) break; dx /= l; dy /= l;
        x += dx; y += dy;
        if (x < 1 || y < 1 || x >= W - 2 || y >= Hh - 2) break;
        const dh = grad(x, y)[0] - h, cap = Math.max(-dh * vel * acqua * 4, 0.01);
        if (sed > cap || dh > 0) {
          const q = dh > 0 ? Math.min(dh, sed) : (sed - cap) * 0.3; sed -= q; const k = j * W + i;
          H[k] += q * (1 - u) * (1 - v); H[k + 1] += q * u * (1 - v); H[k + W] += q * (1 - u) * v; H[k + W + 1] += q * u * v;
        } else {
          const q = Math.min((cap - sed) * 0.3, -dh);
          for (const [a, b, w] of pennello) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue; const c = jj * W + ii, d = Math.min(H[c], q * w); H[c] -= d; sed += d; }
        }
        vel = Math.sqrt(Math.max(0, vel * vel + dh * 4)); acqua *= 0.985;
      }
    }
  }
  const HC = {};
  function hRaw(x, y) { let h = hNat(x, y); for (const t of TAPPE) { const ex = Math.max(0, Math.abs(x - t.x) - 37.5), ey = Math.max(0, Math.abs(y - t.y) - 37.5), d = Math.hypot(ex, ey); if (d < 12) h = lerp(h, HC[t.n], 1 - sstep(0, 12, d)); } return h; }
  const CP = campiona(ROUTE_D, 1), CR = campiona(RIVER_D, 2);
  const IDX = {}; TAPPE.forEach((t) => { let b = 0, bd = 1e9; CP.forEach((p, i) => { const d = (p[0] - t.x) ** 2 + (p[1] - t.y) ** 2; if (d < bd) { bd = d; b = i; } }); IDX[t.n] = b; });
  const LIV = [], SALTI3D = [];
  const ST = Q.st, NX = Math.round(800 / ST) + 1, NY = Math.round(500 / ST) + 1;
  const HRAW = new Float32Array(NX * NY), HCAR = new Float32Array(NX * NY), DP = new Float32Array(NX * NY).fill(99), DR = new Float32Array(NX * NY).fill(99), KR = new Int32Array(NX * NY), AO = new Float32Array(NX * NY);
  function campH(arr, x, y) { const fx = Math.min(NX - 1.001, Math.max(0, x / ST)), fy = Math.min(NY - 1.001, Math.max(0, y / ST)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * NX + i; return lerp(lerp(arr[k], arr[k + 1], u), lerp(arr[k + NX], arr[k + NX + 1], u), v); }
  const hAt = (x, y) => campH(HCAR, x, y);
  const cella = (arr, x, y) => arr[Math.min(NY - 1, Math.max(0, Math.round(y / ST))) * NX + Math.min(NX - 1, Math.max(0, Math.round(x / ST)))];
  function inCasella(x, y) { for (const t of TAPPE) { const dx = Math.abs(x - t.x), dy = Math.abs(y - t.y); if (dx < 37.5 && dy < 37.5) return Math.max(dx, dy); } return -1; }
  function calcolaTerreno() {
    // 1) forma naturale dei monti + erosione
    const G = new Float32Array(NX * NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) G[j * NX + i] = hMonti(i * ST, j * ST) / ST;
    const prima = G.slice();
    erodi(G, NX, NY, Q.gocce || 40000, 777);
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) { const k = j * NX + i; G[k] = G[k] * 0.6 + (G[k - 1] + G[k + 1] + G[k - NX] + G[k + NX]) * 0.1; }
    EROS = new Float32Array(NX * NY);
    for (let k = 0; k < NX * NY; k++) { EROS[k] = (G[k] - prima[k]) * ST; G[k] *= ST; }
    NATG = G;
    TAPPE.forEach((t) => (HC[t.n] = t.n === 23 ? 10 : hNat(t.x, t.y)));
    CR.forEach((p, i) => { const tgt = hRaw(p[0], p[1]) - 3.5; LIV.push(i === 0 ? hRaw(p[0], p[1]) - 2 : Math.max(Math.min(5.5, LIV[i - 1]), Math.min(LIV[i - 1] - 0.012, tgt))); });
    for (let i = 6; i < CR.length; i++) if (LIV[i - 6] - LIV[i] > 5 && (!SALTI3D.length || i - SALTI3D[SALTI3D.length - 1] > 15)) SALTI3D.push(i);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) HRAW[j * NX + i] = hRaw(i * ST, j * ST);
    const rag = Math.ceil(22 / ST);
    const stampa = (pts, arr, k, passo) => { for (let q = 0; q < pts.length; q += passo) { const [px, py] = pts[q], ci = Math.round(px / ST), cj = Math.round(py / ST); for (let j = cj - rag; j <= cj + rag; j++) for (let i = ci - rag; i <= ci + rag; i++) { if (i < 0 || j < 0 || i >= NX || j >= NY) continue; const d = Math.hypot(i * ST - px, j * ST - py), c = j * NX + i; if (d < arr[c]) { arr[c] = d; if (k) KR[c] = q; } } } };
    stampa(CP, DP, false, 2); stampa(CR, DR, true, 1);
    for (let c = 0; c < NX * NY; c++) { let h = HRAW[c]; if (DP[c] < 19) h -= 3 * (1 - sstep(14, 19, DP[c])); if (DR[c] < 16) h = Math.min(h, LIV[KR[c]] - 4 + Math.max(0, DR[c] - 5) * 1.4); HCAR[c] = h; }
    const dirs = []; for (let a = 0; a < 8; a++) dirs.push([Math.cos((a / 8) * 6.283), Math.sin((a / 8) * 6.283)]);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = i * ST, y = j * ST, h0 = HCAR[j * NX + i]; let occ = 0;
      for (const [dx, dy] of dirs) { let m = 0; for (const s of [4, 9, 18, 34]) m = Math.max(m, (campH(HCAR, x + dx * s, y + dy * s) - h0) / s); occ += Math.min(1, Math.atan(m) / 1.2); }
      AO[j * NX + i] = 1 - (occ / 8) * 0.55;
    }
  }

  /* =========================================================
     COSTRUZIONE (a passi, con avanzamento)
     ========================================================= */
  const CAT = {}, pezzi = [], HITS = [];
  const ESPLOSO = { sotto: -150, base: -75, terreno: 0, scene: 110, pieno: 110, luci: 110, targhe: 110, sfondo: 0, carta: 0 };
  function reg(obj, from, until, cat, anim = "cade") { CAT[cat].add(obj); pezzi.push({ obj, from, until, cat, anim, y0: obj.position.y }); return obj; }
  let tGeo, tPos, tCol, tMat, sGeo, sPos, sMat, gTerreno, bordoIdx, matAcqua, aGeo, aIdxLen, zampillo, base, gSotto, alimentatore, tuboCurva, erbaMat, gHit, anello;
  const COLORI = {}, spruzzi = [], gocce = [], ALONI = [], PUNTI = [], GT = {};

  async function costruisci() {
    stato("Preparo materiali e texture…"); await pausa();
    preparaTexture(); preparaMotore();
    ["sotto", "base", "terreno", "scene", "pieno", "luci", "targhe", "sfondo", "carta"].forEach((k) => { CAT[k] = new T.Group(); scene.add(CAT[k]); });
    TEX.noce.map.repeat.set(14, 14);
    const tavolo = mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ map: TEX.noce.map, roughness: 0.5 }), 0, -75.5, 0, false); tavolo.rotation.x = -Math.PI / 2; scene.add(tavolo);
    stato("Modello il terreno, le montagne e il fiume…"); await pausa();
    calcolaTerreno(); await pausa();
    costruisciTerreno();
    stato("Costruisco base, impianto e luci…"); await pausa();
    costruisciBaseESotto(); costruisciLuci();
    stato("Scolpisco le 23 scene…"); await pausa();
    costruisciScene();
    stato("Pianto l'erba e popolo il diorama…"); await pausa();
    costruisciRiempimento(); costruisciTargheESfondo(); preparaInterazione();
    stato("Accendo il cielo…"); await pausa();
    impostaTerreno("schiuma", false);
    mats.forEach((m) => { if (m.isMeshStandardMaterial) m.envMapIntensity = m.isMeshPhysicalMaterial ? 1 : m.metalness > 0.5 ? 0.8 : 0.32; });
    aggiornaCielo(true);
    ridimensiona(); new ResizeObserver(ridimensiona).observe(wrap);
    { const v = VISTE.davanti, f = fattore(); camera.position.copy(v[1].clone().add(v[0].clone().sub(v[1]).multiplyScalar(f))); controls.target.copy(v[1]); }
    Object.assign(S3, API, { pronta: true });
    API.fase(window.faseCorrente || coda.fase); API.opzioni(coda.opz);
    requestAnimationFrame(frame);
    const c = document.getElementById("carica3d"); if (c) c.remove();
    document.dispatchEvent(new CustomEvent("diorama3d:pronta"));
  }

  function costruisciTerreno() {
    tGeo = new T.BufferGeometry(); tPos = new Float32Array(NX * NY * 3); tCol = new Float32Array(NX * NY * 3); const uv = new Float32Array(NX * NY * 2);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; tPos.set([i * ST - 400, HRAW[k], j * ST - 250], k * 3); uv.set([(i * ST) / 70, (j * ST) / 70], k * 2); }
    const idx = new Uint32Array((NX - 1) * (NY - 1) * 6); let q = 0;
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx.set([a, c, b, b, c, d], q); q += 6; }
    tGeo.setIndex(new T.BufferAttribute(idx, 1)); tGeo.setAttribute("position", new T.BufferAttribute(tPos, 3)); tGeo.setAttribute("color", new T.BufferAttribute(tCol, 3)); tGeo.setAttribute("uv", new T.BufferAttribute(uv, 2));
    tMat = regMat(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: TEX.terreno.map, normalMap: TEX.terreno.normal, normalScale: new T.Vector2(1.1, 1.1) }), 4);
    const uRoccia = { value: 0 }; tMat.userData.roccia = uRoccia;
    tMat.onBeforeCompile = (sh) => {
      sh.uniforms.uRoccia = uRoccia; sh.uniforms.tRoccia = { value: TEX.roccia.map };
      sh.vertexShader = "varying vec3 vWP; varying vec3 vWN;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = "uniform float uRoccia; uniform sampler2D tRoccia; varying vec3 vWP; varying vec3 vWN;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        if (uRoccia > 0.0) {
          vec3 n = normalize(vWN); vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
          vec3 rc = texture2D(tRoccia, vWP.zy / 46.0).rgb * b.x + texture2D(tRoccia, vWP.xz / 46.0).rgb * b.y + texture2D(tRoccia, vWP.xy / 46.0).rgb * b.z;
          float f = smoothstep(0.28, 0.62, 1.0 - n.y) * uRoccia;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * rc * 1.75, f);
        }`);
    };
    tMat.customProgramCacheKey = () => "terreno-roccia";
    const terreno = new T.Mesh(tGeo, tMat); terreno.receiveShadow = terreno.castShadow = true; terreno.name = "terreno";
    bordoIdx = []; for (let i = 0; i < NX; i++) bordoIdx.push(i); for (let j = 1; j < NY; j++) bordoIdx.push(j * NX + NX - 1); for (let i = NX - 2; i >= 0; i--) bordoIdx.push((NY - 1) * NX + i); for (let j = NY - 2; j >= 0; j--) bordoIdx.push(j * NX);
    sGeo = new T.BufferGeometry(); sPos = new Float32Array(bordoIdx.length * 6); const sUv = new Float32Array(bordoIdx.length * 4), sI = [];
    bordoIdx.forEach((k, n) => { sUv.set([(n * ST) / 60, 1, (n * ST) / 60, 0], n * 4); if (n < bordoIdx.length - 1) { const a = n * 2; sI.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    sGeo.setIndex(sI); sGeo.setAttribute("position", new T.BufferAttribute(sPos, 3)); sGeo.setAttribute("uv", new T.BufferAttribute(sUv, 2));
    sMat = regMat(new T.MeshStandardMaterial({ color: "#e3bf62", roughness: 1, side: T.DoubleSide }), 4);
    const fianco = new T.Mesh(sGeo, sMat); fianco.receiveShadow = true;
    gTerreno = new T.Group(); gTerreno.add(terreno, fianco);
    ["schiuma", "scavato", "gesso", "dipinto"].forEach((s) => (COLORI[s] = coloriStadio(s)));
    reg(gTerreno, 4, 99, "terreno", "schiuma");
    // acqua del fiume
    matAcqua = regMat(new T.MeshPhysicalMaterial({ color: "#2a6e7c", roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, normalMap: TEX.acqua.normal, normalScale: new T.Vector2(0.45, 0.45), transparent: true, opacity: 0.86, envMapIntensity: 1.3 }), 7);
    const aPos = [], aUv = [], aIdx = []; let s = 0;
    CR.forEach((p, i) => { const a = CR[Math.max(0, i - 1)], b = CR[Math.min(CR.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const w = 4.8, y = LIV[i] - 1; aPos.push(p[0] - ty * w - 400, y, p[1] + tx * w - 250, p[0] + ty * w - 400, y, p[1] - tx * w - 250); if (i) s += Math.hypot(p[0] - CR[i - 1][0], p[1] - CR[i - 1][1]); aUv.push(0, s / 30, 0.3, s / 30); if (i < CR.length - 1) { const q2 = i * 2; aIdx.push(q2, q2 + 2, q2 + 1, q2 + 1, q2 + 2, q2 + 3); } });
    aGeo = new T.BufferGeometry(); aGeo.setIndex(aIdx); aIdxLen = aIdx.length; aGeo.setAttribute("position", new T.Float32BufferAttribute(aPos, 3)); aGeo.setAttribute("uv", new T.Float32BufferAttribute(aUv, 2)); aGeo.computeVertexNormals();
    const fiume = new T.Mesh(aGeo, matAcqua); fiume.receiveShadow = true;
    const gAcqua = new T.Group(); gAcqua.add(fiume);
    SALTI3D.forEach((i) => { for (let q2 = 0; q2 < 14; q2++) { const p = CR[Math.min(CR.length - 1, i + 1)], sp = new T.Sprite(new T.SpriteMaterial({ map: TEX.fumo, color: "#ffffff", transparent: true, depthWrite: false, opacity: 0.8 })); sp.position.set(p[0] - 400 + (R() - 0.5) * 8, LIV[i], p[1] - 250 + (R() - 0.5) * 8); sp.userData = { ph: R(), y0: LIV[i] - 0.5 }; spruzzi.push(sp); gAcqua.add(sp); } });
    zampillo = mesh(GS(3.2, 14, 10), regMat(new T.MeshPhysicalMaterial({ color: "#bfe6ff", roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.7 }), 7), SORGENTE[0] - 400, LIV[0] + 1, SORGENTE[1] - 250, false);
    gAcqua.add(zampillo);
    reg(gAcqua, 7, 99, "terreno", "acqua");
    // laghi e mare
    const gLaghi = new T.Group(), matLago = regMat(matAcqua.clone(), 8); matLago.color.set("#1f5a72");
    LAGHI.forEach((L) => { const g = new T.Mesh(new T.CircleGeometry(1, 48), matLago); g.scale.set(L.rx, L.ry, 1); g.rotation.x = -Math.PI / 2; g.position.copy(V(L.x, L.y, 5.5)); g.receiveShadow = true; gLaghi.add(g); });
    { const sh = new T.Shape(); MED.forEach(([x, y], i) => (i ? sh.lineTo(x - 400, -(y - 250)) : sh.moveTo(x - 400, -(y - 250)))); const g = new T.ShapeGeometry(sh), uvA = g.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / 30, uvA.getY(i) / 30); const m = new T.Mesh(g, matLago); m.rotation.x = -Math.PI / 2; m.position.y = 5.5; gLaghi.add(m); }
    reg(gLaghi, 8, 99, "terreno", "nessuna");
    // canalette trasparenti nei salti (fase 5)
    FASE_MAT = 5; const gCan = new T.Group();
    SALTI3D.forEach((i) => { const pts = []; for (let q2 = -10; q2 <= 8; q2 += 2) { const k = Math.min(CR.length - 1, Math.max(0, i + q2)); pts.push(V(CR[k][0], CR[k][1], LIV[k] - 3)); } gCan.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 5.5, 12, false), M("#e8f6ff", { transparent: true, opacity: 0.35, roughness: 0.05, side: T.DoubleSide }), 0, 0, 0, false)); });
    reg(gCan, 5, 99, "terreno");
    // bordo delle radure delle tappe (fase 8)
    FASE_MAT = 8; const gCas = new T.Group();
    const bordi = [], rb = rng(5); TAPPE.forEach((t) => { if (t.n === 23) return; for (let k = -36; k <= 36; k += 5 + rb() * 4) [[k, -36.5], [k, 36.5], [-36.5, k], [36.5, k]].forEach(([a, b]) => { if (rb() < 0.55) bordi.push([t.x + a + (rb() - 0.5) * 2, t.y + b + (rb() - 0.5) * 2, HC[t.n] + 0.2]); }); });
    const imB = new T.InstancedMesh(new T.DodecahedronGeometry(1.3, 0), M("#8a7c66", { roughness: 0.9, flatShading: true }), bordi.length), dm = new T.Object3D(), r = rng(3);
    bordi.forEach((b, i) => { dm.position.copy(V(b[0], b[1], b[2])); dm.rotation.set(r() * 3, r() * 3, r() * 3); dm.scale.set(1 + r() * 0.4, 0.6 + r() * 0.3, 1 + r() * 0.4); dm.updateMatrix(); imB.setMatrixAt(i, dm.matrix); }); imB.castShadow = imB.receiveShadow = true; gCas.add(imB);
    reg(gCas, 8, 99, "terreno", "nessuna");
  }
  function coloriStadio(st) {
    const out = new Float32Array(NX * NY * 3), H = st === "schiuma" ? HRAW : HCAR, c = new T.Color(), tmp = new T.Color(), zone = Object.entries(ZONE_POLY);
    const Z = { origini: [new T.Color("#4f6e2a"), new T.Color("#7a9440")], patriarchi: [new T.Color("#c09d63"), new T.Color("#a67c48")], re: [new T.Color("#a39678"), new T.Color("#8a8a64")], vangeli: [new T.Color("#d4c9ae"), new T.Color("#8f9a5e")] };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, x = i * ST, y = j * ST, h = H[k], n = fbm(x * 0.9, y * 0.9), n2 = fbm(x * 0.25 + 50, y * 0.25);
      const sl = Math.hypot(campH(H, x + 3, y) - campH(H, x - 3, y), campH(H, x, y + 3) - campH(H, x, y - 3)) / 6;
      const cas = inCasella(x, y), dp = DP[k], dr = DR[k], ao = st === "schiuma" ? 1 - (1 - AO[k]) * 0.5 : AO[k];
      if (st === "schiuma" || st === "scavato") { c.set("#e3bf62").multiplyScalar(0.9 + 0.1 * n); if (st === "scavato") { if (cas >= 0) c.set("#ecd07e"); if (dp < 17) c.lerp(tmp.set("#c39c48"), 0.7); if (dr < 7) c.set("#6e5226"); } }
      else if (st === "gesso") { c.set("#e8e5dc").multiplyScalar(0.93 + 0.07 * n); if (cas >= 0) c.set("#f2f0ea"); if (dp < 17) c.lerp(tmp.set("#d9d4c8"), 0.8); if (dr < 7.5) c.set("#141416"); }
      else {
        c.setRGB(0, 0, 0); let cnt = 0;
        for (let a = -40; a <= 40; a += 40) for (let b = -40; b <= 40; b += 40) { let z = "origini"; for (const [kk, p] of zone) if (dentro(p, x + a, y + b)) { z = kk; break; } tmp.copy(Z[z][0]).lerp(Z[z][1], sstep(-0.3, 0.5, n2)); c.add(tmp); cnt++; }
        c.multiplyScalar(1 / cnt).multiplyScalar(0.88 + 0.16 * n);
        if (Math.hypot((x - 100) / 76, (y - 228) / 92) < 0.97) c.lerp(tmp.set("#3f6a22"), 0.55 * (0.6 + 0.4 * n2));
        c.lerp(tmp.set("#7a7064"), Math.min(0.85, sstep(0.55, 1.4, sl) + sstep(45, 100, h) * 0.6));
        if (EROS) { const e = EROS[k]; if (e < 0) c.lerp(tmp.set("#6e6252"), Math.min(0.7, sstep(0.3, 3, -e))); else c.lerp(tmp.set("#b59c70"), Math.min(0.55, sstep(0.2, 2, e))); }
        if (Math.hypot((x - 405) / 56, (y - 150) / 78) < 1) c.lerp(tmp.set("#8e5a3e"), sstep(18, 70, h) * 0.85);
        if (Math.hypot((x - 197) / 78, (y - 182) / 150) < 1) c.lerp(tmp.set("#f4f6f8"), sstep(98, 118, h + n * 8) * (1 - sstep(1.4, 2.4, sl)));
        if (dp < 18.5) c.lerp(dp > 15.5 ? tmp.set("#6e5a40") : tmp.set("#a08463").multiplyScalar(0.92 + 0.12 * n), 1 - sstep(16.5, 18.5, dp) * 0.5);
        if (cas >= 0) c.lerp(tmp.set("#9c8262").multiplyScalar(0.9 + 0.2 * n), 0.55 + 0.25 * sstep(20, 36, cas));
        if (dr < 6.5) c.set("#2e2e22"); else if (dr < 10) c.lerp(tmp.set("#3e4e22"), 0.75);
        if (h < 4.5) c.lerp(tmp.set("#5a5e44"), 0.8);
        if (Math.abs(x - NJ.x) < 45 && Math.abs(y - NJ.y) < 45) c.set("#e8dcbc");
      }
      c.multiplyScalar(ao); out.set([c.r, c.g, c.b], k * 3);
    }
    return out;
  }
  let statoTerreno = null, animColori = null, animAltezze = null;
  function applicaAltezze(H) {
    for (let k = 0; k < NX * NY; k++) tPos[k * 3 + 1] = H[k];
    tGeo.attributes.position.needsUpdate = true; tGeo.computeVertexNormals(); tGeo.computeBoundingSphere();
    bordoIdx.forEach((k, n) => sPos.set([tPos[k * 3], tPos[k * 3 + 1], tPos[k * 3 + 2], tPos[k * 3], 0, tPos[k * 3 + 2]], n * 6));
    sGeo.attributes.position.needsUpdate = true; sGeo.computeVertexNormals(); sGeo.computeBoundingSphere();
  }
  function impostaTerreno(st, anima) {
    if (st === statoTerreno) return;
    const prima = statoTerreno; statoTerreno = st;
    const H = st === "schiuma" ? HRAW : HCAR;
    tMat.userData.fase = sMat.userData.fase = { schiuma: 4, scavato: 5, gesso: 6, dipinto: 8, pieno: 8 }[st];
    tMat.userData.roccia.value = st === "dipinto" || st === "pieno" ? 1 : st === "schiuma" || st === "scavato" ? 0.35 : 0;
    const dip = st === "dipinto" || st === "pieno"; sMat.color.set(st === "gesso" ? "#e8e5dc" : dip ? "#ffffff" : "#e3bf62"); sMat.map = dip ? TEX.terra.map : null; sMat.needsUpdate = true;
    if (anima && prima) {
      animColori = { da: tCol.slice(), a: COLORI[st], t0: performance.now(), dur: 1100 };
      const daH = new Float32Array(NX * NY); for (let k = 0; k < NX * NY; k++) daH[k] = tPos[k * 3 + 1];
      animAltezze = { da: daH, a: H, t0: performance.now(), dur: 1100 };
    } else { tCol.set(COLORI[st]); tGeo.attributes.color.needsUpdate = true; applicaAltezze(H); }
  }

  /* ---------------- base, impianto sotto, carta ---------------- */
  const SVG_TXT = costruisciTabellone();
  function texDaSvg(tenere, cb) {
    const doc = new DOMParser().parseFromString(SVG_TXT, "image/svg+xml"), root = doc.documentElement;
    root.setAttribute("viewBox", "0 0 800 500"); root.setAttribute("width", "2400"); root.setAttribute("height", "1500");
    root.querySelectorAll("g.layer").forEach((g) => { if (!tenere.includes(g.id)) g.remove(); });
    root.querySelectorAll("#ly-click, .scala").forEach((g) => g.remove());
    const st = doc.createElementNS("http://www.w3.org/2000/svg", "style"); st.textContent = "text{font-family:Arial,sans-serif}.t-mini{font-size:8px}.t-num{font-size:8px;font-weight:700}"; root.insertBefore(st, root.firstChild);
    const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = 2400; c.height = 1500; c.getContext("2d").drawImage(img, 0, 0, 2400, 1500); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; cb(t); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(root));
  }
  function costruisciBaseESotto() {
    FASE_MAT = 1;
    const matCarta = M("#d8d2c4", { roughness: 1 }), carta = mesh(new T.PlaneGeometry(800, 500), matCarta, 0, -74.8, 0, false); carta.rotation.x = -Math.PI / 2; reg(carta, 1, 1, "carta", "nessuna");
    texDaSvg(["ly-carta", "ly-matita"], (t) => { matCarta.map = t; matCarta.needsUpdate = true; });
    FASE_MAT = 2;
    TEX.betulla.map.repeat.set(1 / 400, 1 / 400); TEX.strati.map.repeat.set(1 / 60, 1 / 15);
    const mTop = M("#ffffff", { map: TEX.betulla.map, roughness: 0.75 }), mLato = M("#ffffff", { map: TEX.strati.map, roughness: 0.8 });
    const forma = new T.Shape(); forma.moveTo(-400, -250); forma.lineTo(400, -250); forma.lineTo(400, 250); forma.lineTo(-400, 250); forma.lineTo(-400, -250);
    const buco = (x, y, w, h) => { const p = new T.Path(), X = x - 400, Y = -(y - 250); p.moveTo(X - w / 2, Y - h / 2); p.lineTo(X - w / 2, Y + h / 2); p.lineTo(X + w / 2, Y + h / 2); p.lineTo(X + w / 2, Y - h / 2); p.lineTo(X - w / 2, Y - h / 2); return p; };
    const tondo = (x, y, r) => { const p = new T.Path(); p.absarc(x - 400, -(y - 250), r, 0, Math.PI * 2, true); return p; };
    forma.holes.push(buco(NJ.x, NJ.y, 80, 60), tondo(SORGENTE[0], SORGENTE[1], 5)); LUCI.forEach((l) => forma.holes.push(tondo(l.x, l.y, 4)));
    const bg = new T.ExtrudeGeometry(forma, { depth: 15, bevelEnabled: false, curveSegments: 10 }); bg.rotateX(-Math.PI / 2); bg.translate(0, -15, 0);
    base = new T.Mesh(bg, [mTop, mLato]); base.castShadow = base.receiveShadow = true;
    const gBase = new T.Group(); gBase.add(base);
    const mList = M("#b88a58", { tex: "legno", uv: 30 });
    [[0, -235, 800, 30], [0, 235, 800, 30], [-385, 0, 30, 440], [385, 0, 30, 440]].forEach(([x, z, w, d]) => gBase.add(mesh(GB(w, 60, d), mList, x, -45, z)));
    reg(gBase, 2, 99, "base");
    const matDecal = M("#ffffff", { transparent: true, opacity: 0.85, depthWrite: false }), decal = mesh(new T.PlaneGeometry(800, 500), matDecal, 0, 0.6, 0, false); decal.rotation.x = -Math.PI / 2; reg(decal, 2, 3, "base", "nessuna");
    texDaSvg(["ly-matita"], (t) => { matDecal.map = t; matDecal.needsUpdate = true; });
    FASE_MAT = 3;
    gSotto = new T.Group(); const vx = NJ.x - 400, vz = NJ.y - 250;
    gSotto.add(mesh(GB(120, 50, 80), M("#d8eeff", { transparent: true, opacity: 0.3, roughness: 0.05 }), vx, -42, vz), mesh(GB(118, 34, 78), M("#3f8fd0", { transparent: true, opacity: 0.5, roughness: 0.05 }), vx, -50, vz), mesh(GB(26, 20, 18), M("#24282e", { roughness: 0.4 }), vx - 20, -56, vz));
    [-24, 24].forEach((dz) => gSotto.add(mesh(GB(130, 4, 10), M("#8a6a44", { tex: "legno" }), vx, -19, vz + dz * 1.9)));
    tuboCurva = new T.CatmullRomCurve3([V(NJ.x - 20, NJ.y, -50), V(NJ.x - 20, NJ.y, -28), V(NJ.x - 70, NJ.y + 20, -22), V(NJ.x - 70, 470, -22), V(SORGENTE[0], 470, -22), V(SORGENTE[0], SORGENTE[1] + 20, -22), V(SORGENTE[0], SORGENTE[1], -18), V(SORGENTE[0], SORGENTE[1], LIV[0] - 4)], false, "catmullrom", 0.05);
    gSotto.add(mesh(new T.TubeGeometry(tuboCurva, 300, 3.5, 10, false), M("#eef6ff", { transparent: true, opacity: 0.55, roughness: 0.1 })));
    for (let i = 0; i < 40; i++) { const g = mesh(GS(2, 8, 6), M("#2a8ad6", { emissive: "#1a5fa0", emissiveIntensity: 0.8 }), 0, 0, 0, false); g.userData.u = i / 40; gocce.push(g); gSotto.add(g); }
    LUCI.forEach((l) => gSotto.add(mesh(GC(4, 4, 18, 8), M("#f4f4f4", { transparent: true, opacity: 0.7 }), l.x - 400, -6, l.y - 250, false)));
    reg(gSotto, 3, 99, "sotto");
    alimentatore = new T.Group(); alimentatore.add(mesh(GB(50, 30, 70), M("#24282e", { roughness: 0.4 }), 0, 15, 0), mesh(GB(20, 2, 12), M("#ffd34d", { emissive: "#ffb000", emissiveIntensity: 1 }), 0, 31, -15));
    alimentatore.position.set(470, -75, 180); reg(alimentatore, 3, 99, "sotto");
    reg(mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(NJ.x + 30, NJ.y, -30), V(790, NJ.y, -30), V(830, 440, -60), V(870, 430, -60)]), 40, 1.6, 6), M("#151515", { roughness: 0.5 })), 3, 99, "sotto");
  }

  /* ---------------- luci a 12 V (fase 9) ---------------- */
  function costruisciLuci() {
    FASE_MAT = 9; const gLuci = new T.Group();
    LUCI.forEach((l) => {
      const c = { calda: "#ffcf80", fuoco: "#ff8a2a", fredda: "#e8f4ff", stella: "#fff2b0" }[l.t], h = hAt(l.x, l.y) + (l.t === "stella" ? 42 : l.t === "fuoco" ? 6 : 8);
      gLuci.add(mesh(GS(1.6, 8, 6), M(c, { emissive: c, emissiveIntensity: 2 }), l.x - 400, h, l.y - 250, false));
      const sp = new T.Sprite(new T.SpriteMaterial({ map: TEX.alone, color: c, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3, toneMapped: false }));
      sp.position.set(l.x - 400, h, l.y - 250); sp.userData = { fuoco: l.t === "fuoco", base: l.t === "stella" ? 34 : 24 }; gLuci.add(sp); ALONI.push(sp);
      const pl = new T.PointLight(c, 0, 160, 2); pl.position.set(l.x - 400, h + 4, l.y - 250); pl.userData.fuoco = l.t === "fuoco"; gLuci.add(pl); PUNTI.push(pl);
    });
    const L = 94, mo = M("#fff4c2", { emissive: "#fff0b0", emissiveIntensity: 2.5 });
    [[0, -L / 2, L, 1.5], [0, L / 2, L, 1.5], [-L / 2, 0, 1.5, L], [L / 2, 0, 1.5, L]].forEach(([x, z, w, d]) => gLuci.add(mesh(GB(w, 1.5, d), mo, NJ.x - 400 + x, 26, NJ.y - 250 + z, false)));
    [[-25, -25], [25, 25]].forEach(([dx, dz]) => { const pl = new T.PointLight("#fff2c0", 0, 240, 2); pl.position.set(NJ.x - 400 + dx, 40, NJ.y - 250 + dz); gLuci.add(pl); PUNTI.push(pl); });
    reg(gLuci, 9, 99, "luci", "nessuna");
    const gCavi = new T.Group();
    LUCI.forEach((l) => gCavi.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(l.x, l.y, -15), V(l.x, l.y, -24), V(l.x, 488, -24), V(780, 488, -24), V(800, 470, -40)]), 30, 0.8, 4), M("#c62828"), 0, 0, 0, false)));
    reg(gCavi, 9, 99, "sotto", "nessuna");
  }

  /* =========================================================
     SCENE DELLE 23 TAPPE (fase 10)
     ========================================================= */
  let gCorr = null, nCorr = 0;
  const tappa = (n) => { nCorr = n; gCorr = GT[n] = new T.Group(); gCorr.userData.tappa = n; return gCorr; };
  function put(o, x, y, opt = {}) {
    const h = opt.h !== undefined ? opt.h : hAt(x, y);
    o.position.set(x - 400, h + (opt.dy || 0), y - 250);
    if (opt.rot !== undefined) o.rotation.y = opt.rot;
    if (opt.info) { o.userData.info = opt.info; o.userData.tappa = nCorr; }
    gCorr.add(o); return o;
  }
  const info = (o, txt) => { o.userData.info = txt; o.userData.tappa = nCorr; return o; };
  const dirAt = (i) => { const a = CP[Math.max(0, i - 3)], b = CP[Math.min(CP.length - 1, i + 3)]; return -Math.atan2(b[1] - a[1], b[0] - a[0]); };
  function lungo(n, da, a, passo, fn) { for (let s = da; s <= a; s += passo) { const i = IDX[n] + s, p = CP[i]; if (p) fn(p[0], p[1], dirAt(i), s); } }
  const colR = () => VESTI[Math.floor(R() * VESTI.length)];

  // Unisce le geometrie di una tappa per materiale: molte meno "chiamate di disegno", quindi più fluido
  function compatta(g) {
    g.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(g.matrixWorld).invert(), perMat = new Map(), vivi = [], hit = [];
    g.children.forEach((c) => { if (!c.userData.info) return; const b = new T.Box3().setFromObject(c); if (b.isEmpty()) return; b.applyMatrix4(inv); const sz = b.getSize(new T.Vector3()), ce = b.getCenter(new T.Vector3()), m = new T.Mesh(GB(1, 1, 1), MHIT); m.scale.set(Math.max(sz.x, 3), Math.max(sz.y, 3), Math.max(sz.z, 3)); m.position.copy(ce); m.userData = { info: c.userData.info, tappa: c.userData.tappa }; hit.push(m); });
    const visita = (o) => {
      if (o.userData.vivo) { vivi.push(o); return; }
      if (o.isMesh && !o.isInstancedMesh) {
        const m = o.material; if (!perMat.has(m)) perMat.set(m, []);
        const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); gg.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        if (!m.vertexColors && gg.attributes.color) gg.deleteAttribute("color");
        if (!gg.attributes.uv) gg.setAttribute("uv", new T.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
        Object.keys(gg.attributes).forEach((a) => { if (!["position", "normal", "uv", "color"].includes(a)) gg.deleteAttribute(a); });
        gg.morphAttributes = {}; gg.clearGroups(); perMat.get(m).push(gg);
      }
      o.children.forEach(visita);
    };
    g.children.slice().forEach(visita);
    vivi.forEach((v) => { const w = new T.Matrix4().multiplyMatrices(inv, v.matrixWorld); v.parent.remove(v); w.decompose(v.position, v.quaternion, v.scale); });
    g.clear();
    perMat.forEach((arr, m) => {
      const merged = BGU.mergeBufferGeometries(arr, false); if (!merged) return;
      if (m.map && !m.userData.foglie) { const p = merged.attributes.position, nn = merged.attributes.normal, uv = merged.attributes.uv, S = m.userData.uv || 22;
        for (let i = 0; i < p.count; i++) { const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i)); if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) / S, p.getZ(i) / S); else if (ax >= az) uv.setXY(i, p.getZ(i) / S, p.getY(i) / S); else uv.setXY(i, p.getX(i) / S, p.getY(i) / S); } }
      const me = new T.Mesh(merged, m); me.castShadow = !m.transparent; me.receiveShadow = true; if (m.userData.foglie) me.customDepthMaterial = DEPTH_FOGLIE; g.add(me);
    });
    vivi.forEach((v) => g.add(v)); hit.forEach((h) => { g.add(h); HITS.push(h); });
  }

  function costruisciScene() {
    FASE_MAT = 10;
    // 1 · Creazione
    tappa(1);
    { const g = new T.Group(); g.add(mesh(new T.CylinderGeometry(30, 30, 2.5, 48, 1, false, 0, Math.PI), M("#101634", { roughness: 0.4 }), 0, 1.25, 0), mesh(new T.CylinderGeometry(30, 30, 2.5, 48, 1, false, Math.PI, Math.PI), M("#fff3c8", { emissive: "#ffe39a", emissiveIntensity: 0.5 }), 0, 1.25, 0)); g.rotation.y = Math.PI / 4; put(info(g, "Disco luce e buio · Ø 6 cm"), 55, 55); }
    { const s = mesh(GS(7, 24, 16), M("#ffe27a", { emissive: "#ffcc33", emissiveIntensity: 2.4 }), 0, 0, 0, false); s.userData.vivo = true; put(s, 65, 65, { dy: 16, info: "Disco della luce · Ø 3 cm" }); }
    for (let i = 0; i < 12; i++) put(Stella(1.6), 30 + R() * 30, 30 + R() * 22, { dy: 5 + R() * 18 });
    // 2 · Eden
    tappa(2);
    put(AlberoVita(), SORGENTE[0], SORGENTE[1], { info: "Albero della vita · alto 6 cm, chioma Ø 4 cm (stampato 2 volte)" });
    { const a = Albero(1, 1.1); a.rotation.y = 0; const g = new T.Group(); g.add(a); for (let i = 0; i < 9; i++) g.add(mesh(GS(1.4, 8, 6), M("#c0261c", { roughness: 0.35 }), Math.cos(i) * 7, 20 + (i % 3) * 3, Math.sin(i) * 7)); const pts = []; for (let k = 0; k < 44; k++) pts.push(new T.Vector3(Math.cos(k * 0.6) * 2.3, 2 + k * 0.33, Math.sin(k * 0.6) * 2.3)); g.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 80, 0.6, 6), M("#3a6a1a", { roughness: 0.4 }))); put(info(g, "Albero della conoscenza col serpente · alto 4,5 cm"), 52, 258); }
    put(P("#e8d8b8", 1, { velo: false }), 76, 246, { info: "Adamo · 1 cm" }); put(P("#e8d8b8", 1, { velo: "#8a5a2a" }), 83, 249, { info: "Eva · 1 cm" });
    [[Leone, 95, 198], [Pecora, 101, 203], [Elefante, 48, 205], [Giraffa, 62, 196], [Cavallo, 92, 268], [Bue, 40, 230], [Leone, 66, 212], [Pecora, 70, 214]].forEach(([f, x, y]) => put(f(), x, y, { rot: R() * 6, info: "Animali in pace · 3-10 mm" }));
    for (let i = 0; i < 9; i++) put(Albero(i % 4, 0.8 + R() * 0.4), 30 + R() * 90, 160 + R() * 50);
    // 3 · Caino e Abele
    tappa(3);
    put(info(Pietra(11, 9, 10), "Altare di Abele · 1 x 1 x 0,8 cm"), 117, 418); put(info(Pietra(11, 9, 10, "#8a8072"), "Altare di Caino · 1 x 1 x 0,8 cm"), 92, 418);
    put(Fuoco(0.8), 117, 418, { dy: 9 }); put(Fuoco(0.6), 92, 418, { dy: 9 });
    put(P("#8a6a3a", 1, { bastone: true }), 104, 404, { info: "Abele, pastore · 1 cm" }); put(P("#5a3a2a"), 82, 404, { info: "Caino, contadino · 1 cm" });
    for (let i = 0; i < 6; i++) put(mesh(GB(24, 1.6, 2), M("#5a3e22", { tex: "terreno" })), 83, 437 + i * 4);
    for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) put(mesh(GC(0.3, 0.3, 4, 4), M("#9aa83a")), 73 + k * 4, 437 + i * 4, { dy: 2 });
    for (let i = 0; i < 7; i++) put(Pecora(), 120 + R() * 14, 436 + R() * 12, { rot: R() * 6 });
    // 4 · Ararat
    tappa(4);
    put(info(Arca(), "Arca di Noè · 9 x 1,5 x 1 cm (300 x 50 x 30 cubiti)"), 195, 150, { rot: 0.2 });
    put(info(Arcobaleno(), "Arcobaleno · filo di ferro dipinto"), 197, 120, { dy: 2 });
    put(mesh(GS(1.3, 8, 6), M("#ffffff")), 205, 150, { dy: 17, info: "Colomba · 3 mm" });
    for (let i = 0; i < 8; i++) put(P(colR()), 175 + (i % 4) * 7, 172 + Math.floor(i / 4) * 7, { info: "Noè e famiglia · 1 cm" });
    { const anim = [Elefante, Giraffa, Leone, Pecora, Cavallo, Bue, Asino, Cammello, Capra]; lungo(3, 55, 320, 11, (x, y, r, s) => { const f = anim[(s / 11) % anim.length | 0]; put(f(), x - 4, y, { rot: r, info: "Animali a coppie in fila · 3-10 mm" }); put(f(), x + 4, y, { rot: r }); }); }
    // 5 · Babele
    tappa(5);
    put(info(Ziggurat(), "Torre di Babele · base 4,5 cm, alta 6-7 cm"), 305, 82);
    [[268, 118], [272, 124], [322, 120], [328, 116], [262, 70], [260, 78], [282, 60], [330, 60], [334, 92], [316, 110]].forEach(([x, y]) => put(P(colR()), x, y, { info: "Popoli che si disperdono · 1 cm" }));
    put(mesh(GB(8, 4, 5), M("#6a4a2a", { tex: "legno" })), 276, 110, { info: "Carretto di mattoni · 8 mm" });
    for (let i = 0; i < 12; i++) put(Pietra(2.5, 1.5, 4, "#b07a50"), 285 + R() * 12, 102 + R() * 8, { rot: R() * 3 });
    // 6 · Abramo
    tappa(6);
    put(info(Tenda(30, 20, 15, "#5a4232"), "Tenda grande di Abramo · 3 x 2 x 1,5 cm"), 312, 192, { rot: 0.2 });
    put(Tenda(14, 10, 9, "#6a5038"), 282, 210, { rot: 0.8 }); put(Tenda(13, 10, 8, "#4a3828"), 286, 184, { rot: -0.4 }); put(Tenda(12, 9, 8, "#7a6040"), 330, 178, { rot: 1.4 });
    put(P("#e8e0cc", 1, { bastone: true }), 300, 214, { info: "Abramo che guarda le stelle · 1 cm" }); put(P("#3a4a7a"), 306, 216, { info: "Sara · 1 cm" });
    put(Cammello(), 330, 214, { rot: 0.6, info: "Cammelli · 1,2 cm" }); put(Cammello(), 325, 228, { rot: -0.2 }); put(Cammello(), 272, 232, { rot: 2 });
    for (let i = 0; i < 12; i++) put(i % 3 ? Pecora() : Capra(), 268 + R() * 18, 165 + R() * 20, { rot: R() * 6 });
    for (let i = 0; i < 26; i++) put(Stella(1.4), 270 + R() * 60, 168 + R() * 60, { dy: 60 + R() * 60 });
    // 7 · Sodoma
    tappa(7);
    [[272, 292, 12], [284, 288, 8], [278, 314, 6], [266, 305, 10], [262, 286, 5]].forEach(([x, y, h]) => put(Casa(10, 10, h, "#4a3a32"), x, y, { rot: R(), info: "Case in rovina · 1,5 x 1,5 cm" }));
    for (let i = 0; i < 14; i++) put(Pietra(2 + R() * 3, 1.5, 2 + R() * 3, "#3a302a"), 262 + R() * 30, 285 + R() * 30, { rot: R() * 3 });
    put(Fuoco(1.4), 275, 300); put(Fuoco(1), 287, 308); put(Fuoco(0.9), 266, 294);
    put(info(P("#f4f4f2", 1, { velo: "#f4f4f2", pelle: "#f4f4f2" }), "Statua di sale · 1 cm, bianca"), 306, 322, { rot: Math.PI });
    lungo(7, 24, 48, 7, (x, y, r, s) => put(s === 24 || s === 31 ? Angelo() : P(colR()), x, y, { rot: r, info: "Lot, le figlie e due angeli · 1 cm" }));
    // 8 · Patriarchi
    tappa(8);
    { const sc = new T.Group(), oro = M("#d8b04a", { metalness: 0.9, roughness: 0.3 }); [-4, 4].forEach((z) => sc.add(mesh(GB(1, 52, 1), oro, 0, 26, z))); for (let y = 4; y < 52; y += 6) sc.add(mesh(GB(1, 1, 8), oro, 0, y, 0)); sc.rotation.z = -0.35; [18, 30, 42].forEach((y, i) => { const a = Angelo(); a.position.set(1.4, y, i % 2 ? 3 : -3); a.rotation.z = 0.35; sc.add(a); }); put(info(sc, "Scala di Giacobbe con gli angeli · alta 5 cm"), 330, 425); }
    { const g = P("#7b4a2a"); g.rotation.set(0, 0, Math.PI / 2); put(info(g, "Giacobbe che dorme · 1 cm"), 322, 440, { dy: 2.5 }); put(Pietra(4, 3, 4), 315, 440); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; put(P(colR()), 290 + Math.cos(a) * 12, 440 + Math.sin(a) * 9, { rot: -a, info: "I dodici figli di Giacobbe · 1 cm" }); }
    put(Tenda(13, 10, 8, "#5a4232"), 325, 405, { rot: 0.3 }); put(Tenda(12, 9, 8, "#6a5038"), 286, 408, { rot: -0.2 });
    put(info(Pietra(10, 4, 10, "#8a8072"), "Pozzo · Ø 1 cm"), 296, 400); put(mesh(GC(3.5, 3.5, 0.5, 16), M("#1d3a4a", { roughness: 0.1 })), 296, 400, { dy: 4 });
    // 9 · Egitto
    tappa(9);
    [[360, 430, 44, 30], [374, 456, 32, 22], [428, 440, 28, 19]].forEach(([x, y, l, h]) => put(Piramide(l, h), x, y, { info: "Piramidi · base 3 cm, alte 2 cm" }));
    [[418, 392], [426, 400], [416, 405], [430, 390]].forEach(([x, y]) => { const g = new T.Group(); g.add(mesh(GC(4, 4.3, 4, 16), M("#cfae78", { tex: "intonaco" }), 0, 2, 0), mesh(new T.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M("#d8b884", { tex: "intonaco" }), 0, 4, 0)); put(info(g, "Granai a cupola · Ø 1 cm"), x, y); });
    put(info(Pietra(10, 4, 10, "#8a8072"), "Pozzo di Giuseppe · Ø 1 cm"), 404, 416);
    put(P("#f0e0b0", 1, { corona: true, velo: "#2a5aa0" }), 400, 384, { info: "Giuseppe viceré d'Egitto · 1 cm" });
    for (let i = 0; i < 7; i++) put(P(colR()), 385 + i * 4, 390, {});
    put(Cammello(), 350, 400, { rot: 1.5, info: "Carovana di mercanti" }); put(Cammello(), 352, 412, { rot: 1.5 });
    // 10 · Esodo
    tappa(10);
    { const mm = regMat(new T.MeshPhysicalMaterial({ color: "#2a7aa0", roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.72, normalMap: TEX.acqua.normal, normalScale: new T.Vector2(0.6, 0.6) }), 10); [383, 427].forEach((x) => put(info(mesh(GB(18, 30, 70), mm), "Muro d'acqua del Mar Rosso · resina/silicone"), x, 285, { dy: 13 })); }
    put(Cespuglio(1.2), 392, 268, { info: "Roveto ardente · Ø 1,5 cm" }); put(Fuoco(0.9), 392, 268, { dy: 3 });
    put(P("#6a3a2a", 1.05, { bastone: true }), 405, 252, { info: "Mosè col bastone · 1 cm" });
    lungo(10, -26, 28, 6, (x, y, r) => { put(P(colR()), x - 3, y, { rot: r, info: "Il popolo che attraversa · 1 cm" }); put(P(colR()), x + 3, y + 2, { rot: r }); });
    // 11 · Sinai
    tappa(11);
    put(P("#8a3b2a", 1, { bastone: true }), 400, 152, { info: "Mosè sul Sinai · 1 cm" });
    put(info(mesh(GB(5, 7, 1.2), M("#d8d4cc", { tex: "pietra", uv: 6 })), "Tavole della legge · 8 x 6 mm"), 402, 147, { dy: 6 });
    { const t = new T.Group(); t.add(Recinto(40, 20)); t.add(mesh(GB(40, 5, 0.3), M("#f4efe2", { tex: "stoffa", transparent: true, opacity: 0.9 }), 0, 4, -10), mesh(GB(40, 5, 0.3), M("#f4efe2", { tex: "stoffa", transparent: true, opacity: 0.9 }), 0, 4, 10)); t.add(mesh(GB(14, 9, 8), M("#8a5a3a", { tex: "tenda" }), 6, 4.5, 0), mesh(GB(4, 3, 4), M("#c9a14a", { metalness: 0.9, roughness: 0.3 }), -8, 1.5, 0)); put(info(t, "Tenda del convegno con recinto · 4 x 2 cm"), 423, 168, { rot: 0.1 }); }
    put(Pietra(4, 3, 4), 372, 186); put(info(mesh(G_QUAD("#e8b030", 5, 5, "vitello"), M("#ffffff", { vertexColors: true, metalness: 0.95, roughness: 0.25 })), "Vitello d'oro · 8 mm"), 372, 186, { dy: 3 });
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; put(P(colR()), 372 + Math.cos(a) * 10, 186 + Math.sin(a) * 10, { rot: -a, info: "Popolo intorno al vitello · 1 cm" }); }
    { const s = new T.Group(); s.add(mesh(GC(0.5, 0.5, 20, 6), M("#6a4a2a", { tex: "legno" }), 0, 10, 0)); const pts = []; for (let k = 0; k < 30; k++) pts.push(new T.Vector3(Math.cos(k * 0.7) * 1.5, 8 + k * 0.4, Math.sin(k * 0.7) * 1.5)); s.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.55, 6), M("#b07a2a", { metalness: 0.95, roughness: 0.3 }))); put(info(s, "Serpente di bronzo su asta · 2 cm"), 440, 132); }
    // 12 · Gerico e Giudici
    tappa(12);
    put(info(MuraAnello(20, 26, [3, 4, 5, 6]), "Mura di Gerico (un tratto crollato) · Ø 5 cm, alte 1,2 cm"), 480, 75);
    for (let i = 0; i < 12; i++) put(Pietra(3 + R() * 3, 2, 3 + R() * 3, "#c8b898"), 496 + R() * 10, 85 + R() * 10, { rot: R() * 3 });
    [[478, 70], [486, 80], [472, 82]].forEach(([x, y]) => put(Casa(7, 7, 7), x, y));
    for (let i = 0; i < 7; i++) { const a = 0.7 + i * 0.35; put(P("#f0ece0"), 480 + Math.cos(a) * 30, 75 + Math.sin(a) * 30, { info: "Sacerdoti con le trombe · 1 cm" }); }
    for (let i = 0; i < 49; i++) put(mesh(GC(0.3, 0.3, 7, 4), M("#d8b43a")), 512 + (i % 7) * 3, 104 + Math.floor(i / 7) * 3, { dy: 3.5, info: "Campo di grano di Booz" });
    put(P("#6a3a5c"), 520, 126, { info: "Rut che spigola · 1 cm" }); put(P("#2f4f3a"), 532, 118, { info: "Booz · 1 cm" });
    [[455, 108], [466, 108]].forEach(([x, y], i) => { const c = mesh(GC(2, 2.2, 14, 14), M("#d8d0c0", { tex: "pietra", uv: 8 }), 0, 7, 0); c.rotation.z = i ? 0.3 : -0.25; const g = new T.Group(); g.add(c); put(info(g, "Colonne spezzate di Sansone · 1,5 cm"), x, y); });
    put(P("#7a3a1a", 1.15), 460, 110, { info: "Sansone · 1 cm" });
    // 13 · Samuele, Saul, Davide e Golia
    tappa(13);
    { const g = P("#5a5a5a", 2), sc = mesh(GC(3, 3, 0.6, 16), M("#9a8a5a", { metalness: 0.9, roughness: 0.35 }), 2.6, 4.5, 0.6); sc.rotation.z = Math.PI / 2; g.add(sc, mesh(GC(0.2, 0.2, 14, 4), M("#5a4a3a"), -2.6, 7, 0)); put(info(g, "Golia · 2 cm (il doppio degli altri)"), 485, 196); }
    put(P("#a87a3a"), 497, 185, { info: "Davide con la fionda · 1 cm" });
    for (let i = 0; i < 7; i++) { put(P("#4a4a5a"), 466 + i * 6, 214, { info: "Soldati filistei · 1 cm" }); put(P("#7a3b2a"), 470 + i * 6, 166, { info: "Soldati di Saul · 1 cm" }); }
    put(info(Tenda(20, 15, 11, "#8e2b2b"), "Tenda reale di Saul · 2 x 1,5 cm"), 512, 172);
    put(P("#f0ece0", 1, { bastone: true }), 520, 160, { info: "Samuele · 1 cm" });
    // 14 · Tempio
    tappa(14);
    put(info(Tempio(), "Tempio di Salomone · 5 x 3 cm, alto 2,5 cm"), 503, 300);
    { const g = new T.Group(); [[0, -33, 78, 3], [0, 33, 78, 3], [-39, 0, 3, 66], [39, 0, 3, 66]].forEach(([x, z, w, d]) => g.add(mesh(GB(w, 9, d), M("#c8b896", { tex: "pietra", uv: 12 }), x, 4.5, z))); [[-39, -33], [39, -33], [-39, 33], [39, 33]].forEach(([x, z]) => g.add(mesh(GB(7, 13, 7), M("#b8a684", { tex: "pietra", uv: 12 }), x, 6.5, z))); put(info(g, "Mura di Gerusalemme con torri"), 501, 301, { h: HC[14] }); }
    [[472, 278], [474, 324], [530, 280], [532, 322], [486, 324], [518, 322]].forEach(([x, y]) => put(Casa(8, 8, 8 + R() * 3), x, y, { rot: R(), info: "Case di Gerusalemme · 1-1,5 cm" }));
    put(P("#6a2a5c", 1, { corona: true }), 490, 318, { info: "Re Salomone · 1 cm" });
    for (let i = 0; i < 5; i++) put(P("#f0ece0"), 478 + i * 4, 316, { info: "Sacerdoti · 1 cm" });
    // 15 · Carmelo e Giona
    tappa(15);
    put(info(Pietra(13, 6, 10), "Altare di Elia con la legna · 1,5 x 1 cm"), 482, 403); put(Fuoco(1.4), 482, 403, { dy: 6 });
    put(P("#6a4a2a", 1, { bastone: true }), 470, 412, { info: "Elia · 1 cm" });
    for (let i = 0; i < 6; i++) put(P("#5a3a6a"), 503 + i * 4, 432 - i * 2, { info: "Profeti di Baal · 1 cm" });
    { const f = new T.Group(), b = mesh(GS(1, 18, 12), M("#4a5a66", { roughness: 0.35 }), 0, 0, 0); b.scale.set(15, 5, 6); f.add(b); const c = mesh(GK(5, 8, 4), M("#4a5a66"), -16, 0, 0); c.rotation.z = Math.PI / 2; f.add(c); put(info(f, "Grande pesce di Giona · 3 cm"), 440, 476, { h: 6 }); }
    put(Barca(18), 456, 466, { h: 5.5, rot: 0.4, info: "Barchetta · 2 cm" });
    // 16 · Deportazioni
    tappa(16);
    { const g = new T.Group(), bl = M("#1f4f9a", { tex: "pietra", uv: 6, roughness: 0.5 }), oro = M("#e0b040", { metalness: 0.9, roughness: 0.3 }); g.add(mesh(GB(32, 24, 10), bl, 0, 12, 0), mesh(GB(12, 16, 10.4), M("#0e1a30"), 0, 8, 0), mesh(GB(33, 2, 11), oro, 0, 20, 0)); [-18, 18].forEach((x) => { g.add(mesh(GB(7, 30, 12), bl, x, 15, 0)); for (let k = 0; k < 3; k++) g.add(mesh(GB(1.4, 1.6, 12.4), bl, x - 2.5 + k * 2.5, 30.8, 0)); }); for (let k = 0; k < 4; k++) g.add(mesh(GB(3, 2, 0.3), oro, -9 + k * 6, 4 + (k % 2) * 6, 5.2)); put(info(g, "Porta di Babilonia · 3 x 1 cm, alta 2,5 cm"), 578, 398); }
    { const g = new T.Group(); g.add(mesh(GC(12, 12, 1, 32), M("#2a1e14"), 0, 0.5, 0)); for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, b = mesh(GB(4, 5, 2), M("#8a8072", { tex: "pietra", uv: 8 }), Math.cos(a) * 12, 2.5, Math.sin(a) * 12); b.rotation.y = -a; g.add(b); } put(info(g, "Fossa dei leoni · scavata nella schiuma"), 615, 432); }
    put(P("#2f4f8a"), 615, 432, { dy: 1, info: "Daniele · 1 cm" });
    [[607, 426], [623, 428], [609, 440], [622, 438]].forEach(([x, y]) => put(Leone(), x, y, { dy: 1, rot: R() * 6, info: "Leoni · 6 mm" }));
    lungo(16, -64, -24, 5, (x, y, r) => put(P("#6a6a6a"), x, y, { rot: r, info: "Prigionieri deportati · 1 cm" }));
    // 17 · Neemia
    tappa(17);
    { const g = new T.Group(), pm = M("#c2b292", { tex: "pietra", uv: 10 }); g.add(mesh(GB(50, 16, 5), pm, 0, 8, 0), mesh(GB(5, 8, 25), pm, 25, 4, 12), mesh(GB(5, 3, 25), pm, 25, 1.5, 37)); for (let i = 0; i < 4; i++) g.add(mesh(GC(0.35, 0.35, 20, 4), M("#7a5a38"), 30, 10, 6 + i * 7)); g.add(mesh(GB(1, 0.4, 24), M("#7a5a38", { tex: "legno" }), 30, 12, 16)); put(info(g, "Mura in ricostruzione · moduli 3 x 0,5 x 1,5 cm"), 600, 276); }
    [[588, 292], [600, 318], [612, 296]].forEach(([x, y]) => put(Casa(9, 9, 9), x, y));
    for (let i = 0; i < 14; i++) put(Pietra(3, 3, 3, "#d0c2a2"), 630 + R() * 8, 286 + R() * 30, { rot: R() });
    [[632, 282], [634, 298], [628, 312], [606, 286]].forEach(([x, y]) => put(P("#8a5a3a"), x, y, { info: "Muratori di Neemia · 1 cm" }));
    // 18 · Betlemme
    tappa(18);
    { const g = new T.Group(), lg = M("#6a4a2b", { tex: "legno" }); g.add(mesh(GB(30, 16, 1.5), lg, 0, 8, -10), mesh(GB(1.5, 16, 20), lg, -15, 8, 0), mesh(GB(1.5, 16, 20), lg, 15, 8, 0)); const t = mesh(GB(34, 1.5, 24), M("#c8a860", { tex: "tenda" }), 0, 17, 0); t.rotation.x = 0.18; g.add(t, mesh(GB(6, 3, 3), M("#c9a46a", { tex: "legno" }), 0, 1.5, -2)); for (let i = 0; i < 8; i++) g.add(mesh(GC(0.15, 0.15, 3, 3), M("#e0c060"), -2 + i * 0.6, 3.2, -2)); put(info(g, "Stalla · 3 x 2 cm, alta 2 cm"), 600, 196); }
    put(P("#2f4f9a", 1, { velo: "#5a80c0" }), 594, 200, { info: "Maria · 1 cm" }); put(P("#8a5a2a", 1, { bastone: true }), 606, 200, { info: "Giuseppe · 1 cm" });
    { const b = mesh(GS(1.4, 10, 8), M("#fff3e0", { emissive: "#ffe0a0", emissiveIntensity: 1.2 }), 0, 0, 0); b.userData.vivo = true; put(b, 600, 194, { dy: 3.5, info: "Gesù Bambino · 4 mm" }); }
    put(Bue(), 590, 190, { rot: 0.5 }); put(Asino(), 610, 190, { rot: 2.5 });
    { const g = new T.Group(); g.userData.vivo = true; g.add(mesh(GC(0.25, 0.25, 40, 4), M("#9a9a9a", { metalness: 0.8 }), 0, 20, 0)); const st = Stella(6); st.position.y = 42; g.add(st); put(info(g, "Stella cometa su filo · con LED"), 604, 172); }
    [[574, 214], [580, 220], [628, 212], [625, 222], [568, 172]].forEach(([x, y]) => put(P("#6b5a3a", 1, { bastone: true }), x, y, { info: "Pastori · 1 cm" }));
    for (let i = 0; i < 16; i++) put(Pecora(), 565 + R() * 24, 160 + R() * 14, { rot: R() * 6, info: "Pecore · 4 mm" });
    lungo(18, -70, -36, 11, (x, y, r, s) => { put(Cammello(), x + 5, y, { rot: r, info: "Magi con i cammelli · 1-1,2 cm" }); put(P(["#6a1a5a", "#1a4a8a", "#c9a14a"][Math.abs(s / 11) % 3 | 0], 1, { corona: true }), x - 6, y, { rot: r }); });
    // 19 · Galilea
    tappa(19);
    put(Barca(20), 560, 45, { h: 5.5, rot: 0.3, info: "Barca dei pescatori · 2 cm" }); put(P("#3a5a7a"), 557, 45, { h: 7 }); put(P("#7a3a2a"), 563, 46, { h: 7 });
    for (let i = 0; i < 14; i++) put(Seduto(colR()), 612 + (i % 5) * 7, 100 + Math.floor(i / 5) * 7, { info: "Folla seduta sull'erba · 1 cm" });
    for (let i = 0; i < 6; i++) put(mesh(GC(2, 1.6, 2.5, 10), M("#a07038", { tex: "legno" })), 640 + (i % 3) * 5, 62 + Math.floor(i / 3) * 5, { dy: 1.2, info: "Ceste dei pani e dei pesci · 4 mm" });
    put(P("#f4f0e4", 1, { velo: "#b03a2e" }), 630, 80, { info: "Gesù · 1 cm" });
    lungo(19, 38, 90, 10, (x, y, r) => { put(Palma(Math.floor(R() * 3)), x - 12, y, {}); put(P(colR()), x + 9, y, { rot: r, info: "Folla con rami di palma · 1 cm" }); });
    { const g = new T.Group(); g.add(Asino()); const gs = P("#f4f0e4", 0.9, { velo: "#b03a2e" }); gs.position.set(0, 4, 0); g.add(gs); lungo(19, 64, 64, 1, (x, y, r) => put(info(g, "Gesù sull'asinello · 1,2 cm"), x, y, { rot: r })); }
    // 20 · Calvario
    tappa(20);
    [[708, 105, 22], [720, 98, 28], [732, 105, 22]].forEach(([x, y, h]) => put(Croce(h), x, y, { info: "Croci · alte 2,5 cm (centrale 3 cm)" }));
    { const g = new T.Group(), roc = mesh(deforma(new T.IcosahedronGeometry(11, 1), 0.15, 4), M("#8f877a", { tex: "pietra", uv: 10 }), 0, 7, 0), porta = mesh(GC(5, 5, 0.6, 20), M("#0e0e0e"), 0, 6, 8.5); roc.scale.set(1.1, 0.75, 0.8); porta.rotation.x = Math.PI / 2; g.add(roc, porta); put(info(g, "Sepolcro vuoto · 2 x 1,5 cm"), 752, 135, { rot: -0.4 }); }
    { const p = mesh(GC(6, 6, 2.2, 24), M("#a59d8f", { tex: "pietra", uv: 8 })); p.rotation.x = Math.PI / 2; p.position.y = 6; const g = new T.Group(); g.add(p); put(info(g, "Pietra rotonda rotolata · Ø 1,2 cm"), 740, 150, { rot: -0.4 }); }
    put(Angelo(), 742, 140, { info: "Angelo · 1 cm" }); put(P("#3a3a6a"), 732, 146, { info: "Le donne al sepolcro · 1 cm" }); put(P("#6a2a3a"), 728, 140, {});
    put(P("#8a2a2a", 1, { velo: "#5a5a5a" }), 700, 120, { info: "Soldati romani · 1 cm" });
    // 21 · Pentecoste
    tappa(21);
    { const g = new T.Group(), im = M("#e2d6bd", { tex: "intonaco" }); [-12, 12].forEach((z) => g.add(mesh(GB(30, 16, 1.5), im, 0, 8, z))); [-15, 15].forEach((x) => g.add(mesh(GB(1.5, 16, 25), im, x, 8, 0))); g.add(mesh(GB(2.4, 5, 0.3), M("#3a2818", { tex: "legno" }), 5, 2.5, 12.8)); put(info(g, "Cenacolo (tetto aperto) · 3 x 2,5 cm"), 715, 222); }
    for (let i = 0; i < 13; i++) { const a = (i / 13) * Math.PI * 2; put(P(i === 0 ? "#2f4f9a" : colR()), 715 + Math.cos(a) * 8, 222 + Math.sin(a) * 6, { info: "Apostoli e Maria · 1 cm" }); const f = mesh(GK(0.9, 3, 8), M("#ff9a2a", { emissive: "#ff6a00", emissiveIntensity: 3 }), 0, 0, 0, false); f.userData.vivo = true; put(f, 715 + Math.cos(a) * 8, 222 + Math.sin(a) * 6, { dy: 13, info: "Lingue di fuoco · 3 mm" }); }
    for (let i = 0; i < 10; i++) put(P(colR()), 690 + R() * 10, 240 + R() * 16, { info: "Folla di tutti i popoli · 1 cm" });
    // 22 · Paolo
    tappa(22);
    put(info(Nave(), "Nave di Paolo · 3 cm"), 772, 322, { h: 5.5, rot: 1.2 });
    { const g = P("#8a2a2a"); g.rotation.set(0, 0, Math.PI / 2); put(info(g, "Paolo caduto a terra · 1 cm"), 696, 334, { dy: 2.5 }); }
    put(Cavallo(), 708, 342, { rot: 0.8, info: "Cavallo · 1,3 cm" });
    { const r = mesh(geo("raggio", () => new T.CylinderGeometry(3, 10, 80, 20, 1, true)), M("#fff8d0", { transparent: true, opacity: 0.14, emissive: "#fff2a0", emissiveIntensity: 1.5, depthWrite: false, side: T.DoubleSide }), 0, 0, 0, false); r.userData.vivo = true; put(r, 698, 334, { dy: 40, info: "Luce dal cielo sulla via di Damasco" }); }
    for (let i = 0; i < 4; i++) put(P(colR()), 684 + i * 4, 318, { info: "Compagni di viaggio · 1 cm" });
    // 23 · Nuova Gerusalemme
    tappa(23);
    { const g = new T.Group(), L = 90, h = 15, mo = M("#f0c860", { metalness: 0.95, roughness: 0.22, emissive: "#a8781a", emissiveIntensity: 0.12 }), pe = M("#fbf6ec", { roughness: 0.15, metalness: 0.1, emissive: "#fff0d0", emissiveIntensity: 0.15 });
      [[0, -L / 2, L, 3], [0, L / 2, L, 3], [-L / 2, 0, 3, L], [L / 2, 0, 3, L]].forEach(([x, z, w, d]) => g.add(mesh(GB(w, h, d), mo, x, h / 2, z)));
      for (let i = 1; i <= 3; i++) { const o = -L / 2 + (L / 4) * i; [[o, -L / 2, 0], [o, L / 2, 0], [-L / 2, o, 1], [L / 2, o, 1]].forEach(([x, z, r]) => { const p = new T.Group(); p.add(mesh(GB(9, 19, 9), pe, 0, 9.5, 0), mesh(new T.SphereGeometry(4.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), pe, 0, 19, 0)); p.position.set(x, 0, z); p.rotation.y = r ? Math.PI / 2 : 0; g.add(p); }); }
      [[-L / 2, -L / 2], [L / 2, -L / 2], [-L / 2, L / 2], [L / 2, L / 2]].forEach(([x, z]) => g.add(mesh(GB(10, 22, 10), mo, x, 11, z)));
      g.add(mesh(GB(L - 6, 1, L - 6), M("#fff3c4", { transparent: true, opacity: 0.55, metalness: 0.5, roughness: 0.15 }), 0, 1, 0));
      put(info(g, "Nuova Gerusalemme · 9 x 9 cm, 12 porte (piazza staccabile: sotto c'è la pompa)"), NJ.x, NJ.y, { h: 10 }); }
    put(AlberoVita(), FOCE[0], FOCE[1], { h: 10, info: "Albero della vita · identico a quello dell'Eden" });
    for (let i = 0; i < 20; i++) put(P(i % 3 ? "#f6f2e8" : colR()), 700 + R() * 70, 405 + R() * 60, { h: 11, info: "Popoli in festa · 1 cm" });
    // ponticelli
    tappa(0);
    PONTI.forEach(([x, y]) => { let k = 0, bd = 1e9; CR.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; k = i; } }); const a = CR[Math.max(0, k - 3)], b = CR[Math.min(CR.length - 1, k + 3)]; put(info(Ponte(), "Ponticello · 4 x 2 cm (dove il fiume incrocia il sentiero)"), x, y, { h: LIV[k] + 3, rot: -Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2 }); });
    Object.values(GT).forEach((g) => { compatta(g); reg(g, 10, 99, "scene", "cade"); });
  }

  /* =========================================================
     FASE 11 · Vegetazione e folla (instanced: migliaia di oggetti)
     ========================================================= */
  function costruisciRiempimento() {
    FASE_MAT = 11;
    const gPieno = new T.Group(), dm = new T.Object3D(), col = new T.Color();
    function inst(g, m, arr, colori, ombra = true) {
      if (!arr.length) return null;
      const im = new T.InstancedMesh(g, m, arr.length); im.castShadow = ombra; im.receiveShadow = true;
      arr.forEach((a, i) => { dm.position.set(a[0] - 400, a[2], a[1] - 250); dm.rotation.set(0, a[3], 0); const s = a[4] || 1; if (Array.isArray(a[6])) dm.scale.set(s * a[6][0], s * a[6][1], s * a[6][2]); else dm.scale.setScalar(s); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); if (colori) im.setColorAt(i, col.set(a[5])); });
      if (m.userData.foglie) im.customDepthMaterial = DEPTH_FOGLIE;
      gPieno.add(im); return im;
    }
    const tiles = TAPPE.map((t) => [t.x, t.y]);
    const vietati = [[195, 150, 50], [305, 82, 28], [360, 436, 32], [NJ.x, NJ.y, 55], [565, 45, 30], [445, 474, 34], [503, 300, 42], [480, 75, 26], [405, 285, 36], [SORGENTE[0], SORGENTE[1], 24]];
    const L = { persona: [], pecora: [], albero: [[], [], [], []], palma: [[], [], []], cipresso: [], ulivo: [[], [], []], tenda: [], casa: [], fiore: [], cespuglio: [[], [], [], []], roccia: [], cammello: [], sasso: [] };
    const tipi = {
      origini: ["albero", "albero", "cespuglio", "fiore", "albero", "pecora", "cespuglio", "roccia", "albero", "fiore"],
      patriarchi: ["pecora", "pecora", "cammello", "tenda", "palma", "persona", "palma", "roccia", "cespuglio", "tenda"],
      re: ["casa", "persona", "ulivo", "pecora", "persona", "casa", "cipresso", "roccia", "ulivo", "cespuglio"],
      vangeli: ["persona", "pecora", "palma", "pecora", "persona", "casa", "ulivo", "cipresso", "ulivo", "cespuglio"],
    };
    const zonaDi = (x, y) => { for (const [k, p] of Object.entries(ZONE_POLY)) if (dentro(p, x, y)) return k; return "origini"; };
    const libero = (x, y, dpMin = 21, drMin = 10) => !(cella(DP, x, y) < dpMin || cella(DR, x, y) < drMin || tiles.some(([tx, ty]) => Math.abs(tx - x) < 41 && Math.abs(ty - y) < 41) || vietati.some(([vx, vy, vr]) => (vx - x) ** 2 + (vy - y) ** 2 < vr * vr) || dentro(MED, x, y) || hAt(x, y) < 5 || x < 4 || y < 4 || x > 796 || y > 496);
    const r = rng(2024); let fatti = 0, prove = 0;
    while (fatti < 950 && prove < 24000) {
      prove++; const x = 4 + r() * 792, y = 4 + r() * 492;
      if (!libero(x, y)) continue;
      const t = tipi[zonaDi(x, y)][Math.floor(r() * 10)], h = hAt(x, y), rot = r() * 6.28;
      if (t === "pecora") { for (let k = 0; k < 4 + (r() * 5 | 0); k++) { const px = x + (r() - 0.5) * 16, py = y + (r() - 0.5) * 12; L.pecora.push([px, py, hAt(px, py), r() * 6.28, 0.9 + r() * 0.2]); } L.persona.push([x + 9, y, hAt(x + 9, y), r() * 6, 1, "#6b5a3a", "#8a7a5a"]); }
      else if (t === "persona") { for (let k = 0; k < 2 + (r() * 5 | 0); k++) { const px = x + (r() - 0.5) * 12, py = y + (r() - 0.5) * 10; L.persona.push([px, py, hAt(px, py), r() * 6.28, 0.95 + r() * 0.1, VESTI[Math.floor(r() * VESTI.length)], VESTI[Math.floor(r() * VESTI.length)]]); } }
      else if (t === "fiore") { for (let k = 0; k < 10; k++) { const px = x + (r() - 0.5) * 14, py = y + (r() - 0.5) * 14; L.fiore.push([px, py, hAt(px, py) + 2.2, 0, 0.7 + r() * 0.5, ["#f2c14e", "#e8507a", "#ffffff", "#b07ae0", "#ff7a3a"][k % 5]]); } }
      else if (t === "albero") L.albero[Math.floor(r() * 4)].push([x, y, h - 0.5, rot, 0.75 + r() * 0.5]);
      else if (t === "palma") L.palma[Math.floor(r() * 3)].push([x, y, h - 0.5, rot, 0.85 + r() * 0.3]);
      else if (t === "ulivo") L.ulivo[Math.floor(r() * 3)].push([x, y, h - 0.5, rot, 0.85 + r() * 0.3]);
      else if (t === "cespuglio") L.cespuglio[Math.floor(r() * 4)].push([x, y, h - 0.3, rot, 0.7 + r() * 0.6]);
      else if (t === "cipresso") L.cipresso.push([x, y, h - 0.5, rot, 0.8 + r() * 0.4]);
      else if (t === "roccia") L.roccia.push([x, y, h - 1, rot, 1 + r() * 2.4]);
      else if (t === "cammello") L.cammello.push([x, y, h, rot, 1]);
      else if (t === "tenda") L.tenda.push([x, y, h, rot, 0.9 + r() * 0.3]);
      else if (t === "casa") L.casa.push([x, y, h, rot, 0.85 + r() * 0.3]);
      fatti++;
    }
    for (let i = 0; i < 700; i++) { const x = r() * 800, y = r() * 500, sl = Math.abs(hAt(x + 3, y) - hAt(x - 3, y)) + Math.abs(hAt(x, y + 3) - hAt(x, y - 3)); if (sl > 5 && libero(x, y, 18, 8)) L.roccia.push([x, y, hAt(x, y) - 1, r() * 6, 1.5 + r() * 3]); }
    for (let q = 0; q < CP.length; q += 3) { const p = CP[q], a = dirAt(q) + Math.PI / 2, s = r() < 0.5 ? -1 : 1, d = 16 + r() * 4, x = p[0] + Math.cos(-a) * d * s, y = p[1] + Math.sin(-a) * d * s; if (inCasella(x, y) < 0) L.sasso.push([x, y, hAt(x, y) - 0.3, r() * 6, 0.6 + r() * 0.8]); }
    const mVeste = M("#ffffff", { tex: "stoffa", roughness: 0.95 });
    inst(G_VESTE(), mVeste, L.persona, true);
    inst(G_TESTA(), M(PELLI[1], { roughness: 0.7 }), L.persona, false);
    inst(G_VELO(), mVeste, L.persona.map((a) => [a[0], a[1], a[2], a[3], a[4], a[6]]), true);
    inst(G_PECORA(), MV(), L.pecora);
    L.albero.forEach((a, v) => inst(G_ALBERO(v), MFOG(), a));
    L.palma.forEach((a, v) => inst(G_PALMA(v), MVEG(), a));
    L.ulivo.forEach((a, v) => inst(G_ULIVO(v), MFOG(), a));
    L.cespuglio.forEach((a, v) => inst(G_CESPUGLIO(v), MFOG(), a));
    inst(G_CIPRESSO(), MVEG(), L.cipresso);
    inst(G_CAMMELLO(), MV(), L.cammello);
    inst(deforma(new T.DodecahedronGeometry(2.2, 1), 0.25, 8), M("#8a8274", { tex: "pietra", uv: 8, roughness: 0.95, flatShading: true }), L.roccia);
    inst(new T.DodecahedronGeometry(1.1, 0), M("#9a8e7a", { roughness: 0.9, flatShading: true }), L.sasso);
    inst(new T.IcosahedronGeometry(0.75, 0), M("#ffffff", { emissive: "#222222", roughness: 0.6 }), L.fiore, true, false);
    inst(geo("tendaFill", () => { const s = new T.Shape(); s.moveTo(-5.5, 0); s.quadraticCurveTo(-1.5, 6, 0, 8); s.quadraticCurveTo(1.5, 6, 5.5, 0); s.lineTo(-5.5, 0); const e = new T.ExtrudeGeometry(s, { depth: 9, bevelEnabled: false, curveSegments: 5 }); e.translate(0, 0, -4.5); return e; }), M("#5a4232", { tex: "tenda", side: T.DoubleSide }), L.tenda);
    inst(geo("casaFill", () => unisci([parte(GB(9, 9, 9), "#ffffff", 0, 4.5, 0), parte(GB(9.8, 1, 9.8), "#e6dcc8", 0, 9.5, 0), parte(GB(2.2, 4.4, 0.3), "#3a2818", 1.6, 2.2, 4.6), parte(GB(1.4, 1.4, 0.3), "#1a140e", -2.2, 6, 4.6)])), M("#e6dac2", { vertexColors: true, tex: "intonaco" }), L.casa);
    // ERBA che si muove al vento
    erbaMat = M("#ffffff", { vertexColors: true, side: T.DoubleSide, roughness: 1 });
    const tempo = { value: 0 }; erbaMat.userData.tempo = tempo;
    erbaMat.onBeforeCompile = (sh) => { sh.uniforms.uTempo = tempo; sh.vertexShader = "uniform float uTempo;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\n float fase = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.07;\n transformed.x += sin(uTempo * 2.2 + fase) * position.y * 0.12;\n transformed.z += cos(uTempo * 1.7 + fase) * position.y * 0.08;\n#endif"); };
    erbaMat.customProgramCacheKey = () => "erba-vento";
    const ciuffo = geo("ciuffo", () => { const parti = []; for (let b = 0; b < 6; b++) { const g = new T.BufferGeometry(), a = (b / 6) * Math.PI * 2 + b, h = 3 + (b % 3) * 1.2; g.setAttribute("position", new T.Float32BufferAttribute([-0.35, 0, 0, 0.35, 0, 0, 0.5, h, 0.2], 3)); g.setAttribute("normal", new T.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.5, 1], 3)); g.setAttribute("uv", new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); g.setAttribute("color", new T.Float32BufferAttribute([0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 1, 1, 1], 3)); g.rotateY(a); g.translate(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6); parti.push(g); } return BGU.mergeBufferGeometries(parti); });
    const erba = [], ZE = { origini: [1, "#4a7a2a", "#7a9a3a"], patriarchi: [0.22, "#9a8a4a", "#c0a868"], re: [0.5, "#6a7a3a", "#9a9a5a"], vangeli: [0.5, "#6a8a3a", "#a0a868"] };
    for (let i = 0; i < Q.erba * 4 && erba.length < Q.erba; i++) {
      const x = r() * 800, y = r() * 500; if (cella(DP, x, y) < 17 || cella(DR, x, y) < 7 || inCasella(x, y) >= 0 || dentro(MED, x, y)) continue;
      const h = hAt(x, y); if (h < 5 || h > 98 || (Math.abs(x - NJ.x) < 46 && Math.abs(y - NJ.y) < 46)) continue;
      const ze = ZE[zonaDi(x, y)], eden = Math.hypot((x - 100) / 76, (y - 228) / 92) < 1; if (r() > (eden ? 1 : ze[0])) continue;
      if (Math.abs(hAt(x + 3, y) - hAt(x - 3, y)) + Math.abs(hAt(x, y + 3) - hAt(x, y - 3)) > 7) continue;
      erba.push([x, y, h - 0.3, r() * 6.28, 0.7 + r() * 0.8, "#" + col.set(ze[1]).lerp(new T.Color(ze[2]), r()).getHexString()]);
    }
    inst(ciuffo, erbaMat, erba, true, false);
    const canne = []; for (let q = 0; q < CR.length - 1; q += 2) { if (r() < 0.45) continue; const p = CR[q], s = r() < 0.5 ? -1 : 1, a = Math.atan2(CR[q + 1][1] - p[1], CR[q + 1][0] - p[0]) + Math.PI / 2, d = 8 + r() * 4, x = p[0] + Math.cos(a) * d * s, y = p[1] + Math.sin(a) * d * s; if (inCasella(x, y) >= 0 || cella(DP, x, y) < 16) continue; canne.push([x, y, hAt(x, y), r() * 6, 1, "#5a8a3a", [0.7, 2.6 + r() * 1.5, 0.7]]); }
    inst(ciuffo, erbaMat, canne, true, false);
    reg(gPieno, 11, 99, "pieno", "cade");
    // ombre di contatto: il terreno si scurisce sotto alberi, case, tende, rocce e scene
    const ombre = [];
    L.albero.flat().forEach((a) => ombre.push([a[0], a[1], 9 * a[4], 0.45])); L.ulivo.flat().forEach((a) => ombre.push([a[0], a[1], 7 * a[4], 0.4])); L.palma.flat().forEach((a) => ombre.push([a[0], a[1], 5, 0.3]));
    L.cipresso.forEach((a) => ombre.push([a[0], a[1], 4.5, 0.4])); L.cespuglio.flat().forEach((a) => ombre.push([a[0], a[1], 4 * a[4], 0.4]));
    L.casa.forEach((a) => ombre.push([a[0], a[1], 8 * a[4], 0.45])); L.tenda.forEach((a) => ombre.push([a[0], a[1], 7, 0.4])); L.roccia.forEach((a) => ombre.push([a[0], a[1], 2.6 * a[4], 0.4]));
    L.persona.forEach((a) => ombre.push([a[0], a[1], 3, 0.25])); L.pecora.forEach((a) => ombre.push([a[0], a[1], 3, 0.2])); L.cammello.forEach((a) => ombre.push([a[0], a[1], 6, 0.3]));
    HITS.forEach((h) => { const r = Math.max(h.scale.x, h.scale.z) / 2 + 2; if (r < 60) ombre.push([h.position.x + 400, h.position.z + 250, r, 0.35]); });
    const P2 = COLORI.dipinto.slice(), fatt = new Float32Array(NX * NY).fill(1);
    ombre.forEach(([x, y, r, k]) => { const ci = Math.round(x / ST), cj = Math.round(y / ST), rr = Math.ceil(r / ST); for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++) { if (i < 0 || j < 0 || i >= NX || j >= NY) continue; const d = Math.hypot(i * ST - x, j * ST - y) / r; if (d < 1) fatt[j * NX + i] *= 1 - k * Math.pow(1 - d, 1.4); } });
    for (let c = 0; c < NX * NY; c++) { const f = Math.max(0.45, fatt[c]); P2[c * 3] *= f; P2[c * 3 + 1] *= f; P2[c * 3 + 2] *= f; }
    COLORI.pieno = P2;
  }

  /* ---------------- targhette (12) e sfondo (13) ---------------- */
  function costruisciTargheESfondo() {
    FASE_MAT = 12; const gTarghe = new T.Group();
    TAPPE.forEach((t) => {
      const c = document.createElement("canvas"); c.width = 384; c.height = 140; const x = c.getContext("2d");
      const gr = x.createLinearGradient(0, 0, 0, 140); gr.addColorStop(0, "#d9b25a"); gr.addColorStop(0.5, "#f3dc8e"); gr.addColorStop(1, "#b8903a"); x.fillStyle = gr; x.fillRect(0, 0, 384, 140);
      x.strokeStyle = "#7a5a1a"; x.lineWidth = 6; x.strokeRect(8, 8, 368, 124);
      x.fillStyle = "#3a2a10"; x.font = "bold 64px Georgia, serif"; x.fillText(String(t.n), 22, 84);
      x.font = "bold 40px Georgia, serif"; x.fillText(ETICHETTE[t.n], t.n > 9 ? 100 : 74, 64); x.font = "italic 30px Georgia, serif"; x.fillText(t.rif.split(";")[0], t.n > 9 ? 100 : 74, 108);
      const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
      const g = new T.Group(), lato = M("#a8802a", { metalness: 0.9, roughness: 0.35 });
      const pl = mesh(geo("targa", () => new T.BoxGeometry(30, 11, 0.8)), [lato, lato, lato, lato, regMat(new T.MeshStandardMaterial({ map: tex, metalness: 0.7, roughness: 0.35 }), 12), lato]);
      pl.position.y = 12; pl.rotation.x = -0.5; g.add(pl, mesh(GC(0.5, 0.5, 12, 6), M("#4a3a2a"), 0, 6, 0));
      const px = t.n === 23 ? t.x - 22 : t.x > 680 ? t.x - 56 : t.x + 55, py = t.n === 23 ? t.y - 60 : t.y + 8;
      g.position.copy(V(px, py, hAt(px, py))); gTarghe.add(g);
    });
    reg(gTarghe, 12, 99, "targhe", "cade");
    FASE_MAT = 13;
    function texCielo(w, h, stops, stelle) { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"), gr = x.createLinearGradient(0, 0, w, 0); stops.forEach(([o, col]) => gr.addColorStop(o, col)); x.fillStyle = gr; x.fillRect(0, 0, w, h); const g2 = x.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, "rgba(0,0,30,.35)"); g2.addColorStop(1, "rgba(255,255,255,.12)"); x.fillStyle = g2; x.fillRect(0, 0, w, h); for (let i = 0; i < stelle; i++) { const sx = Math.random() * w, a = 1 - Math.abs(sx / w - 0.55) * 1.6; if (a <= 0) continue; x.fillStyle = `rgba(255,255,255,${a * (0.4 + Math.random() * 0.6)})`; x.beginPath(); x.arc(sx, Math.random() * h * 0.8, Math.random() * 2.2 + 0.4, 0, 7); x.fill(); } const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
    const gS = new T.Group();
    gS.add(mesh(new T.PlaneGeometry(816, 300), M("#ffffff", { map: texCielo(2048, 760, [[0, "#f3b07a"], [0.16, "#6a8fd0"], [0.45, "#0d1640"], [0.8, "#1d2a6a"], [1, "#f6d77a"]], 900), roughness: 1 }), 0, 135, -258, false), mesh(GB(820, 300, 4), M("#6a4a2a", { tex: "legno" }), 0, 135, -261));
    [[-1, [[0, "#f3b07a"], [1, "#6a8fd0"]]], [1, [[0, "#1d2a6a"], [1, "#f6d77a"]]]].forEach(([s, st]) => { const p = mesh(new T.PlaneGeometry(500, 300), M("#ffffff", { map: texCielo(1024, 600, st, s > 0 ? 200 : 0), roughness: 1 }), s * 406, 135, 0, false); p.rotation.y = (-s * Math.PI) / 2; gS.add(p); });
    reg(gS, 13, 99, "sfondo", "cade");
  }

  /* =========================================================
     STATO, CIELO, ANIMAZIONI, INTERAZIONE
     ========================================================= */
  const ui = { fase: 1, focus: false, sotto: false, esploso: 0, esplosoT: 0, misura: false, miniatura: true };
  try { ui.miniatura = localStorage.getItem("diorama-miniatura") !== "0"; } catch (e) {}
  const ORA = {
    alba:     { el: 7, az: 110, sole: 2.0, sc: "#ffb27a", hemi: 0.25, luci: 0.6, esp: 1.0, notte: 0 },
    giorno:   { el: 48, az: 155, sole: 2.4, sc: "#fff1dc", hemi: 0.3, luci: 0, esp: 0.8, notte: 0 },
    tramonto: { el: 5, az: 250, sole: 1.9, sc: "#ff8c55", hemi: 0.22, luci: 0.7, esp: 1.0, notte: 0 },
    notte:    { el: -14, az: 290, sole: 0, sc: "#9fb6ff", hemi: 0.06, luci: 1, esp: 1.15, notte: 1 },
  };
  let oraCorr = "giorno", centralina = null;
  const oraVal = Object.assign({}, ORA.giorno, { sc: new T.Color(ORA.giorno.sc) }), envUlt = { el: 999, az: 999 };
  const sunDir = (el, az) => new T.Vector3().setFromSphericalCoords(1, T.MathUtils.degToRad(90 - el), T.MathUtils.degToRad(az));
  function aggiornaCielo(forza) {
    const d = sunDir(oraVal.el, oraVal.az), u = sky.material.uniforms;
    u.turbidity.value = 4 + oraVal.notte * 4; u.rayleigh.value = 1.2 + (1 - Math.min(1, Math.max(0, oraVal.el / 30))) * 1.2; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.82; u.sunPosition.value.copy(d);
    sole.position.copy(d).multiplyScalar(1400); sole.intensity = oraVal.sole * Math.max(0, Math.min(1, (oraVal.el + 2) / 8)); sole.color.copy(oraVal.sc);
    luna.intensity = oraVal.notte * 0.5; hemi.intensity = oraVal.hemi; renderer.toneMappingExposure = oraVal.esp;
    stelleCielo.material.opacity = oraVal.notte;
    scene.fog.color.setRGB(0.78, 0.84, 0.9).lerp(oraVal.sc, 0.35).multiplyScalar(1 - oraVal.notte * 0.88);
    NUVOLE.forEach((n) => { n.material.opacity = 0.75 * (1 - oraVal.notte * 0.85); n.material.color.setRGB(1, 1, 1).lerp(oraVal.sc, 0.45).multiplyScalar(1 - oraVal.notte * 0.75); });
    if (bloom) bloom.strength = 0.16 + oraVal.luci * 0.85;
    if (forza || Math.abs(envUlt.el - oraVal.el) > 1.5 || Math.abs(envUlt.az - oraVal.az) > 6) {
      envUlt.el = oraVal.el; envUlt.az = oraVal.az;
      const eu = envSky.material.uniforms; ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"].forEach((k) => (eu[k].value = u[k].value)); eu.sunPosition.value.copy(d);
      const vecchio = envRT; envRT = pmrem.fromScene(envScene, 0, 1, 3000); scene.environment = envRT.texture; if (vecchio) vecchio.dispose();
    }
  }
  function aggiornaVisibilita(anima, prima) {
    const f = ui.fase;
    pezzi.forEach((p) => { let vis = f >= p.from && f <= p.until; if (p.cat === "sotto") vis = vis && (f === p.from || ui.sotto); if (p.cat === "carta") vis = f === 1; p.obj.visible = vis; });
    gSotto.visible = f >= 3 && (f === 3 || ui.sotto); alimentatore.visible = f >= 3;
    impostaTerreno(f >= 11 ? "pieno" : f >= 8 ? "dipinto" : f >= 6 ? "gesso" : f >= 5 ? "scavato" : "schiuma", anima);
    if (anima) avviaAnimazioni(f, prima);
    applicaEvidenza();
  }
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
  const ORO = new T.Color("#ffb300");
  function applicaEvidenza() {
    const f = ui.fase, vetro = ui.sotto || f === 3;
    mats.forEach((m) => { const ud = m.userData; if (ud.fase === undefined) return; const vecchio = ui.focus && ud.fase !== f && f < 14; m.transparent = vecchio ? true : ud.tr0; m.opacity = vecchio ? 0.1 : ud.op0; m.depthWrite = vecchio ? false : ud.dw0; m.needsUpdate = true; });
    base.material.forEach((m) => { if (vetro) { m.transparent = true; m.opacity = 0.35; m.depthWrite = false; m.needsUpdate = true; } });
  }

  /* ---------------- camera ---------------- */
  let volo = null, tour = null;
  function vola(pos, tgt, dur = 1300) { volo = { p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos.clone(), t1: tgt.clone(), t0: performance.now(), dur }; }
  const VISTE = {
    davanti: [new T.Vector3(-60, 330, 610), new T.Vector3(0, 10, 50)],
    alto: [new T.Vector3(0, 1080, 2), new T.Vector3(0, 0, 0)],
    lato: [new T.Vector3(-820, 220, 160), new T.Vector3(0, 30, 0)],
    sotto: [new T.Vector3(60, -460, 420), new T.Vector3(0, -30, 0)],
    vicino: [new T.Vector3(-250, 90, 210), new T.Vector3(-170, 30, 60)],
    esploso: [new T.Vector3(-640, 360, 780), new T.Vector3(0, 10, 0)],
  };
  const fattore = () => Math.max(1, 1.55 / camera.aspect);
  function vista(n) { fermaTour(); const v = VISTE[n], f = n === "vicino" || n === "sotto" ? 1 : fattore(); vola(v[1].clone().add(v[0].clone().sub(v[1]).multiplyScalar(f)), v[1]); }
  function volaTappa(n, apri) { const t = TAPPE[n - 1], tg = V(t.x, t.y, HC[n] + 12); vola(tg.clone().add(new T.Vector3(n > 19 ? -80 : 60, 85, 125)), tg, 1400); if (apri && window.apriTappa) setTimeout(() => window.apriTappa(n), 1450); }
  const didascalia = document.createElement("div"); didascalia.className = "didascalia3d"; didascalia.hidden = true; wrap.appendChild(didascalia);
  const mostraDidascalia = (html) => { didascalia.innerHTML = html; didascalia.hidden = !html; };
  function fermaTour() { if (tour) { tour = null; controls.enabled = true; mostraDidascalia(""); document.dispatchEvent(new CustomEvent("diorama3d:tour", { detail: false })); } }
  function tourFiume() { fermaTour(); const pts = CR.filter((_, i) => i % 6 === 0).map((p, i) => V(p[0], p[1], LIV[i * 6] + 22)); tour = { tipo: "fiume", curva: new T.CatmullRomCurve3(pts), t0: performance.now(), dur: 52000 }; controls.enabled = false; document.dispatchEvent(new CustomEvent("diorama3d:tour", { detail: true })); }
  function tourTappe() { fermaTour(); tour = { tipo: "tappe", n: 0, t0: performance.now() - 99999 }; controls.enabled = false; document.dispatchEvent(new CustomEvent("diorama3d:tour", { detail: true })); }

  /* ---------------- interazione ---------------- */
  const ray = new T.Raycaster(), mouse = new T.Vector2();
  let tip, gMisura, puntoA = null;
  function preparaInterazione() {
    gHit = new T.Group(); scene.add(gHit);
    TAPPE.forEach((t) => { const m = new T.Mesh(GB(75, 6, 75), MHIT); m.position.copy(V(t.x, t.y, HC[t.n] + 2)); m.userData.tappa = t.n; gHit.add(m); });
    anello = new T.LineSegments(new T.EdgesGeometry(GB(77, 2, 77)), new T.LineBasicMaterial({ color: "#ffc400" })); anello.visible = false; scene.add(anello);
    tip = document.createElement("div"); tip.className = "tip3d"; tip.hidden = true; wrap.appendChild(tip);
    gMisura = new T.Group(); scene.add(gMisura); const mMis = new T.MeshBasicMaterial({ color: "#e53935", depthTest: false });
    let giu = null, ultimo = 0, fisso = 0;
    const visibile = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    const punta = (ev) => { const r = renderer.domElement.getBoundingClientRect(); mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera); };
    const colpo = (ev) => { punta(ev); return ray.intersectObjects([...gHit.children, ...HITS], false).filter((h) => visibile(h.object)); };
    const suolo = (ev) => { punta(ev); const o = ui.fase >= 4 ? [gTerreno.children[0]] : ui.fase >= 2 ? [base] : []; return ray.intersectObjects(o, false)[0]; };
    const posTip = (e) => { const r = wrap.getBoundingClientRect(); tip.hidden = false; tip.style.left = Math.min(r.width - 230, e.clientX - r.left + 14) + "px"; tip.style.top = e.clientY - r.top + 14 + "px"; };
    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", (e) => { giu = [e.clientX, e.clientY]; if (tour) fermaTour(); });
    cv.addEventListener("pointermove", (e) => {
      const now = performance.now(); if (now - ultimo < 70 || fisso > now || e.buttons) return; ultimo = now;
      const h = colpo(e)[0];
      if (!h || ui.misura) { tip.hidden = !ui.misura; if (ui.misura) { tip.innerHTML = "<b>📏 Tocca due punti sul terreno</b>"; posTip(e); } anello.visible = false; cv.style.cursor = ui.misura ? "crosshair" : ""; return; }
      const n = h.object.userData.tappa || 0, inf = h.object.userData.info;
      tip.innerHTML = inf ? `<b>${inf}</b>${n ? `<small>Tappa ${n} · ${TAPPE[n - 1].nome}</small>` : ""}` : `<b>${n}. ${TAPPE[n - 1].nome}</b><small>${TAPPE[n - 1].sotto} · tocca per la scheda</small>`;
      posTip(e); cv.style.cursor = "pointer";
      if (n) { anello.visible = true; anello.position.copy(V(TAPPE[n - 1].x, TAPPE[n - 1].y, HC[n] + 1 + CAT.scene.position.y * 0)); } else anello.visible = false;
    });
    cv.addEventListener("pointerleave", () => { tip.hidden = true; anello.visible = false; });
    cv.addEventListener("pointerup", (e) => {
      if (!giu || Math.hypot(e.clientX - giu[0], e.clientY - giu[1]) > 6) return;
      if (ui.misura) {
        const hp = suolo(e); if (!hp) return; const p = hp.point.clone();
        const pal = new T.Mesh(GS(3, 12, 8), mMis); pal.position.copy(p); pal.renderOrder = 9; gMisura.add(pal);
        if (!puntoA) { if (gMisura.children.length > 1) { gMisura.clear(); gMisura.add(pal); } puntoA = p; tip.innerHTML = "<b>📏 Ora tocca il secondo punto</b>"; }
        else { const l = new T.Line(new T.BufferGeometry().setFromPoints([puntoA, p]), new T.LineBasicMaterial({ color: "#e53935", depthTest: false })); l.renderOrder = 9; gMisura.add(l); const dp = Math.hypot(p.x - puntoA.x, p.z - puntoA.z) / 10, dh = Math.abs(p.y - puntoA.y) / 10; tip.innerHTML = `<b>📏 ${dp.toFixed(1).replace(".", ",")} cm in pianta</b><small>dislivello ${dh.toFixed(1).replace(".", ",")} cm</small>`; puntoA = null; }
        posTip(e); fisso = performance.now() + 2500; return;
      }
      const h = colpo(e)[0]; if (!h) return;
      const n = h.object.userData.tappa || 0, inf = h.object.userData.info;
      if (inf) { tip.innerHTML = `<b>${inf}</b>${n ? `<button class="tip-btn">Scheda tappa ${n} ›</button>` : ""}`; posTip(e); fisso = performance.now() + 4000; const b = tip.querySelector(".tip-btn"); if (b) b.onclick = () => { tip.hidden = true; volaTappa(n, true); }; }
      else if (n) volaTappa(n, true);
    });
  }

  /* ---------------- dimensioni ---------------- */
  function ridimensiona() {
    const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  }

  /* ---------------- ciclo di disegno ---------------- */
  let tPrec = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!wrap.offsetParent || document.hidden) { tPrec = now; return; }
    const dt = Math.min(0.05, (now - tPrec) / 1000); tPrec = now; const t = now / 1000;
    for (let i = animInCorso.length - 1; i >= 0; i--) {
      const a = animInCorso[i], k = Math.min(1, Math.max(0, (now - a.t0) / a.dur));
      if (a.tipo === "cade") a.p.obj.position.y = a.p.y0 + 260 * (1 - rimbalzo(k));
      if (a.tipo === "cresce") a.p.obj.scale.y = Math.max(0.01, ease(k));
      if (a.tipo === "acqua") aGeo.setDrawRange(0, Math.floor((aIdxLen * k) / 6) * 6);
      if (k >= 1) { if (a.tipo === "acqua") aGeo.setDrawRange(0, Infinity); animInCorso.splice(i, 1); }
    }
    if (animColori) { const k = ease(Math.min(1, (now - animColori.t0) / animColori.dur)); for (let i = 0; i < tCol.length; i++) tCol[i] = lerp(animColori.da[i], animColori.a[i], k); tGeo.attributes.color.needsUpdate = true; if (k >= 1) animColori = null; }
    if (animAltezze) { const k = ease(Math.min(1, (now - animAltezze.t0) / animAltezze.dur)), H = new Float32Array(NX * NY); for (let i = 0; i < H.length; i++) H[i] = lerp(animAltezze.da[i], animAltezze.a[i], k); applicaAltezze(H); if (k >= 1) animAltezze = null; }
    ui.esplosoT += (ui.esploso - ui.esplosoT) * Math.min(1, dt * 4);
    Object.entries(CAT).forEach(([k, g]) => (g.position.y = ESPLOSO[k] * ui.esplosoT));
    TEX.acqua.normal.offset.y -= dt * 0.35; TEX.acqua.normal.offset.x = Math.sin(t * 0.3) * 0.05;
    spruzzi.forEach((s) => { const k = (t * 1.3 + s.userData.ph) % 1; s.position.y = s.userData.y0 + Math.sin(k * Math.PI) * 4; s.scale.setScalar(2 + k * 4); s.material.opacity = 0.7 * (1 - k); });
    zampillo.scale.set(1, 1 + Math.sin(t * 7) * 0.2, 1);
    if (gSotto.visible) gocce.forEach((g) => { g.userData.u = (g.userData.u + dt * 0.06) % 1; g.position.copy(tuboCurva.getPointAt(g.userData.u)); });
    if (erbaMat) erbaMat.userData.tempo.value = t;
    animaFuochi(t, dt);
    STELLE.forEach((s, i) => (s.rotation.y = t * 0.6 + i));
    const O = ORA[oraCorr], k = Math.min(1, dt * 1.6);
    ["el", "az", "sole", "hemi", "luci", "esp", "notte"].forEach((q) => (oraVal[q] = lerp(oraVal[q], O[q], k))); oraVal.sc.lerp(new T.Color(O.sc), k);
    aggiornaCielo(false);
    ALONI.forEach((a) => { const fl = a.userData.fuoco ? 0.85 + Math.random() * 0.3 : 1; a.material.opacity = oraVal.luci * 0.9 * fl; a.scale.setScalar(a.userData.base * (0.7 + oraVal.luci * 0.5) * fl); });
    PUNTI.forEach((p) => (p.intensity = oraVal.luci * 2.2 * (p.userData.fuoco ? 0.75 + Math.random() * 0.5 : 1)));
    const puls = 0.5 + 0.5 * Math.sin(t * 3.2), f = ui.fase;
    mats.forEach((m) => { const ud = m.userData; if (!ud.em0 || ud.fase === undefined) return; if (ud.fase === f && f < 14 && f !== 9 && f !== 11) m.emissive.copy(ud.em0).lerp(ORO, 0.08 + puls * 0.14); else m.emissive.copy(ud.em0); });
    if (volo) { const q = ease(Math.min(1, (now - volo.t0) / volo.dur)); camera.position.lerpVectors(volo.p0, volo.p1, q); controls.target.lerpVectors(volo.t0v, volo.t1, q); if (q >= 1) volo = null; }
    if (tour && tour.tipo === "fiume") {
      const u = Math.min(1, (now - tour.t0) / tour.dur), p = tour.curva.getPointAt(u), q = tour.curva.getPointAt(Math.min(1, u + 0.025));
      camera.position.copy(p).add(new T.Vector3(0, 6, 0)); controls.target.copy(q);
      let best = 1, bd = 1e9; TAPPE.forEach((tt) => { const d = (tt.x - 400 - p.x) ** 2 + (tt.y - 250 - p.z) ** 2; if (d < bd) { bd = d; best = tt.n; } });
      mostraDidascalia(`<b>Lungo il fiume della vita</b><span>vicino a: ${best}. ${TAPPE[best - 1].nome}</span><i style="width:${u * 100}%"></i>`);
      if (u >= 1) fermaTour();
    }
    if (tour && tour.tipo === "tappe" && now - tour.t0 > 3600) { tour.n++; tour.t0 = now; if (tour.n > 23) fermaTour(); else { const tt = TAPPE[tour.n - 1]; volaTappa(tour.n); mostraDidascalia(`<b>${tt.n}. ${tt.nome}</b><span>${tt.sotto} · <em>${tt.rif}</em></span><i style="width:${(tour.n / 23) * 100}%"></i>`); } }
    if (!tour) controls.update(); else camera.lookAt(controls.target);
    if (composer) {
      const dist = camera.position.distanceTo(controls.target), on = ui.miniatura && !tour && dist > 140;
      tiltH.enabled = tiltV.enabled = on;
      const amt = Math.min(3, Math.max(1, dist / 260));
      tiltH.uniforms.h.value = amt / wrap.clientWidth; tiltV.uniforms.v.value = amt / wrap.clientHeight; tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.52;
      finale.uniforms.tempo.value = (t % 10); composer.render(dt);
    } else renderer.render(scene, camera);
  }

  /* ---------------- anteprima nella scheda ---------------- */
  let prev = null;
  function anteprima(n, el) {
    if (!prev) {
      const r = new T.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
      const sc = new T.Scene(); sc.background = new T.Color("#dfe8f2");
      sc.add(new T.HemisphereLight("#cfe2ff", "#6b5a40", 0.3)); const d = new T.DirectionalLight("#fff3dc", 2.4); d.castShadow = true; d.shadow.mapSize.set(2048, 2048); Object.assign(d.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 10, far: 1000 }); d.shadow.camera.updateProjectionMatrix(); d.shadow.bias = -0.0004; sc.add(d, d.target);
      const cam = new T.PerspectiveCamera(36, 1.6, 1, 4000), ct = new T.OrbitControls(cam, r.domElement); ct.enableDamping = true; ct.autoRotate = true; ct.autoRotateSpeed = 1.4;
      prev = { r, sc, cam, ct, d, grp: null, attivo: false };
      const loop = () => { requestAnimationFrame(loop); if (!prev.attivo) return; prev.ct.update(); prev.r.render(prev.sc, prev.cam); }; loop();
    }
    if (prev.grp) prev.sc.remove(prev.grp);
    prev.sc.environment = envRT.texture;
    const grp = new T.Group(), t = TAPPE[n - 1], src = GT[n].clone(true); src.position.set(0, 0, 0); src.traverse((o) => (o.visible = true)); grp.add(src);
    const R0 = 70, i0 = Math.max(0, Math.floor((t.x - R0) / ST)), i1 = Math.min(NX - 1, Math.ceil((t.x + R0) / ST)), j0 = Math.max(0, Math.floor((t.y - R0) / ST)), j1 = Math.min(NY - 1, Math.ceil((t.y + R0) / ST));
    const pos = [], col = [], uv = [], id = [], w = i1 - i0 + 1, D = COLORI.dipinto;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * NX + i; pos.push(i * ST - 400, HCAR[k], j * ST - 250); col.push(D[k * 3], D[k * 3 + 1], D[k * 3 + 2]); uv.push((i * ST) / 70, (j * ST) / 70); }
    for (let j = 0; j < j1 - j0; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i; id.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
    const g = new T.BufferGeometry(); g.setIndex(id); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T.Float32BufferAttribute(col, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const tm = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: TEX.terreno.map, normalMap: TEX.terreno.normal })); tm.receiveShadow = true; grp.add(tm);
    prev.sc.add(grp); prev.grp = grp;
    const c = V(t.x, t.y, HC[n] + 10); prev.d.target.position.copy(c); prev.d.position.copy(c).add(new T.Vector3(-150, 300, 200));
    prev.cam.position.copy(c).add(new T.Vector3(70, 65, 95)); prev.ct.target.copy(c);
    el.innerHTML = ""; el.appendChild(prev.r.domElement);
    const ww = el.clientWidth || 500, hh = el.clientHeight || 240; prev.r.setSize(ww, hh, false); prev.r.domElement.style.width = "100%"; prev.r.domElement.style.height = "100%"; prev.cam.aspect = ww / hh; prev.cam.updateProjectionMatrix();
    prev.attivo = true;
  }

  /* ---------------- interfaccia pubblica ---------------- */
  const API = {
    fase(f) { const prima = ui.fase; ui.fase = f; aggiornaVisibilita(true, prima); },
    opzioni(o) { Object.assign(ui, o); if (o.misura === false && gMisura) { gMisura.clear(); puntoA = null; } aggiornaVisibilita(false); },
    vista, volaTappa, tourFiume, tourTappe, fermaTour,
    esploso(v) { ui.esploso = v ? 1 : 0; },
    ora(n) { if (centralina) { clearInterval(centralina); centralina = null; } oraCorr = n; },
    centralina() { if (centralina) { clearInterval(centralina); centralina = null; return false; } const seq = ["alba", "giorno", "tramonto", "notte"]; let i = seq.indexOf(oraCorr); centralina = setInterval(() => { i = (i + 1) % 4; oraCorr = seq[i]; document.dispatchEvent(new CustomEvent("diorama3d:ora", { detail: oraCorr })); }, 5000); return true; },
    miniatura(v) { ui.miniatura = v; try { localStorage.setItem("diorama-miniatura", v ? "1" : "0"); } catch (e) {} },
    impostaQualita(q) { try { localStorage.setItem("diorama-qualita", q); } catch (e) {} location.reload(); },
    anteprima, fermaAnteprima() { if (prev) prev.attivo = false; },
    miniaturaAttiva: () => ui.miniatura,
  };
  setTimeout(() => costruisci().catch((e) => { console.error(e); stato("Errore nel 3D: " + e.message); }), 50);
})();
