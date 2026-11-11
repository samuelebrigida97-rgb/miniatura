// Il "cervello visibile" di Jarvis: una rete di neuroni 3D che ruota dentro un HUD.
// Gli stati cambiano velocità, luminosità e quantità di impulsi che viaggiano tra i neuroni.

const STATES = {
  off:       { rot: 0.03, spawn: 0,  bright: 0.15, cascade: 0,    scale: 0.8,  jitter: 0, speed: 1.2 },
  sleep:     { rot: 0.07, spawn: 1.5, bright: 0.45, cascade: 0.15, scale: 1,    jitter: 0, speed: 1.4 },
  listening: { rot: 0.16, spawn: 6,  bright: 0.85, cascade: 0.3,  scale: 1.05, jitter: 0, speed: 1.8 },
  thinking:  { rot: 0.6,  spawn: 40, bright: 1,    cascade: 0.7,  scale: 0.88, jitter: 1, speed: 3.2 },
  speaking:  { rot: 0.2,  spawn: 10, bright: 0.9,  cascade: 0.35, scale: 1,    jitter: 0, speed: 2.2 },
};

const NODE_COUNT = 150;
const LINKS_PER_NODE = 3;
const MAX_PULSES = 420;

function makeGlow(r, g, b) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export class NeuralCore {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'off';
    this.p = { ...STATES.off };
    this.level = 0;
    this.levelTarget = 0;
    this.levelTimer = 0;
    this.time = 0;
    this.rotY = 0;
    this.rotX = 0;
    this.spawnAcc = 0;
    this.pulses = [];
    this.glowCyan = makeGlow(70, 200, 255);
    this.glowGold = makeGlow(255, 200, 110);
    this.build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  build() {
    this.nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      // punti in una sfera, un po' più densi verso il centro
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6);
      const s = Math.sqrt(1 - u * u);
      this.nodes.push({
        x: r * s * Math.cos(phi),
        y: r * u,
        z: r * s * Math.sin(phi),
        act: 0,
        links: [],
        seed: Math.random() * 1000,
        sx: 0, sy: 0, sz: 0, ss: 1,
      });
    }
    const edgeSet = new Set();
    this.edges = [];
    this.nodes.forEach((n, i) => {
      const near = this.nodes
        .map((m, j) => ({ j, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 + (m.z - n.z) ** 2 }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, LINKS_PER_NODE);
      near.forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (edgeSet.has(key)) return;
        edgeSet.add(key);
        this.edges.push([i, j]);
        n.links.push(j);
        this.nodes[j].links.push(i);
      });
    });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = this.canvas.clientWidth * dpr;
    this.h = this.canvas.clientHeight * dpr;
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  // In orizzontale il nucleo sale e si rimpicciolisce per lasciare spazio ai sottotitoli.
  layout() {
    const { w, h } = this;
    const landscape = w > h;
    const R = landscape ? h * 0.23 : Math.min(w, h) * 0.27;
    const cy = landscape ? h * 0.43 : h * 0.47;
    return { cx: w / 2, cy, R };
  }

  // Dove finisce l'HUD circolare, in pixel CSS (serve per posizionare la scritta di stato).
  bottomEdge() {
    const { cy, R } = this.layout();
    return (cy + R * 1.72) / this.dpr;
  }

  setState(s) {
    if (STATES[s]) this.state = s;
  }

  burst(n = 30) {
    for (let i = 0; i < n; i++) this.spawn();
  }

  spawn(from, exclude) {
    if (this.pulses.length >= MAX_PULSES) return;
    let a = from;
    if (a == null) a = (Math.random() * this.nodes.length) | 0;
    const links = this.nodes[a].links.filter((l) => l !== exclude);
    if (!links.length) return;
    const b = links[(Math.random() * links.length) | 0];
    this.pulses.push({ a, b, t: 0, gold: this.state === 'thinking' && Math.random() < 0.6 });
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    this.time += dt;
    const target = STATES[this.state];
    const k = 1 - Math.exp(-dt * 3);
    for (const key in target) this.p[key] += (target[key] - this.p[key]) * k;

    // "ampiezza" della voce mentre parla (simulata: Android non espone l'audio della sintesi)
    if (this.state === 'speaking') {
      this.levelTimer -= dt;
      if (this.levelTimer <= 0) {
        this.levelTarget = Math.random() < 0.15 ? 0.1 : 0.35 + Math.random() * 0.65;
        this.levelTimer = 0.07 + Math.random() * 0.1;
      }
    } else {
      this.levelTarget = this.state === 'listening' ? 0.15 + 0.1 * Math.sin(this.time * 2) : 0;
    }
    this.level += (this.levelTarget - this.level) * (1 - Math.exp(-dt * 18));

    this.rotY += this.p.rot * dt;
    this.rotX = Math.sin(this.time * 0.13) * 0.35;

    this.spawnAcc += this.p.spawn * dt * (this.state === 'speaking' ? 0.5 + this.level * 1.5 : 1);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      this.spawn();
    }

    const decay = Math.exp(-dt * 2.4);
    for (const n of this.nodes) n.act *= decay;

    const speed = this.p.speed;
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pl = this.pulses[i];
      pl.t += dt * speed;
      if (pl.t >= 1) {
        const nb = this.nodes[pl.b];
        nb.act = Math.min(1, nb.act + 0.8);
        this.pulses.splice(i, 1);
        if (Math.random() < this.p.cascade) {
          this.spawn(pl.b, pl.a);
          if (this.state === 'thinking' && Math.random() < 0.3) this.spawn(pl.b, pl.a);
        }
      }
    }
  }

  project(R, cx, cy) {
    const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
    const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
    const f = 3;
    const scale = this.p.scale * (1 + this.level * 0.06);
    const jit = this.p.jitter;
    for (const n of this.nodes) {
      let x = n.x, y = n.y, z = n.z;
      if (jit > 0.01) {
        const j = 0.035 * jit;
        x += Math.sin(this.time * 9 + n.seed) * j;
        y += Math.cos(this.time * 11 + n.seed * 1.3) * j;
      }
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const persp = f / (f + z2);
      n.sx = cx + x1 * R * scale * persp;
      n.sy = cy + y1 * R * scale * persp;
      n.sz = z2;
      n.ss = persp;
    }
  }

  drawRings(ctx, cx, cy, R) {
    const t = this.time;
    const b = this.p.bright;
    const thinking = this.state === 'thinking';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    // anello sottile
    ctx.strokeStyle = `rgba(0,200,255,${0.18 + 0.15 * b})`;
    ctx.lineWidth = 1 * this.dpr;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.3, 0, Math.PI * 2);
    ctx.stroke();

    // quattro archi rotanti
    ctx.lineWidth = 3 * this.dpr;
    ctx.strokeStyle = `rgba(60,210,255,${0.25 + 0.4 * b})`;
    for (let i = 0; i < 4; i++) {
      const a0 = t * 0.35 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.37, a0, a0 + 0.9);
      ctx.stroke();
    }

    // tacche
    ctx.rotate(-t * 0.05);
    ctx.lineWidth = 1 * this.dpr;
    for (let i = 0; i < 90; i++) {
      const long = i % 6 === 0;
      const a = (i / 90) * Math.PI * 2;
      const r0 = R * 1.47;
      const r1 = r0 + (long ? 12 : 5) * this.dpr;
      ctx.strokeStyle = `rgba(0,190,255,${(long ? 0.5 : 0.22) * (0.4 + b * 0.6)})`;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.rotate(t * 0.05);

    // archi esterni controrotanti
    ctx.lineWidth = 2 * this.dpr;
    ctx.strokeStyle = `rgba(0,200,255,${0.2 + 0.3 * b})`;
    for (let i = 0; i < 2; i++) {
      const a0 = -t * 0.2 + i * Math.PI;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.62, a0, a0 + 1.1);
      ctx.stroke();
    }

    // spinner "sto pensando"
    if (thinking || this.p.jitter > 0.05) {
      const a0 = t * 4;
      ctx.lineWidth = 2.5 * this.dpr;
      ctx.strokeStyle = `rgba(255,205,120,${0.8 * this.p.jitter})`;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.22, a0, a0 + 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.22, a0 + Math.PI, a0 + Math.PI + 0.6);
      ctx.stroke();
    }

    // anello che vibra con la voce
    if (this.level > 0.02) {
      ctx.lineWidth = 2 * this.dpr;
      ctx.strokeStyle = `rgba(120,230,255,${0.6 * this.level})`;
      ctx.beginPath();
      ctx.arc(0, 0, R * (1.15 + this.level * 0.06), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  draw() {
    const { ctx, w, h } = this;
    const { cx, cy, R } = this.layout();
    const b = this.p.bright;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#01060b';
    ctx.fillRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.4);
    bg.addColorStop(0, `rgba(0,140,220,${0.12 * b})`);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.drawRings(ctx, cx, cy, R);
    this.project(R, cx, cy);

    ctx.globalCompositeOperation = 'lighter';

    // sinapsi
    ctx.lineWidth = 1 * this.dpr;
    for (const [i, j] of this.edges) {
      const a = this.nodes[i], c = this.nodes[j];
      const depth = ((a.ss + c.ss) / 2 - 0.75) * 2; // ~0..1
      const act = Math.max(a.act, c.act);
      const alpha = (0.04 + 0.16 * b) * Math.max(0.2, depth) + act * 0.45;
      ctx.strokeStyle = `rgba(80,200,255,${Math.min(alpha, 0.9)})`;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(c.sx, c.sy);
      ctx.stroke();
    }

    // neuroni
    for (const n of this.nodes) {
      const size = (1 + 1.6 * n.ss) * this.dpr;
      const alpha = 0.25 + 0.6 * b * Math.max(0.3, (n.ss - 0.75) * 2);
      ctx.fillStyle = `rgba(150,225,255,${alpha})`;
      ctx.fillRect(n.sx - size / 2, n.sy - size / 2, size, size);
      if (n.act > 0.08) {
        const g = 26 * this.dpr * n.act * n.ss;
        ctx.globalAlpha = Math.min(1, n.act);
        ctx.drawImage(this.glowCyan, n.sx - g / 2, n.sy - g / 2, g, g);
        ctx.globalAlpha = 1;
      }
    }

    // impulsi
    for (const pl of this.pulses) {
      const a = this.nodes[pl.a], c = this.nodes[pl.b];
      const x = a.sx + (c.sx - a.sx) * pl.t;
      const y = a.sy + (c.sy - a.sy) * pl.t;
      const s = (pl.gold ? 14 : 11) * this.dpr * (a.ss + (c.ss - a.ss) * pl.t);
      ctx.drawImage(pl.gold ? this.glowGold : this.glowCyan, x - s / 2, y - s / 2, s, s);
    }

    // nucleo
    const core = R * (0.32 + this.level * 0.12 + (this.state === 'thinking' ? 0.05 * Math.sin(this.time * 12) : 0));
    ctx.globalAlpha = 0.25 + 0.45 * b;
    ctx.drawImage(this.state === 'thinking' ? this.glowGold : this.glowCyan, cx - core, cy - core, core * 2, core * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    this.center = { x: cx / this.dpr, y: cy / this.dpr, r: (R * 1.4) / this.dpr };
  }
}
