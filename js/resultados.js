/* =========================
   CONFIG
========================= */
const LOGO_BASE = "assets/logos/";

// Rutas CSV (exactas, según tu carpeta /data)
const CSV = {
  FED_DF_PARTIDO: "data/FEDERAL_DF_POR_PARTIDO.csv",
  FED_DF_CAND: "data/FEDERAL_DF_POR_CANDIDATURA.csv",
  FED_MUN_ACTA: "data/FEDERAL_MUN_POR_ACTA.csv",

  LOC_DL_PARTIDO: "data/LOCAL_DL_POR_PARTIDO.csv",
  LOC_DL_CAND: "data/LOCAL_DL_POR_CANDIDATURA.csv",
  LOC_MUN_ACTA: "data/LOCAL_MUN_POR_ACTA.csv",

  MUN_PARTIDO: "data/MUNICIPIO_POR_PARTIDO.csv",
  MUN_CAND: "data/MUNICIPIO_POR_CANDIDATURA.csv",
};

// Colores consistentes (acento verde + por partido/coalición)
const PARTY_COLORS = {
  "MORENA": "#7B1E1E",
  "PAN": "#0B4F8A",
  "PRI": "#0F7A3B",
  "PRD": "#C7A400",
  "PVEM": "#2E8B57",
  "PT": "#B00020",
  "MC": "#E67E22",
  "NAEM": "#5B3DBA", // Nueva Alianza Edomex (ajustable)

  // coaliciones frecuentes
  "PAN_PRI_PRD": "#274F7A",
  "PAN_PRI_PRD_NAEM": "#274F7A",
  "PAN_PRI": "#2E6A7A",
  "PAN_PRD": "#2E6A5A",
  "PRI_PRD": "#6A7A2E",
  "PAN_NAEM": "#3A4DB3",
  "PRD_NAEM": "#7A6A2E",
  "PRI_PRD_NAEM": "#6A7A2E",
  "PAN_PRI_NAEM": "#2E6A7A",
  "PAN_PRD_NAEM": "#2E6A5A",
  "PVEM_PT_MORENA": "#1B6B3A",
  "PVEM_PT": "#1B6B3A",
  "PVEM_MORENA": "#3A5A3A",
  "PT_MORENA": "#5A2A2A",
};

function colorForActor(actor) {
  const key = (actor || "").toUpperCase().trim();
  return PARTY_COLORS[key] || "#2C7A6B";
}

/* =========================
   CSV loader robusto
========================= */
async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar CSV: ${path} (HTTP ${res.status})`);
  const text = await res.text();
  return parseCSV(text);
}

// Parser CSV simple (soporta comillas)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") continue;
      row.push(cur);
      cur = "";

      if (ch === "\n") {
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      }
      continue;
    }

    cur += ch;
  }
  row.push(cur);
  if (row.length > 1) rows.push(row);

  if (rows.length === 0) return [];

  const header = rows[0].map(h => (h || "").trim());
  const data = rows.slice(1).map(r => {
    const obj = {};
    header.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return obj;
  });

  return data;
}

/* =========================
   Normalización columnas
========================= */
function pick(obj, keys) {
  for (const k of keys) {
    if (k in obj && obj[k] !== "") return obj[k];
  }
  return "";
}

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normRow(r) {
  const actor = pick(r, ["actor_politico", "actor", "partido", "coalicion", "siglas", "nombre"]);
  const votos = toNumber(pick(r, ["voto_actor_politico", "voto_actor_p", "votos", "num_votos", "voto", "votacion", "voto_actor"]));
  const pct = toNumber(pick(r, ["porcentaje_votacion", "porcentaje", "porcentaje_voto", "pct", "porcentaje_v"]));
  return { actor, votos, pct };
}

function buildRows(raw) {
  return raw
    .map(normRow)
    .filter(x => x.actor && x.votos >= 0)
    .sort((a, b) => b.votos - a.votos);
}

/* =========================
   Render tabla + logos
========================= */
function logoPath(actor) {
  const key = (actor || "").toUpperCase().trim();
  return `${LOGO_BASE}${key}.png`;
}

function renderTable(tbodyId, rows) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:14px;color:#6B7280;">Sin datos para mostrar.</td></tr>`;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement("tr");

    const tdLogo = document.createElement("td");
    tdLogo.innerHTML = `<img class="logo" src="${logoPath(r.actor)}" alt="${r.actor}" onerror="this.style.opacity=0.25;" />`;

    const tdActor = document.createElement("td");
    tdActor.textContent = r.actor;

    const tdVotos = document.createElement("td");
    tdVotos.className = "num";
    tdVotos.textContent = r.votos.toLocaleString("es-MX");

    const tdPct = document.createElement("td");
    tdPct.className = "num";
    tdPct.textContent = `${r.pct.toFixed(2)}%`;

    tr.appendChild(tdLogo);
    tr.appendChild(tdActor);
    tr.appendChild(tdVotos);
    tr.appendChild(tdPct);
    tbody.appendChild(tr);
  }
}

