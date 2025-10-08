//
// ===== I18N (IT/ES) =====
const I18N = {
  it: {
    title: "Ripartizione proporzionale tra agenti",
    intro_html:
      "Distribuisci la <strong>quantità</strong> (unità) e l'<strong>importo</strong> (€) in base al <em>saldo</em> di ciascun agente.",
    section_totals: "1) Totali",
    totals_qty: "Quantità totale (unità)",
    totals_amount: "Importo totale (€)",
    section_agents: "2) Agenti",
    add_agent: "+ Aggiungi agente",
    reset_sample: "Ripristina esempio",
    th_hash: "#",
    th_nome: "Nome",
    th_cognome: "Cognome",
    th_saldo: "Saldo",
    th_action: "Azione",
    section_result: "3) Risultato",
    calc: "Calcola",
    clear_results: "Pulisci risultati",
    th_qty: "Quantità",
    th_amount: "Importo (€)",
    total_label: "Totale:",
    alert_neg_saldi: "Saldi negativi non consentiti.",
    alert_tot_neg: "I totali non possono essere negativi.",
    alert_add_agent: "Aggiungi almeno un agente.",
    internal_sum_error: "Le somme non tornano (errore interno).",
  },
  es: {
    title: "Reparto proporcional entre agentes",
    intro_html:
      "Distribuye la <strong>cantidad</strong> (unidades) y el <strong>importe</strong> (€) según el <em>saldo</em> de cada agente.",
    section_totals: "1) Totales",
    totals_qty: "Cantidad total (unidades)",
    totals_amount: "Importe total (€)",
    section_agents: "2) Agentes",
    add_agent: "+ Añadir agente",
    reset_sample: "Restablecer ejemplo",
    th_hash: "#",
    th_nome: "Nombre",
    th_cognome: "Apellido",
    th_saldo: "Saldo",
    th_action: "Acción",
    section_result: "3) Resultado",
    calc: "Calcular",
    clear_results: "Limpiar resultados",
    th_qty: "Cantidad",
    th_amount: "Importe (€)",
    total_label: "Total:",
    alert_neg_saldi: "Saldos negativos no permitidos.",
    alert_tot_neg: "Los totales no pueden ser negativos.",
    alert_add_agent: "Añade al menos un agente.",
    internal_sum_error: "Las sumas no coinciden (error interno).",
  },
};
const LANG_KEY = "ui_lang";
function getLang() {
  const s = localStorage.getItem(LANG_KEY);
  return s === "it" || s === "es" ? s : "it";
}
function tr(key) {
  const l = getLang();
  return (I18N[l] && I18N[l][key]) || key;
}
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    if (key.endsWith("_html")) el.innerHTML = tr(key);
    else el.textContent = tr(key);
  });
  // fuerza elementos críticos por id
  const intro = document.getElementById("introText");
  if (intro) intro.innerHTML = tr("intro_html");
  const calc = document.getElementById("calcBtn");
  if (calc) calc.textContent = tr("calc");
  const clr = document.getElementById("clearResultBtn");
  if (clr) clr.textContent = tr("clear_results");
}
function setLang(l) {
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.setAttribute("lang", l);
  const btn = document.getElementById("langBtn");
  if (btn) btn.textContent = l === "it" ? "ES" : "IT";
  applyI18n();
}

// === app.js (patch con navegación de agentes en TABLA) ===
// Compatible con tu versión “beta”: SOLO modifica la sección 4 de navegación.

// ===== Helper DOM =====
const byId = (id) => document.getElementById(id);

// ===== Formattazione numerica IT =====
function toCents(euros) {
  return Math.round(Number(euros) * 100);
}
function formatEuroIT(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}
function parseNumberInput(el) {
  if (typeof el.valueAsNumber === "number" && !Number.isNaN(el.valueAsNumber))
    return el.valueAsNumber;
  return parseFloat((el.value || "").replace(",", ".")) || 0;
}

// ===== Algoritmo di ripartizione (metodo dei maggiori resti) =====
function largestRemainder(total, weights) {
  const raw = weights.map((w) => w * total);
  const base = raw.map((x) => Math.floor(x));
  let leftover = total - base.reduce((s, x) => s + x, 0);
  const order = raw
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => (b.r === a.r ? a.i - b.i : b.r - a.r));
  const result = base.slice();
  for (let k = 0; k < leftover; k++) result[order[k].i] += 1;
  return result;
}

