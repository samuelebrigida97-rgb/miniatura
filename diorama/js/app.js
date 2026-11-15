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

  /* ---------------- scheda della fase ---------------- */
  const lista = (arr) => arr && arr.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="vuoto">—</p>`;
  function mostraFase() {
    const f = FASI[fase - 1];
    $("#fase-card").innerHTML = `
      <div class="fase-num">Fase ${f.n} <small>di ${FASI.length}</small></div>
      <h2>${esc(f.titolo)}</h2>
      <p class="breve">${esc(f.breve)}</p>
      ${f.attenzione ? `<div class="attenzione">⚠️ ${esc(f.attenzione)}</div>` : ""}
      <div class="blocchi">
        <section class="blocco"><h3>🧱 Materiali</h3>${lista(f.materiali)}</section>
        <section class="blocco"><h3>🛠️ Attrezzi</h3>${lista(f.attrezzi)}</section>
      </div>
      <section class="blocco passi"><h3>👣 Passo per passo</h3><ol>${f.passi.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>
      <div class="blocchi">
        <section class="blocco"><h3>📏 Misure</h3>${lista(f.misure)}</section>
        <section class="blocco consigli"><h3>💡 Consigli</h3>${lista(f.consigli)}</section>
      </div>`;
    $("#contatore").textContent = `Fase ${fase} di ${FASI.length}`;
    $("#novita").innerHTML = `<b>Novità:</b> ${esc(NOVITA[fase])}`;
    $("#prev").disabled = fase === 1;
    $("#next").disabled = fase === FASI.length;
    $$("#pallini button").forEach((b, i) => { b.classList.toggle("fatto", i + 1 < fase); b.classList.toggle("ora", i + 1 === fase); b.setAttribute("aria-current", i + 1 === fase ? "step" : "false"); });
    salva("fase", fase);
    if (window.Scena3D) window.Scena3D.fase(fase);
    history.replaceState(null, "", "#fase-" + fase);
    aggiornaTabellone();
  }
  const vai = (n) => { fase = Math.min(FASI.length, Math.max(1, n)); mostraFase(); };

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
        <p class="pos">Posizione sul tabellone: ${t.x / 10} cm da sinistra, ${t.y / 10} cm dall'alto.</p>
        <div class="scheda-nav">
          <button class="btn" data-go="${n - 1}" ${n === 1 ? "disabled" : ""}>◀ Tappa ${n - 1 || ""}</button>
          <button class="btn" data-go="${n + 1}" ${n === 23 ? "disabled" : ""}>Tappa ${n < 23 ? n + 1 : ""} ▶</button>
        </div>
      </div>`;
    $(".chiudi", $("#scheda")).addEventListener("click", () => $("#scheda").close());
    $$("[data-go]", $("#scheda")).forEach((b) => b.addEventListener("click", () => apriTappa(+b.dataset.go)));
    if (window.Scena3D) {
      const box = document.createElement("div"); box.className = "ante3d";
      box.innerHTML = `<div class="ante3d-c" id="ante3d"></div><p>Anteprima 3D della tappa: trascinala per girarla.</p><button class="btn primario" id="vai3d">Vai a questa tappa nel diorama 3D</button>`;
      $(".scheda-corpo", $("#scheda")).insertBefore(box, $(".scheda-corpo h3", $("#scheda")));
      $("#vai3d").addEventListener("click", () => { $("#scheda").close(); $('[data-view="manuale"]').click(); window.impostaModo && window.impostaModo("3d"); if (fase < 10) vai(10); setTimeout(() => window.Scena3D.volaTappa(n), 150); });
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

  /* ---------------- schede (tab) ---------------- */
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => {
    $$(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $$(".view").forEach((v) => v.classList.toggle("attiva", v.id === "v-" + b.dataset.view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  mostraFase();
})();