/* =========================
   Gráficas
========================= */
const charts = new Map();

function renderBarChart(canvasId, rows) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = rows.map(r => r.actor);
  const data = rows.map(r => r.votos);
  const bg = rows.map(r => colorForActor(r.actor));

  // destruir si existe
  if (charts.has(canvasId)) {
    charts.get(canvasId).destroy();
    charts.delete(canvasId);
  }

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Votos",
        data,
        backgroundColor: bg,
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { ticks: { autoSkip: false } },
        y: { beginAtZero: true }
      }
    }
  });

  charts.set(canvasId, chart);
}

/* =========================
   UI helpers
========================= */
function show(el, yes) {
  if (!el) return;
  el.classList.toggle("hidden", !yes);
}

function setError(errId, msg) {
  const el = document.getElementById(errId);
  if (!el) return;
  el.textContent = msg ? `Error: ${msg}` : "";
}

function bindTabs(tabA, tabB, viewA, viewB) {
  tabA.addEventListener("click", () => {
    tabA.classList.add("active");
    tabB.classList.remove("active");
    show(viewA, true);
    show(viewB, false);
  });
  tabB.addEventListener("click", () => {
    tabB.classList.add("active");
    tabA.classList.remove("active");
    show(viewB, true);
    show(viewA, false);
  });
}

/* =========================
   INITS (Federal / Local / Municipio)
========================= */
async function initFederal() {
  // Tabs DF
  const tA = document.getElementById("fed_df_tabPartido");
  const tB = document.getElementById("fed_df_tabCandidatura");
  const vA = document.getElementById("fed_df_viewPartido");
  const vB = document.getElementById("fed_df_viewCandidatura");
  bindTabs(tA, tB, vA, vB);

  // load DF partido
  try {
    setError("fed_df_errPartido", "");
    const raw = await loadCSV(CSV.FED_DF_PARTIDO);
    const rows = buildRows(raw);
    renderTable("fed_df_tbodyPartido", rows);
    renderBarChart("fed_df_chartPartido", rows);
  } catch (e) {
    setError("fed_df_errPartido", e.message);
  }

  // load DF candidatura
  try {
    setError("fed_df_errCandidatura", "");
    const raw = await loadCSV(CSV.FED_DF_CAND);
    const rows = buildRows(raw);
    renderTable("fed_df_tbodyCandidatura", rows);
    renderBarChart("fed_df_chartCandidatura", rows);
  } catch (e) {
    setError("fed_df_errCandidatura", e.message);
  }

  // municipio general acta
  try {
    setError("fed_munActa_err", "");
    const raw = await loadCSV(CSV.FED_MUN_ACTA);
    const rows = buildRows(raw);
    renderTable("fed_munActa_tbody", rows);
    renderBarChart("fed_munActa_chart", rows);
  } catch (e) {
    setError("fed_munActa_err", e.message);
  }

  // nivel selector
  const level = document.getElementById("fedLevel");
  const df = document.getElementById("fed_df");
  const munActa = document.getElementById("fed_munActa");
  const sync = () => {
    const val = level.value;
    show(df, val === "df");
    show(munActa, val === "munActa");
  };
  level.addEventListener("change", sync);
  sync();
}

