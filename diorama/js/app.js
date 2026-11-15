/* =========================================================
   LOGICA DELL'APP: pulsanti, fasi, schede, lista materiali
   ========================================================= */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const salva = (k, v) => { try { localStorage.setItem("diorama-" + k, JSON.stringify(v)); } catch (e) {} };
  const leggi = (k, d) => { try { const v = localStorage.getItem("diorama-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Cosa compare di nuovo in ogni fase (testo sotto il tabellone)
  const NOVITA = {
    1: "Disegno su carta: griglia 10 cm, caselle, sentiero, fiume (blu), monti e ponticelli (rosso).",
    2: "Base in multistrato con i listelli sotto (tratteggio). Il disegno è riportato a matita.",
    3: "Sotto la base: vaschetta con pompa, tubo che torna alla sorgente, fori per i cavi. Alimentatore fuori.",
    4: "Schiuma su tutto il tabellone; montagne scolpite (gli anelli indicano l'altezza).",
    5: "Letto del fiume e sentiero scavati. Cerchi rossi = salti con canaletta.",
    6: "Gesso e segatura su tutto; letto del fiume impermeabilizzato (nero = gomma liquida).",
    7: "Prova dell'acqua: il fiume scorre dall'Eden alla Nuova Gerusalemme.",
    8: "Terreno dipinto in 4 zone di colore, sentiero sabbia, fondo del fiume e resina.",
    9: "Luci a 12 V: bianco caldo, fuochi tremolanti, striscia LED. Cavi sotto la base.",
    10: "Scene principali stampate in 3D, la Nuova Gerusalemme e i 5 ponticelli.",
    11: "Riempimento: persone, greggi, cammelli, tende, palme, fiori ovunque.",
    12: "Targhette con numero, nome e riferimento accanto a ogni tappa.",
    13: "Sfondo dipinto: alba a sinistra, notte stellata al centro, luce dorata a destra.",
    14: "Il diorama è finito! Prova la modalità Notte.",
  };

  let fase = Math.min(14, Math.max(1, leggi("fase", 1)));
  const m = location.hash.match(/fase-(\d+)/); if (m) fase = Math.min(14, Math.max(1, +m[1]));

  /* ---------------- tabellone ---------------- */
  $("#board-wrap").innerHTML = costruisciTabellone();
  const svg = $("#tabellone");
  const layers = $$(".layer", svg);

  function aggiornaTabellone() {
    const sotto = $("#opt-sotto").checked, notte = $("#opt-notte").checked;
    layers.forEach((ly) => {
      const from = +ly.dataset.from, until = +ly.dataset.until;
      let vis = fase >= from && fase <= until;
      if (ly.dataset.sotto) vis = (fase === from) || (sotto && fase >= from);
      if (ly.dataset.notte) vis = notte && fase >= 9;
      ly.style.display = vis ? "" : "none";
      ly.classList.toggle("is-new", fase === from && fase < 14 && !ly.dataset.notte);
    });
    svg.classList.toggle("focus", $("#opt-focus").checked);
    svg.classList.toggle("notte", notte && fase >= 9);
    $("#ly-numeri").style.display = $("#opt-num").checked ? "" : "none";
    $("#board-wrap").classList.toggle("tilt", $("#opt-tilt").checked);
    $("#opt-notte").closest("label").classList.toggle("off", fase < 9);
    $("#opt-sotto").closest("label").classList.toggle("off", fase < 3);
  }

  /* ---------------- MANUALE DI MONTAGGIO DA SCORRERE ---------------- */
  // Inquadratura 3D di ogni passo (si ripetono in ciclo se i passi sono di più)
  const INQ = {
    1: ["alto", "z:300,250,420", "z:200,150,300", "z:420,260,330", "z:520,330,320", "z:450,300,380", "z:200,150,260"],
    2: ["lato", "lato", "sotto", "sotto", "davanti", "alto"],
    3: ["sotto", "sotto", "sotto", "t:23", "lato", "sotto"],
    4: ["davanti", "z:195,150,240", "vicino", "lato", "z:400,160,260", "davanti"],
    5: ["z:300,250,320", "t:5", "t:10", "z:520,320,280", "davanti"],
    6: ["davanti", "t:4", "z:300,250,260", "vicino", "t:15"],
    7: ["t:2", "z:330,260,360", "t:23", "davanti"],
    8: ["davanti", "t:6", "t:15", "t:21", "vicino"],
    9: ["t:9", "t:16", "sotto", "davanti"],
    10: ["t:4", "t:10", "t:15", "t:23", "davanti"],
    11: ["t:7", "t:11", "t:19", "vicino", "davanti"],
    12: ["t:3", "t:12", "t:20", "davanti"],
    13: ["lato", "davanti", "alto"],
    14: ["davanti", "t:23", "t:4", "t:10", "alto"],
  };
  const inq = (f, i) => INQ[f][i % INQ[f].length];
  const lista = (arr) => arr && arr.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="vuoto">—</p>`;
  let fatti = leggi("passi", {});
  const totPassi = FASI.reduce((s, f) => s + f.passi.length, 0);

  $("#manuale-lista").innerHTML = `
    <div class="mont-intro">
      <h2>Manuale di montaggio</h2>
      <p>Scorri verso il basso: ogni passo ha la sua <b>foto 3D</b>. Mentre scorri, il diorama in alto si costruisce da solo e la telecamera va dove stai lavorando. <b>Tocca una foto</b> per girarla nel 3D, <b>trascina la linea</b> nelle foto "prima/dopo" e spunta <b>Fatto</b> quando hai finito un passo.</p>
      <div class="avanz grande"><span id="avanz-tot"></span></div><small id="avanz-tot-t"></small>
    </div>` +
    FASI.map((f) => `
    <section class="fase-sez" id="fase-sez-${f.n}" data-f="${f.n}">
      <header class="fase-testa">
        <div class="fase-num">Fase ${f.n} <small>di ${FASI.length}</small></div>
        <h2>${esc(f.titolo)}</h2>
        <p class="breve">${esc(f.breve)}</p>
        <div class="avanz"><span data-avf="${f.n}"></span></div><small data-avt="${f.n}"></small>
      </header>
      ${f.n > 1 ? `<div class="primadopo" data-f="${f.n}" style="--x:50%">
        <div class="pd-img dopo foto-slot" data-f="${f.n}" data-spec="${inq(f.n, 0)}"></div>
        <div class="pd-img prima foto-slot" data-f="${f.n - 1}" data-spec="${inq(f.n, 0)}"></div>
        <div class="pd-linea" aria-hidden="true"><i>⟷</i></div>
        <span class="pd-et sx">Prima</span><span class="pd-et dx">Dopo la fase ${f.n}</span>
        <input type="range" min="0" max="100" value="50" aria-label="Confronta prima e dopo la fase ${f.n}">
      </div>` : ""}
      <p class="novita-fase">✨ <b>Cosa cambia:</b> ${esc(NOVITA[f.n])} <span class="evid">I pezzi nuovi brillano in oro.</span></p>
      ${f.attenzione ? `<div class="attenzione">⚠️ ${esc(f.attenzione)}</div>` : ""}
      <details class="kit"${f.n === 1 ? " open" : ""}>
        <summary>🧰 Cosa ti serve <small>${f.materiali.length} materiali · ${f.attrezzi.length} attrezzi</small></summary>
        <div class="blocchi">
          <section class="blocco"><h3>🧱 Materiali</h3>${lista(f.materiali)}</section>
          <section class="blocco"><h3>🛠️ Attrezzi</h3>${lista(f.attrezzi)}</section>
        </div>
      </details>
      <ol class="passi-lista">
        ${f.passi.map((p, i) => { const id = `${f.n}-${i}`; return `
        <li class="passo${fatti[id] ? " fatto" : ""}" data-f="${f.n}" data-i="${i}" data-spec="${inq(f.n, i)}">
          <figure class="foto" tabindex="0" role="button" aria-label="Guarda il passo ${i + 1} nel 3D">
            <div class="foto-slot" data-f="${f.n}" data-spec="${inq(f.n, i)}"></div>
            <figcaption>👆 Tocca per vederlo nel 3D</figcaption>
          </figure>
          <div class="passo-testo">
            <span class="passo-n">${i + 1}</span>
            <p>${esc(p)}</p>
            <label class="fatto-btn"><input type="checkbox" data-passo="${id}" ${fatti[id] ? "checked" : ""}><span>Fatto</span></label>
          </div>
        </li>`; }).join("")}
      </ol>
      <div class="blocchi">
        <section class="blocco"><h3>📏 Misure</h3>${lista(f.misure)}</section>
        <section class="blocco consigli"><h3>💡 Consigli</h3>${lista(f.consigli)}</section>
      </div>
      ${f.n < FASI.length ? `<button class="btn primario prossima" data-vai="${f.n + 1}">Avanti: fase ${f.n + 1} · ${esc(FASI[f.n].titolo)} ▼</button>` : `<p class="fine">🎉 Il diorama è finito! Prova la luce <b>Notte</b> negli strumenti della vista.</p>`}
    </section>`).join("");

  function aggiornaAvanzamento() {
    let tot = 0;
    FASI.forEach((f) => { const n = f.passi.filter((_, i) => fatti[`${f.n}-${i}`]).length; tot += n; $(`[data-avf="${f.n}"]`).style.width = (n / f.passi.length) * 100 + "%"; $(`[data-avt="${f.n}"]`).textContent = `${n} di ${f.passi.length} passi fatti`; });
    $("#avanz-tot").style.width = (tot / totPassi) * 100 + "%"; $("#avanz-tot-t").textContent = `Avanzamento del montaggio: ${tot} di ${totPassi} passi (${Math.round((tot / totPassi) * 100)}%)`;
    $$("#pallini button").forEach((b, i) => b.classList.toggle("completa", FASI[i].passi.every((_, k) => fatti[`${i + 1}-${k}`])));
  }
  $("#manuale-lista").addEventListener("change", (e) => {
    const id = e.target.dataset.passo; if (!id) return;
    fatti[id] = e.target.checked; salva("passi", fatti); e.target.closest(".passo").classList.toggle("fatto", e.target.checked); aggiornaAvanzamento();
  });

  // prima / dopo
  $$(".primadopo").forEach((pd) => {
    const r = $("input", pd), set = (v) => pd.style.setProperty("--x", v + "%");
    r.addEventListener("input", () => set(r.value));
    const daPunto = (e) => { const b = pd.getBoundingClientRect(); const v = Math.min(100, Math.max(0, ((e.clientX - b.left) / b.width) * 100)); r.value = v; set(v); };
    pd.addEventListener("pointerdown", (e) => { if (e.target === r) return; daPunto(e); pd.setPointerCapture(e.pointerId); pd.onpointermove = daPunto; });
    pd.addEventListener("pointerup", () => (pd.onpointermove = null));
  });

  // foto 3D: generate quando si avvicinano allo schermo, una alla volta
  const cacheFoto = {}, coda = []; let lavoro = null, nessun3d = false;
  let noFoto = false; try { noFoto = localStorage.getItem("diorama-nofoto") === "1"; } catch (e) {}
  const pronto3d = () => window.Scena3D && window.Scena3D.pronta && !noFoto, senza3d = () => !window.Scena3D || nessun3d;
  setTimeout(() => { if (!pronto3d()) { nessun3d = true; if (!lavoro) lavoro = setTimeout(lavora, 30); } }, 60000);
  function svgFase(f) {
    const c = svg.cloneNode(true); $$(".hit", c).forEach((h) => h.setAttribute("fill", "none"));
    $$(".layer", c).forEach((ly) => { const from = +ly.dataset.from, until = +ly.dataset.until; let vis = f >= from && f <= until; if (ly.dataset.sotto) vis = f === from; if (ly.dataset.notte) vis = false; ly.style.display = vis ? "" : "none"; });
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
  }
  function riempi(slot, url, pianta) { slot.innerHTML = `<img alt="" src="${url}" class="${pianta ? "pianta" : ""}" loading="lazy">`; slot.classList.add("pronta"); }
  function lavora() {
    lavoro = null; if (!coda.length || (!pronto3d() && !senza3d())) return;
    coda.sort((a, b) => a.dist - b.dist);
    const slot = coda.shift().slot, f = +slot.dataset.f, spec = slot.dataset.spec, k = f + "|" + spec;
    if (!cacheFoto[k]) {
      if (pronto3d() && !nessun3d) { const u = window.Scena3D.foto(f, spec, 720, 460); if (u) cacheFoto[k] = u; else { riempi(slot, svgFase(f), true); delete slot.dataset.inCoda; lavoro = setTimeout(lavora, 60); return; } }
      else cacheFoto[k] = "svg:" + svgFase(f);
    }
    const u = cacheFoto[k]; riempi(slot, u.startsWith("svg:") ? u.slice(4) : u, u.startsWith("svg:"));
    lavoro = setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(lavora, { timeout: 1500 }) : lavora()), 180);
  }
  const vistaFoto = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting || e.target.classList.contains("pronta") || e.target.dataset.inCoda) return;
    e.target.dataset.inCoda = "1"; coda.push({ slot: e.target, get dist() { return Math.abs(e.target.getBoundingClientRect().top - innerHeight / 2); } });
    if (!lavoro) lavoro = setTimeout(lavora, 30);
  }), { rootMargin: "700px 0px" });
  function osservaFoto() { $$(".foto-slot").forEach((s) => vistaFoto.observe(s)); }
  document.addEventListener("diorama3d:pronta", () => { nessun3d = false; if (!lavoro) lavoro = setTimeout(lavora, 300); });

  // passo attivo: quello al centro dello schermo guida il 3D
  let passoAttivo = null, timerVolo = null;
  function attiva(el, vola = true) {
    if (passoAttivo === el) return;
    if (passoAttivo) passoAttivo.classList.remove("attivo");
    passoAttivo = el; el.classList.add("attivo");
    const f = +el.dataset.f;
    if (f !== fase) { fase = f; mostraFase(); }
    const i = el.dataset.i !== undefined ? +el.dataset.i : -1;
    $("#etich3d").innerHTML = `<b>Fase ${f}${i >= 0 ? ` · passo ${i + 1}` : ""}</b> ${esc(FASI[f - 1].titolo)}`;
    if (vola && window.Scena3D && window.Scena3D.pronta) { clearTimeout(timerVolo); timerVolo = setTimeout(() => window.Scena3D.inquadra(el.dataset.spec || inq(f, 0)), 250); }
  }
  const scrollSpia = new IntersectionObserver((ents) => {
    const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (vis.length) attiva(vis[0].target);
  }, { rootMargin: "-58% 0px -38% 0px" });
  $$(".passo, .fase-testa").forEach((el) => { if (el.classList.contains("fase-testa")) { el.dataset.f = el.parentNode.dataset.f; el.dataset.spec = inq(+el.dataset.f, 0); } scrollSpia.observe(el); });
  $$(".passo .foto").forEach((fg) => {
    const vai3d = () => { const p = fg.closest(".passo"); passoAttivo = null; attiva(p); if (window.Scena3D && window.Scena3D.pronta) window.Scena3D.inquadra(p.dataset.spec); if (innerWidth < 961) window.scrollBy({ top: p.getBoundingClientRect().top - innerHeight * 0.5, behavior: "smooth" }); fg.classList.add("tocca"); setTimeout(() => fg.classList.remove("tocca"), 600); };
    fg.addEventListener("click", vai3d); fg.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); vai3d(); } });
  });
  $$(".prossima").forEach((b) => b.addEventListener("click", () => scorriA(+b.dataset.vai)));
  function scorriA(n) {
    n = Math.min(FASI.length, Math.max(1, n));
    const el = $("#fase-sez-" + n), stick = innerWidth < 961 ? $(".col-board").getBoundingClientRect().height : 0;
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - stick - 70, behavior: "smooth" });
  }

  function mostraFase() {
    $("#contatore").textContent = `Fase ${fase} di ${FASI.length}`;
    $("#novita").innerHTML = `<b>Novità:</b> ${esc(NOVITA[fase])}`;
    $("#prev").disabled = fase === 1;
    $("#next").disabled = fase === FASI.length;
    $$("#pallini button").forEach((b, i) => { b.classList.toggle("fatto", i + 1 < fase); b.classList.toggle("ora", i + 1 === fase); b.setAttribute("aria-current", i + 1 === fase ? "step" : "false"); });
    const pc = $("#pallini .ora"); if (pc && pc.scrollIntoView && innerWidth < 961) { const box = $("#pallini"); box.scrollTo({ left: pc.offsetLeft - box.clientWidth / 2, behavior: "smooth" }); }
    salva("fase", fase);
    window.faseCorrente = fase;
    if (window.Scena3D) window.Scena3D.fase(fase);
    history.replaceState(null, "", "#fase-" + fase);
    aggiornaTabellone();
  }
  const vai = (n) => scorriA(n);

  $("#pallini").innerHTML = FASI.map((f) => `<button title="${esc(f.n + ". " + f.titolo)}" aria-label="Fase ${f.n}: ${esc(f.titolo)}">${f.n}</button>`).join("");
  $$("#pallini button").forEach((b, i) => b.addEventListener("click", () => vai(i + 1)));
  $("#prev").addEventListener("click", () => vai(fase - 1));
  $("#next").addEventListener("click", () => vai(fase + 1));
  ["#opt-focus", "#opt-sotto", "#opt-notte", "#opt-tilt", "#opt-num"].forEach((s) => $(s).addEventListener("change", () => {
    aggiornaTabellone();
    if (window.Scena3D) window.Scena3D.opzioni({ focus: $("#opt-focus").checked, sotto: $("#opt-sotto").checked });
  }));
  document.addEventListener("keydown", (e) => {
    if ($("#scheda").open || !$("#v-manuale").classList.contains("attiva")) return;
    if (e.key === "ArrowRight") vai(fase + 1);
    if (e.key === "ArrowLeft") vai(fase - 1);
  });
  document.addEventListener("diorama3d:pronta", () => { if (passoAttivo) window.Scena3D.inquadra(passoAttivo.dataset.spec, 1600); });

  /* ---------------- scheda della tappa ---------------- */
  function apriTappa(n) {
    const t = TAPPE[n - 1], z = ZONE[t.zona];
    $("#scheda-in").innerHTML = `
      <div class="scheda-testa" style="--z:${z.colore}">
        <span class="badge">${t.n}</span>
        <div><h2 id="scheda-titolo">${esc(t.nome)}</h2><p>${esc(t.sotto)} · <i>${esc(t.rif)}</i></p></div>
        <button class="chiudi" aria-label="Chiudi">✕</button>
      </div>
      <div class="scheda-corpo">
        <p class="zona-tag" style="--z:${z.colore}">Zona: ${esc(z.nome)} (${esc(z.tinta)})</p>
        <h3>📖 La storia</h3><p>${esc(t.storia)}</p>
        <h3>🏗️ Cosa costruire</h3><ul>${t.costruisci.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <h3>🖨️ Figure da stampare in 3D</h3>
        <table class="tab"><tr><th>Figura</th><th>Misura</th><th>Q.tà</th></tr>
          ${t.figure.map((f) => `<tr><td>${esc(f.nome)}</td><td>${esc(f.misura)}</td><td>${f.qta}</td></tr>`).join("")}</table>
        ${t.luce ? `<p class="luce">💡 Luce: <b>${esc(t.luce)}</b> (12 V)</p>` : ""}
        ${(typeof STORIE !== "undefined" ? STORIE.filter((st) => st.tappa === n) : []).map((st, i) => `${i ? "" : "<h3>📚 Storie in più qua vicino</h3>"}<div class="storia-box"><b>${esc(st.nome)}</b> <i>${esc(st.rif)}</i><p>${esc(st.storia)}</p><button class="btn" data-lista-da-scheda="s:${st.id}">📋 Lista per ${esc(st.nome)}</button> <button class="btn" data-guarda-da-scheda="${st.id}">🎥 Guarda nel 3D</button></div>`).join("")}
        <button class="btn primario lista-tappa" data-lista-da-scheda="t${n}">📋 Lista per questa tappa</button>
        <p class="pos">Posizione sul tabellone: ${t.x / 10} cm da sinistra, ${t.y / 10} cm dall'alto.</p>
        <div class="scheda-nav">
          <button class="btn" data-go="${n - 1}" ${n === 1 ? "disabled" : ""}>◀ Tappa ${n - 1 || ""}</button>
          <button class="btn" data-go="${n + 1}" ${n === 23 ? "disabled" : ""}>Tappa ${n < 23 ? n + 1 : ""} ▶</button>
        </div>
      </div>`;
    $(".chiudi", $("#scheda")).addEventListener("click", () => $("#scheda").close());
    $$("[data-go]", $("#scheda")).forEach((b) => b.addEventListener("click", () => apriTappa(+b.dataset.go)));
    $$("[data-guarda-da-scheda]", $("#scheda")).forEach((b) => b.addEventListener("click", () => { $("#scheda").close(); window.guardaStoria(b.dataset.guardaDaScheda); }));
    $$("[data-lista-da-scheda]", $("#scheda")).forEach((b) => b.addEventListener("click", () => { $("#scheda").close(); window.apriLista(b.dataset.listaDaScheda); }));
    if (window.Scena3D) {
      const box = document.createElement("div"); box.className = "ante3d";
      box.innerHTML = `<div class="ante3d-c" id="ante3d"></div><p>Anteprima 3D della tappa: trascinala per girarla.</p><button class="btn primario" id="vai3d">Vai a questa tappa nel diorama 3D</button>`;
      $(".scheda-corpo", $("#scheda")).insertBefore(box, $(".scheda-corpo h3", $("#scheda")));
      $("#vai3d").addEventListener("click", () => { $("#scheda").close(); $('[data-view="manuale"]').click(); window.impostaModo && window.impostaModo("3d"); if (fase < 10) { fase = 14; mostraFase(); } setTimeout(() => window.Scena3D.volaTappa(n), 150); });
    }
    if (!$("#scheda").open) $("#scheda").showModal();
    if (window.Scena3D) requestAnimationFrame(() => window.Scena3D.anteprima(n, $("#ante3d")));
  }
  window.apriTappa = apriTappa;
  $("#scheda").addEventListener("close", () => window.Scena3D && window.Scena3D.fermaAnteprima());
  $("#scheda").addEventListener("click", (e) => { if (e.target.id === "scheda") $("#scheda").close(); });
  $$(".hit", svg).forEach((h) => {
    h.addEventListener("click", () => apriTappa(+h.dataset.n));
    h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apriTappa(+h.dataset.n); } });
  });

  /* ---------------- vista tappe ---------------- */
  $("#legenda").innerHTML = Object.values(ZONE).map((z) => `<span><i style="background:${z.colore}"></i>${esc(z.nome)}</span>`).join("");
  $("#griglia-tappe").innerHTML = TAPPE.map((t) => `
    <button class="tappa-card" data-n="${t.n}" style="--z:${ZONE[t.zona].colore}">
      <span class="badge">${t.n}</span>
      <span class="tc-testo"><b>${esc(t.nome)}</b><small>${esc(t.sotto)}</small><em>${esc(t.rif)}</em></span>
    </button>`).join("");
  $$(".tappa-card").forEach((c) => c.addEventListener("click", () => apriTappa(+c.dataset.n)));

  /* ---------------- lista materiali ---------------- */
  let spunte = leggi("spunte", {});
  $("#lista-materiali").innerHTML = MATERIALI.map((gr, gi) => `
    <section class="gruppo"><h3>${esc(gr.gruppo)} <small data-conta="${gi}"></small></h3>
      ${gr.voci.map(([nome, qta], vi) => { const id = `m-${gi}-${vi}`; return `
        <label class="voce"><input type="checkbox" data-id="${id}" data-g="${gi}" ${spunte[id] ? "checked" : ""}>
          <span class="v-nome">${esc(nome)}</span><span class="v-qta">${esc(qta)}</span></label>`; }).join("")}
    </section>`).join("");
  function aggiornaProgresso() {
    const tutte = $$("#lista-materiali input"), ok = tutte.filter((i) => i.checked).length;
    const p = Math.round((ok / tutte.length) * 100);
    $("#barra").style.width = p + "%"; $("#perc").textContent = `${p}% (${ok}/${tutte.length})`;
    MATERIALI.forEach((_, gi) => { const g = tutte.filter((i) => i.dataset.g == gi); $(`[data-conta="${gi}"]`).textContent = `${g.filter((i) => i.checked).length}/${g.length}`; });
  }
  $("#lista-materiali").addEventListener("change", (e) => {
    if (!e.target.dataset.id) return;
    spunte[e.target.dataset.id] = e.target.checked; salva("spunte", spunte); aggiornaProgresso();
  });
  let azzeraTimer;
  $("#azzera").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (!btn.dataset.conferma) { // primo clic: chiede conferma sul pulsante stesso
      btn.dataset.conferma = "1"; btn.textContent = "Sicuro? Tocca di nuovo";
      clearTimeout(azzeraTimer); azzeraTimer = setTimeout(() => { delete btn.dataset.conferma; btn.textContent = "Azzera le spunte"; }, 3000);
      return;
    }
    delete btn.dataset.conferma; btn.textContent = "Azzera le spunte";
    spunte = {}; salva("spunte", spunte); $$("#lista-materiali input").forEach((i) => (i.checked = false)); aggiornaProgresso();
  });
  if (window.self !== window.top) $("#stampa").hidden = true; // dentro un riquadro la stampa non è disponibile
  $("#stampa").addEventListener("click", () => window.print());
  aggiornaProgresso();

  /* ---------------- LISTE: tutto, per fase, per tappa, per storia ---------------- */
  const STOR = typeof STORIE !== "undefined" ? STORIE : [];
  let spunteL = leggi("liste", {});
  const pulsanti = [
    { gr: "📦 Tutto", voci: [{ k: "tutto", t: "Lista completa del diorama" }, { k: "storie", t: "Lista di tutte le storie in più" }, { k: "figure", t: "Tutte le figure da stampare in 3D" }] },
    { gr: "🧩 Per fase di montaggio", voci: FASI.map((f) => ({ k: "f" + f.n, t: `Lista fase ${f.n} · ${f.titolo}` })) },
    { gr: "📍 Per tappa del percorso", voci: TAPPE.map((t) => ({ k: "t" + t.n, t: `Lista tappa ${t.n} · ${t.nome}` })) },
    { gr: "📚 Per storia in più", voci: STOR.map((st) => ({ k: "s:" + st.id, t: `Lista per ${st.nome}` })) },
  ];
  $("#scelta-liste").innerHTML = pulsanti.map((g) => `<details class="gruppo-liste"${g.gr.startsWith("📦") ? " open" : ""}><summary>${g.gr} <small>${g.voci.length}</small></summary><div class="chips">${g.voci.map((v) => `<button class="chip" data-lista="${esc(v.k)}">${esc(v.t)}</button>`).join("")}</div></details>`).join("");
  const voce = (k, testo, extra = "") => `<label class="voce"><input type="checkbox" data-lk="${esc(k)}" ${spunteL[k] ? "checked" : ""}><span class="v-nome">${testo}</span><span class="v-qta">${extra}</span></label>`;
  const tabFig = (pref, figs) => figs.map((f, i) => voce(`${pref}-fig-${i}`, `🖨️ ${esc(f.nome)} <small>${esc(f.misura)}</small>`, "× " + f.qta)).join("");
  function bloccoStoria(st, conTitolo) {
    return `<section class="gruppo">${conTitolo ? `<h3>📚 ${esc(st.nome)} <small>${esc(st.rif)} · vicino alla tappa ${st.tappa}</small></h3>` : ""}
      <p class="storia-txt">${esc(st.storia)}</p>
      <h4>Figure da stampare in 3D</h4>${tabFig("s-" + st.id, st.figure)}
      <h4>Materiali</h4>${st.materiali.map(([n, q], i) => voce(`s-${st.id}-mat-${i}`, esc(n), esc(q))).join("")}
      <h4>Come si fa</h4>${st.costruisci.map((c, i) => voce(`s-${st.id}-pas-${i}`, `<b>${i + 1}.</b> ${esc(c)}`)).join("")}
    </section>`;
  }
  function mostraLista(k) {
    $$("#scelta-liste .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lista === k)));
    const box = $("#lista-scelta");
    if (k === "tutto") { box.hidden = true; $("#lista-completa").hidden = false; return; }
    $("#lista-completa").hidden = true; box.hidden = false;
    let titolo = "", corpo = "", vai = "";
    if (k === "storie") { titolo = "📚 Tutte le storie in più"; corpo = STOR.map((st) => bloccoStoria(st, true)).join(""); }
    else if (k === "figure") { titolo = "🖨️ Tutte le figure da stampare in 3D"; corpo = TAPPE.map((t) => `<section class="gruppo"><h3>Tappa ${t.n} · ${esc(t.nome)}</h3>${tabFig("t" + t.n, t.figure)}${STOR.filter((st) => st.tappa === t.n).map((st) => `<h4>📚 ${esc(st.nome)}</h4>${tabFig("s-" + st.id, st.figure)}`).join("")}</section>`).join(""); }
    else if (k[0] === "f") { const f = FASI[+k.slice(1) - 1]; titolo = `🧩 Fase ${f.n} · ${esc(f.titolo)}`; vai = `<button class="btn" data-vai-fase="${f.n}">Apri la fase ${f.n} nel manuale</button>`;
      corpo = `<section class="gruppo"><h3>🧱 Materiali</h3>${f.materiali.map((m, i) => voce(`f${f.n}-m-${i}`, esc(m))).join("")}</section><section class="gruppo"><h3>🛠️ Attrezzi</h3>${f.attrezzi.map((m, i) => voce(`f${f.n}-a-${i}`, esc(m))).join("")}</section><section class="gruppo"><h3>📏 Misure da tenere a mente</h3><ul>${f.misure.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></section>`; }
    else if (k[0] === "t") { const t = TAPPE[+k.slice(1) - 1], ss = STOR.filter((st) => st.tappa === t.n); titolo = `📍 Tappa ${t.n} · ${esc(t.nome)}`; vai = `<button class="btn" data-apri-tappa="${t.n}">Apri la scheda della tappa</button>`;
      corpo = `<section class="gruppo"><h3>🖨️ Figure da stampare in 3D</h3>${tabFig("t" + t.n, t.figure)}</section><section class="gruppo"><h3>🏗️ Da costruire</h3>${t.costruisci.map((c, i) => voce(`t${t.n}-c-${i}`, esc(c))).join("")}</section>${t.luce ? `<section class="gruppo"><h3>💡 Luce</h3>${voce(`t${t.n}-luce`, esc(t.luce) + " (12 V)", "1")}</section>` : ""}<section class="gruppo"><h3>🎨 Per finire</h3>${voce(`t${t.n}-col`, "Colori acrilici della zona " + esc(ZONE[t.zona].nome) + " (" + esc(ZONE[t.zona].tinta) + ")")}${voce(`t${t.n}-col2`, "Colla cianoacrilica per fissare le figure")}${voce(`t${t.n}-col3`, "Erba statica, sassolini e cespugli")}</section>${ss.map((st) => bloccoStoria(st, true)).join("")}`; }
    else if (k.startsWith("s:")) { const st = STOR.find((q) => q.id === k.slice(2)); titolo = `📚 ${esc(st.nome)} <small>${esc(st.rif)}</small>`; vai = `<button class="btn primario" data-guarda-storia="${st.id}">🎥 Guarda nel 3D</button><button class="btn" data-apri-tappa="${st.tappa}">Vicino alla tappa ${st.tappa}: apri la scheda</button>`; corpo = bloccoStoria(st, false); }
    box.innerHTML = `<div class="lista-testa"><h3>${titolo}</h3><div class="azioni">${vai}<button class="btn" data-lista-chiudi>✕ Torna alla lista completa</button></div><div class="progresso"><div class="barra"><span id="barra-l"></span></div><b id="perc-l"></b></div></div>${corpo}`;
    aggiornaL();
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function aggiornaL() { const tutte = $$("#lista-scelta input[data-lk]"); if (!tutte.length) return; const ok = tutte.filter((i) => i.checked).length; $("#barra-l").style.width = (ok / tutte.length) * 100 + "%"; $("#perc-l").textContent = `${ok}/${tutte.length}`; }
  $("#scelta-liste").addEventListener("click", (e) => { const b = e.target.closest("[data-lista]"); if (b) mostraLista(b.dataset.lista); });
  $("#lista-scelta").addEventListener("change", (e) => { const k = e.target.dataset.lk; if (!k) return; spunteL[k] = e.target.checked; salva("liste", spunteL); $$(`#lista-scelta input[data-lk="${k}"]`).forEach((i) => (i.checked = e.target.checked)); aggiornaL(); });
  $("#lista-scelta").addEventListener("click", (e) => {
    if (e.target.closest("[data-lista-chiudi]")) mostraLista("tutto");
    const t = e.target.closest("[data-apri-tappa]"); if (t) apriTappa(+t.dataset.apriTappa);
    const gs = e.target.closest("[data-guarda-storia]"); if (gs) guardaStoria(gs.dataset.guardaStoria);
    const f = e.target.closest("[data-vai-fase]"); if (f) { $('[data-view="manuale"]').click(); setTimeout(() => vai(+f.dataset.vaiFase), 350); }
  });
  function guardaStoria(id) { $('[data-view="manuale"]').click(); if (window.impostaModo) window.impostaModo("3d"); setTimeout(() => { vai(14); setTimeout(() => window.Scena3D && window.Scena3D.pronta && window.Scena3D.volaStoria(id), 900); }, 400); }
  window.guardaStoria = guardaStoria;
  window.apriLista = (k) => { $('[data-view="materiali"]').click(); setTimeout(() => mostraLista(k), 50); };

  /* ---------------- schede (tab) ---------------- */
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => {
    $$(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $$(".view").forEach((v) => v.classList.toggle("attiva", v.id === "v-" + b.dataset.view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  mostraFase();
  aggiornaAvanzamento();
  osservaFoto();
  if (fase > 1) setTimeout(() => { const el = $("#fase-sez-" + fase); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - (innerWidth < 961 ? $(".col-board").getBoundingClientRect().height : 0) - 70 }); }, 60);
  $("#etich3d").innerHTML = `<b>Fase ${fase}</b> ${esc(FASI[fase - 1].titolo)}`;
})();
