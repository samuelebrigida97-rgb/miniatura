/* Collega i pulsanti della barra 3D alla scena e gestisce il passaggio 3D / 2D */
(function () {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const card = $(".board-card");
  const pressa = (sel, el) => $$(sel).forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
  let modo = "3d"; try { modo = localStorage.getItem("diorama-modo") || "3d"; } catch (e) {}
  function impostaModo(m) {
    if (!window.Scena3D) m = "2d";
    modo = m; card.classList.toggle("modo2d", m === "2d"); card.classList.toggle("modo3d", m === "3d");
    $("#m3d").setAttribute("aria-pressed", String(m === "3d")); $("#m2d").setAttribute("aria-pressed", String(m === "2d"));
    try { localStorage.setItem("diorama-modo", m); } catch (e) {}
    if (m === "2d" && window.Scena3D) window.Scena3D.fermaTour();
  }
  window.impostaModo = impostaModo;
  $("#m3d").addEventListener("click", () => impostaModo("3d"));
  $("#m2d").addEventListener("click", () => impostaModo("2d"));
  if (!window.Scena3D) {
    $("#m3d").disabled = true; $("#m3d").title = "Il 3D non è disponibile su questo dispositivo";
    impostaModo("2d"); return;
  }
  const S = window.Scena3D;
  $("#carica3d").remove();
  $$("[data-vista]").forEach((b) => b.addEventListener("click", () => S.vista(b.dataset.vista)));
  $("#t-fiume").addEventListener("click", () => S.tourFiume());
  $("#t-tappe").addEventListener("click", () => S.tourTappe());
  $("#t-stop").addEventListener("click", () => S.fermaTour());
  document.addEventListener("diorama3d:tour", (e) => { $("#t-stop").hidden = !e.detail; });
  $$("[data-ora]").forEach((b) => b.addEventListener("click", () => { S.ora(b.dataset.ora); pressa("[data-ora]", b); $("#b-centralina").setAttribute("aria-pressed", "false"); }));
  document.addEventListener("diorama3d:ora", (e) => pressa("[data-ora]", $(`[data-ora="${e.detail}"]`)));
  $("#b-centralina").addEventListener("click", (e) => e.currentTarget.setAttribute("aria-pressed", String(S.centralina())));
  $("#b-esploso").addEventListener("click", (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", String(on)); S.esploso(on); if (on) S.vista("esploso"); });
  $("#b-misura").addEventListener("click", (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", String(on)); S.opzioni({ misura: on }); });
  $("#b-full").addEventListener("click", () => {
    const el = card;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => card.classList.toggle("pseudo-full"));
    else card.classList.toggle("pseudo-full");
  });
  impostaModo(modo);
  const f = +((location.hash.match(/fase-(\d+)/) || [])[1] || 0);
  S.fase(f || +(document.querySelector("#contatore").textContent.match(/\d+/) || [1])[0]);
  S.opzioni({ focus: $("#opt-focus").checked, sotto: $("#opt-sotto").checked });
})();