async function initLocal() {
  // Tabs DL
  const tA = document.getElementById("loc_dl_tabPartido");
  const tB = document.getElementById("loc_dl_tabCandidatura");
  const vA = document.getElementById("loc_dl_viewPartido");
  const vB = document.getElementById("loc_dl_viewCandidatura");
  bindTabs(tA, tB, vA, vB);

  // load DL partido
  try {
    setError("loc_dl_errPartido", "");
    const raw = await loadCSV(CSV.LOC_DL_PARTIDO);
    const rows = buildRows(raw);
    renderTable("loc_dl_tbodyPartido", rows);
    renderBarChart("loc_dl_chartPartido", rows);
  } catch (e) {
    setError("loc_dl_errPartido", e.message);
  }

  // load DL candidatura
  try {
    setError("loc_dl_errCandidatura", "");
    const raw = await loadCSV(CSV.LOC_DL_CAND);
    const rows = buildRows(raw);
    renderTable("loc_dl_tbodyCandidatura", rows);
    renderBarChart("loc_dl_chartCandidatura", rows);
  } catch (e) {
    setError("loc_dl_errCandidatura", e.message);
  }

  // municipio general acta (local)
  try {
    setError("loc_munActa_err", "");
    const raw = await loadCSV(CSV.LOC_MUN_ACTA);
    const rows = buildRows(raw);
    renderTable("loc_munActa_tbody", rows);
    renderBarChart("loc_munActa_chart", rows);
  } catch (e) {
    setError("loc_munActa_err", e.message);
  }

  // nivel selector
  const level = document.getElementById("locLevel");
  const dl = document.getElementById("loc_dl");
  const munActa = document.getElementById("loc_munActa");
  const sync = () => {
    const val = level.value;
    show(dl, val === "dl");
    show(munActa, val === "munActa");
  };
  level.addEventListener("change", sync);
  sync();
}

async function initMunicipio() {
  const tabP = document.getElementById("mun_tabPartido");
  const tabC = document.getElementById("mun_tabCandidatura");
  const viewP = document.getElementById("mun_viewPartido");
  const viewC = document.getElementById("mun_viewCandidatura");
  bindTabs(tabP, tabC, viewP, viewC);

  // partido
  try {
    setError("mun_errPartido", "");
    const raw = await loadCSV(CSV.MUN_PARTIDO);
    const rows = buildRows(raw);
    renderTable("mun_tbodyPartido", rows);
    renderBarChart("mun_chartPartido", rows);
  } catch (e) {
    setError("mun_errPartido", e.message);
  }

  // candidatura
  try {
    setError("mun_errCandidatura", "");
    const raw = await loadCSV(CSV.MUN_CAND);
    const rows = buildRows(raw);
    renderTable("mun_tbodyCandidatura", rows);
    renderBarChart("mun_chartCandidatura", rows);
  } catch (e) {
    setError("mun_errCandidatura", e.message);
  }
}

/* =========================
   Router de módulos
========================= */
let initialized = { federal: false, local: false, municipio: false };

function setModule(name) {
  const vF = document.getElementById("viewFederal");
  const vL = document.getElementById("viewLocal");
  const vM = document.getElementById("viewMunicipio");

  show(vF, name === "federal");
  show(vL, name === "local");
  show(vM, name === "municipio");

  // init lazy
  if (name === "federal" && !initialized.federal) { initialized.federal = true; initFederal(); }
  if (name === "local" && !initialized.local) { initialized.local = true; initLocal(); }
  if (name === "municipio" && !initialized.municipio) { initialized.municipio = true; initMunicipio(); }
}

document.addEventListener("DOMContentLoaded", () => {
  const moduleSelect = document.getElementById("moduleSelect");
  moduleSelect.addEventListener("change", () => setModule(moduleSelect.value));
  setModule(moduleSelect.value);
});