function allocate(agents, totalQty, totalAmountEuro) {
  if (totalQty < 0 || totalAmountEuro < 0)
    throw new Error("I totali non possono essere negativi");
  if (agents.length === 0) return [];

  if (agents.some((a) => a.saldo < 0))
    throw new Error("Saldi negativi non consentiti");
  const totalCents = toCents(totalAmountEuro);
  const sumSaldo = agents.reduce((s, a) => s + a.saldo, 0);

  const n = agents.length;
  const proportion = (a) => (sumSaldo > 0 ? a.saldo / sumSaldo : 1 / n);
  const weights = agents.map(proportion);

  const qtyAlloc = largestRemainder(totalQty, weights);
  const centsAlloc = largestRemainder(totalCents, weights);

  const out = agents.map((a, i) => ({
    ...a,
    quantita: qtyAlloc[i],
    importo: centsAlloc[i] / 100,
  }));

  const sumQty = out.reduce((s, x) => s + x.quantita, 0);
  const sumCents = out.reduce((s, x) => s + Math.round(x.importo * 100), 0);
  if (sumQty !== totalQty || sumCents !== toCents(totalAmountEuro)) {
    throw new Error("Le somme non tornano (errore interno).");
  }
  return out;
}

// ===== UI: tabella agenti =====
const agentsTbody = byId("agentsTbody");
let allocations = [];
let currentIndex = 0;

// ======== SECCIÓN 4) NAVEGAZIONE AGENTI — TABLA + BOTONES DEBAJO =========
let prevBtn = null;
let nextBtn = null;
// navInfo se mantiene por compatibilidad, no se usa visualmente
let navInfo = null;

// refs de la tabla de navegación
let navTable = null;
let navNomeEl = null;
let navQtyEl = null;
let navImpEl = null;

