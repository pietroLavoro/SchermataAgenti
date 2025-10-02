// === app.js (patch con navegación de agentes) ===
// Compatible con la versión "minimal sin CSS" y SIN sección Dettaglio.
// Sólo reemplaza tu app.js por este archivo.

// ===== Helper DOM =====
const byId = (id) => document.getElementById(id);

// ===== Formattazione numerica IT =====
function toCents(euros) {
  return Math.round(Number(euros) * 100);
}
function formatEuroIT(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function parseNumberInput(el) {
  if (typeof el.valueAsNumber === "number" && !Number.isNaN(el.valueAsNumber)) return el.valueAsNumber;
  return parseFloat((el.value || '').replace(',', '.')) || 0;
}

// ===== Algoritmo di ripartizione (metodo dei maggiori resti) =====
function largestRemainder(total, weights) {
  const raw = weights.map(w => w * total);
  const base = raw.map(x => Math.floor(x));
  let leftover = total - base.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => ({ i, r: x - Math.floor(x) }))
                   .sort((a, b) => (b.r === a.r ? a.i - b.i : b.r - a.r));
  const result = base.slice();
  for (let k = 0; k < leftover; k++) result[order[k].i] += 1;
  return result;
}

function allocate(agents, totalQty, totalAmountEuro) {
  if (totalQty < 0 || totalAmountEuro < 0) throw new Error("I totali non possono essere negativi");
  if (agents.length === 0) return [];

  if (agents.some(a => a.saldo < 0)) throw new Error("Saldi negativi non consentiti");
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
    importo: centsAlloc[i] / 100
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

// Referencias de navegación (se crearán dinámicamente si faltan)
let prevBtn = null;
let nextBtn = null;
let navInfo = null;

function createNavUI() {
  // Si ya existe, sólo toma referencias y sale
  const existingPrev = byId("prevBtn");
  const existingNext = byId("nextBtn");
  const existingInfo = byId("navInfo");
  if (existingPrev && existingNext && existingInfo) {
    prevBtn = existingPrev; nextBtn = existingNext; navInfo = existingInfo;
    attachNavListeners();
    return;
  }

  // Construcción mínima
  const h3 = document.createElement("h3");
  h3.textContent = "Navigazione agenti";

  const wrap = document.createElement("div");
  const prev = document.createElement("button");
  prev.id = "prevBtn";
  prev.textContent = "← Precedente";

  const info = document.createElement("span");
  info.id = "navInfo";
  info.style.margin = "0 8px";

  const next = document.createElement("button");
  next.id = "nextBtn";
  next.textContent = "Successivo →";

  wrap.appendChild(prev);
  wrap.appendChild(info);
  wrap.appendChild(next);

  // Insertar después de la tabla de resultados y antes de <details> si existe
  const resultTable = byId("resultTable");
  const details = document.querySelector("details");
  if (resultTable && resultTable.parentNode) {
    if (details && details.parentNode === resultTable.parentNode) {
      resultTable.parentNode.insertBefore(h3, details);
      resultTable.parentNode.insertBefore(wrap, details);
    } else {
      resultTable.parentNode.insertBefore(h3, resultTable.nextSibling);
      resultTable.parentNode.insertBefore(wrap, h3.nextSibling);
    }
  } else {
    document.body.appendChild(h3);
    document.body.appendChild(wrap);
  }

  prevBtn = byId("prevBtn");
  nextBtn = byId("nextBtn");
  navInfo = byId("navInfo");

  attachNavListeners();
  selectAgent(0);
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
  prevBtn.disabled = (count === 0 || currentIndex === 0);
  nextBtn.disabled = (count === 0 || currentIndex >= count - 1);
}

function selectAgent(idx) {
  if (!prevBtn || !nextBtn || !navInfo) createNavUI();

  const data = readAgents();
  if (data.length === 0) {
    currentIndex = 0;
    navInfo.textContent = "Nessun agente.";
    updateNavButtons(0);
    return;
  }
  currentIndex = Math.max(0, Math.min(idx, data.length - 1));
  const a = data[currentIndex];
  navInfo.textContent = `Agente ${currentIndex + 1}/${data.length}: ${(a.nome || "Agente")} ${(a.cognome || "")} | Saldo: ${formatEuroIT(a.saldo)}`;
  updateNavButtons(data.length);

  const row = agentsTbody.querySelectorAll('tr')[currentIndex];
  if (row) {
    row.scrollIntoView({ block: 'nearest' });
    const first = row.querySelector('input');
    if (first) first.focus();
  }
}

function renderAgentRow(idx, agent) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${idx + 1}</td>
    <td><input type="text" class="in-nome" value="${agent.nome || ''}" placeholder="Nome"></td>
    <td><input type="text" class="in-cognome" value="${agent.cognome || ''}" placeholder="Cognome"></td>
    <td><input type="number" min="0" step="0.01" class="in-saldo" value="${agent.saldo ?? 0}"></td>
    <td>
      <button data-act="del">Elimina</button>
    </td>
  `;

  tr.querySelector('[data-act="del"]').addEventListener('click', () => {
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
    nome: tr.querySelector('.in-nome').value.trim(),
    cognome: tr.querySelector('.in-cognome').value.trim(),
    saldo: parseNumberInput(tr.querySelector('.in-saldo')) || 0
  }));
}

// ===== Risultato =====
const resultTbody = byId("resultTbody");
const sumQtyEl = byId("sumQty");
const sumAmountEl = byId("sumAmount");

function renderResultTable(result) {
  resultTbody.innerHTML = "";
  let sQty = 0, sAmount = 0;
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
  sampleAgents().forEach(a => addAgentRow(a));
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

  const neg = agents.find(a => a.saldo < 0);
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
    selectAgent(0);
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
    { nome: "Sara", cognome: "Neri", saldo: 50 }
  ];
}

// Init seguro
function init() {
  createNavUI();
  if (agentsTbody && agentsTbody.children.length === 0) {
    sampleAgents().forEach(a => addAgentRow(a));
  }
  selectAgent(0);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