function createNavUI() {
  // Si ya existe, sólo tomar referencias
  const existingPrev = byId("prevBtn");
  const existingNext = byId("nextBtn");
  const existingTable = byId("navTable");
  if (existingPrev && existingNext && existingTable) {
    prevBtn = existingPrev;
    nextBtn = existingNext;
    navTable = existingTable;
    navNomeEl = byId("navNome");
    navQtyEl = byId("navQty");
    navImpEl = byId("navImp");
    attachNavListeners();
    updateNavView();
    return;
  }

  // Título "4) Navegazione Agenti"
  const h3 = document.createElement("h3");
  h3.textContent = "4) Navigazione Agenti";
  h3.style.fontSize = "1.50rem";

  // Tabla: Agente | Azioni (Quantità) | Importo (€)
  // === Tabla: Agente | Azioni (Quantità) | Importo (€) con ancho fijo ===
  const table = document.createElement("table");
  table.id = "navTable";
  table.innerHTML = `
  <colgroup>
    <col />   <!-- Agente -->
    <col />   <!-- Azioni (Quantità) -->
    <col />   <!-- Importo (€) -->
  </colgroup>
  <thead>
    <tr>
      <th>Agente</th>
      <th>Azioni (Quantità)</th>
      <th>Importo (€)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td id="navNome">—</td>
      <td id="navQty">0</td>
      <td id="navImp">0,00</td>
    </tr>
  </tbody>
`;

  // === Estilos mínimos inyectados por JS (sin tocar tu CSS global) ===
  const style = document.createElement("style");
  style.textContent = `
  /* ancho fijo para toda la tabla */
  #navTable {
    width: 100%;            /* <- cambia este valor si quieres otro ancho */
    table-layout: fixed;
    border-collapse: collapse;
  }
  /* anchos fijos por columna (usando el colgroup de arriba) */
  #navTable col:nth-child(1) { width: 240px; } /* Agente */
  #navTable col:nth-child(2) { width: 140px; } /* Cantidad */
  #navTable col:nth-child(3) { width: 140px; } /* Importe */

  /* padding y alineación básica */
  #navTable th, #navTable td {
    padding: 6px 8px;
  }
  #navTable th:nth-child(2), #navTable td:nth-child(2),
  #navTable th:nth-child(3), #navTable td:nth-child(3) {
    text-align: right;
  }

  /* evitar que la primera columna expanda la tabla por nombres largos */
  #navTable td:first-child, #navTable th:first-child {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
  document.head.appendChild(style);

  // Controles debajo
  const controls = document.createElement("div");
  controls.style.marginTop = "8px";
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.justifyContent = "center";

  const prev = document.createElement("button");
  prev.id = "prevBtn";
  prev.textContent = "← Precedente";

  const next = document.createElement("button");
  next.id = "nextBtn";
  next.textContent = "Successivo →";

  controls.appendChild(prev);
  controls.appendChild(next);

  // Insertar después de la tabla de resultados y antes de <details> (si existe)
  const resultTable = byId("resultTable");
  const details = document.querySelector("details");

  const host =
    resultTable && resultTable.parentNode
      ? resultTable.parentNode
      : document.body;
  if (resultTable && details && details.parentNode === host) {
    host.insertBefore(h3, details);
    host.insertBefore(table, details);
    host.insertBefore(controls, details);
  } else if (resultTable) {
    host.insertBefore(h3, resultTable.nextSibling);
    host.insertBefore(table, h3.nextSibling);
    host.insertBefore(controls, table.nextSibling);
  } else {
    host.appendChild(h3);
    host.appendChild(table);
    host.appendChild(controls);
  }

  // Referencias
  prevBtn = byId("prevBtn");
  nextBtn = byId("nextBtn");
  navTable = byId("navTable");
  navNomeEl = byId("navNome");
  navQtyEl = byId("navQty");
  navImpEl = byId("navImp");

  attachNavListeners();
  updateNavView();
}

function attachNavListeners() {
  if (prevBtn && !prevBtn._listenerAdded) {
    prevBtn.addEventListener("click", () => selectAgent(currentIndex - 1));
    prevBtn._listenerAdded = true;
  }
  if (nextBtn && !nextBtn._listenerAdded) {
    nextBtn.addEventListener("click", () => selectAgent(currentIndex + 1));
    nextBtn._listenerAdded = true;
  }
}

function updateNavButtons(count) {
  if (!prevBtn || !nextBtn) return;
  prevBtn.disabled = count === 0 || currentIndex === 0;
  nextBtn.disabled = count === 0 || currentIndex >= count - 1;
}

// Actualiza la tabla de la sección 4 con el agente actual
function updateNavView() {
  if (!navTable) return;
  const agents = readAgents();
  const hasAgents = agents.length > 0;
  const a = hasAgents ? agents[currentIndex] : null;

  // Nombre completo
  const fullName = a
    ? [a.nome || "", a.cognome || ""].filter(Boolean).join(" ")
    : "—";
  if (navNomeEl) navNomeEl.textContent = fullName || "—";

  // Si existen allocations (ya calculaste), toma Quantità e Importo; si no, 0
  const q =
    allocations[currentIndex] &&
    Number.isFinite(allocations[currentIndex].quantita)
      ? allocations[currentIndex].quantita
      : 0;
  const imp =
    allocations[currentIndex] &&
    Number.isFinite(allocations[currentIndex].importo)
      ? allocations[currentIndex].importo
      : 0;

  if (navQtyEl) navQtyEl.textContent = String(q);
  if (navImpEl) navImpEl.textContent = formatEuroIT(imp);

  updateNavButtons(agents.length);
}

// Selección integrada con la tabla de la sección 4
function selectAgent(idx) {
  if (!prevBtn || !nextBtn || !navTable) createNavUI();

  const data = readAgents();
  if (data.length === 0) {
    currentIndex = 0;
    if (navNomeEl) navNomeEl.textContent = "—";
    if (navQtyEl) navQtyEl.textContent = "0";
    if (navImpEl) navImpEl.textContent = "0,00";
    updateNavButtons(0);
    return;
  }

  currentIndex = Math.max(0, Math.min(idx, data.length - 1));

  // ➜ Sin scroll ni focus a la tabla de agentes
  updateNavView();
}

// ====================== FIN SECCIÓN 4 =======================

// ===== Resto de la UI de agentes (igual que tenías) =====
function renderAgentRow(idx, agent) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${idx + 1}</td>
    <td><input type="text" class="in-nome" value="${
      agent.nome || ""
    }" placeholder="Nome"></td>
    <td><input type="text" class="in-cognome" value="${
      agent.cognome || ""
    }" placeholder="Cognome"></td>
    <td><input type="number" min="0" step="0.01" class="in-saldo" value="${
      agent.saldo ?? 0
    }"></td>
    <td>
      <button data-act="del">Elimina</button>
    </td>
  `;

  tr.querySelector('[data-act="del"]').addEventListener("click", () => {
    tr.remove();
    renumberRows();
    selectAgent(Math.min(currentIndex, agentsTbody.children.length - 1));
  });

  agentsTbody.appendChild(tr);
}

function renumberRows() {
  [...agentsTbody.querySelectorAll("tr")].forEach((tr, i) => {
    tr.firstElementChild.textContent = String(i + 1);
  });
}

function addAgentRow(agent = { nome: "", cognome: "", saldo: 0 }) {
  renderAgentRow(agentsTbody.children.length, agent);
}

function readAgents() {
  const rows = [...agentsTbody.querySelectorAll("tr")];
  return rows.map((tr) => ({
    nome: tr.querySelector(".in-nome").value.trim(),
    cognome: tr.querySelector(".in-cognome").value.trim(),
    saldo: parseNumberInput(tr.querySelector(".in-saldo")) || 0,
  }));
}

// ===== Risultato =====
const resultTbody = byId("resultTbody");
const sumQtyEl = byId("sumQty");
const sumAmountEl = byId("sumAmount");

function renderResultTable(result) {
  resultTbody.innerHTML = "";
  let sQty = 0,
    sAmount = 0;
  result.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.nome || "-"}</td>
      <td>${r.cognome || "-"}</td>
      <td>${formatEuroIT(r.saldo)}</td>
      <td>${r.quantita}</td>
      <td>${formatEuroIT(r.importo)}</td>
    `;
    resultTbody.appendChild(tr);
    sQty += r.quantita;
    sAmount += r.importo;
  });
  sumQtyEl.textContent = String(sQty);
  sumAmountEl.textContent = formatEuroIT(sAmount);
}

// ===== Eventi =====
byId("addAgentBtn").addEventListener("click", () => {
  addAgentRow();
  selectAgent(agentsTbody.children.length - 1);
});
byId("resetSampleBtn").addEventListener("click", () => {
  agentsTbody.innerHTML = "";
  sampleAgents().forEach((a) => addAgentRow(a));
  allocations = [];
  renderResultTable([]);
  selectAgent(0);
});
byId("clearResultBtn").addEventListener("click", () => {
  allocations = [];
  renderResultTable([]);
  selectAgent(currentIndex);
});

byId("calcBtn").addEventListener("click", () => {
  const totalQty = Math.round(parseNumberInput(byId("totalQty")));
  const totalAmount = parseNumberInput(byId("totalAmount"));
  const agents = readAgents();

  const neg = agents.find((a) => a.saldo < 0);
  if (neg) {
    alert("Saldi negativi non consentiti.");
    return;
  }
  if (totalQty < 0 || totalAmount < 0) {
    alert("I totali non possono essere negativi.");
    return;
  }
  if (agents.length === 0) {
    alert("Aggiungi almeno un agente.");
    return;
  }

  try {
    allocations = allocate(agents, totalQty, Number(totalAmount));
    renderResultTable(allocations);
    selectAgent(0); // refresca la tabla de navegación con las asignaciones
  } catch (e) {
    console.error(e);
    alert(e.message || "Errore nel calcolo della ripartizione.");
  }
});

// ===== Dati di esempio =====
function sampleAgents() {
  return [
    { nome: "Luca", cognome: "Bianchi", saldo: 500 },
    { nome: "Giulia", cognome: "Rossi", saldo: 300 },
    { nome: "Marco", cognome: "Verdi", saldo: 150 },
    { nome: "Sara", cognome: "Neri", saldo: 50 },
  ];
}

// Init seguro
function init() {
  setLang(getLang());
  const langBtn = document.getElementById("langBtn");
  if (langBtn)
    langBtn.addEventListener("click", () =>
      setLang(getLang() === "it" ? "es" : "it")
    );
  createNavUI();
  if (agentsTbody && agentsTbody.children.length === 0) {
    sampleAgents().forEach((a) => addAgentRow(a));
  }
  selectAgent(0);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
