/* ==========================
   SCETECAMAC | Geográfico
   - Lee CSV desde /data/geo/
   - Tabla dinámica + buscador
   - Planos: botones a Drive
========================== */

const GEO = {
  files: {
    federal: {
      secciones: "data/geo/SECCIONES_FEDERAL_DF20.csv",
      colonias: "data/geo/COLONIAS_FEDERAL_DF20.csv",
      planos:   "data/geo/FED_DF20_PLANOS.csv",
      pill: "DF20"
    },
    local: {
      secciones: "data/geo/SECCIONES_LOCAL_DL22.csv",
      colonias: "data/geo/COLONIAS_LOCAL_DL22.csv",
      planos:   "data/geo/LOCAL_DL22_PLANOS.csv",
      pill: "DL22"
    },
    municipio: {
      secciones: "data/geo/SECCIONES_MUNICIPIO_TECAMAC.csv",
      colonias: "data/geo/COLONIAS_MUNICIPIO_TECAMAC.csv",
      planos:   "data/geo/MUN_TECAMAC_PLANOS.csv",
      pill: "TECÁMAC"
    }
  }
};

const $ = (id) => document.getElementById(id);

let state = {
  module: "federal",
  activeTab: "secciones",
  secciones: { cols: [], rows: [] },
  colonias:  { cols: [], rows: [] },
  planos:    { rows: [] }
};

function setActiveTab(tab) {
  state.activeTab = tab;

  $("viewSecciones").classList.toggle("hidden", tab !== "secciones");
  $("viewColonias").classList.toggle("hidden", tab !== "colonias");
  $("viewPlanos").classList.toggle("hidden", tab !== "planos");

  $("tabSecciones").classList.toggle("active", tab === "secciones");
  $("tabColonias").classList.toggle("active", tab === "colonias");
  $("tabPlanos").classList.toggle("active", tab === "planos");
}

function setPills() {
  const pill = GEO.files[state.module].pill;
  $("seccionesPill").textContent = pill;
  $("coloniasPill").textContent = pill;
  $("planosPill").textContent = pill;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar: ${url}`);
  return await res.text();
}

/* CSV parser simple (con comillas) */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' ) {
      if (inQuotes && next === '"') { // "" -> "
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur.trim());
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur.trim());
      cur = "";
      // evitar filas vacías
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // última celda
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(v => v !== "")) rows.push(row);
  }

  if (rows.length === 0) return { cols: [], rows: [] };

  const cols = rows[0].map(c => c.replace(/\uFEFF/g, "").trim());
  const data = rows.slice(1).map(r => {
    const obj = {};
    cols.forEach((c, idx) => obj[c] = (r[idx] ?? "").trim());
    return obj;
  });

  return { cols, rows: data };
}

function renderTable(theadEl, tbodyEl, cols, rows, maxCols = 9) {
  // limitar columnas si vienen muchas (puedes subirlo si quieres)
  const useCols = cols.slice(0, maxCols);

  theadEl.innerHTML = `
    <tr>
      ${useCols.map(c => `<th>${escapeHTML(c)}</th>`).join("")}
    </tr>
  `;

  tbodyEl.innerHTML = rows.map(r => `
    <tr>
      ${useCols.map(c => `<td>${escapeHTML(r[c] ?? "")}</td>`).join("")}
    </tr>
  `).join("");
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filterRows(rows, query) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(obj => {
    return Object.values(obj).some(v => String(v ?? "").toLowerCase().includes(q));
  });
}

function renderPlanos(rows) {
  // Intento flexible de columnas: Tipo / Nombre / URL
  const pick = (obj, keys) => keys.map(k => obj[k]).find(v => v && String(v).trim() !== "") || "";

  const tbody = $("planosTbody");
  tbody.innerHTML = rows.map(r => {
    const tipo = pick(r, ["TIPO", "Tipo", "CLASE", "Clase", "CATEGORIA", "Categoria"]);
    const nombre = pick(r, ["NOMBRE", "Nombre", "TITULO", "Titulo", "PLANO", "Plano"]) || "Plano";
    const url = pick(r, ["URL", "Url", "LINK", "Link", "ENLACE", "Enlace"]);

    const safeUrl = escapeHTML(url);
    const canOpen = url && url.startsWith("http");

    return `
      <tr>
        <td>${escapeHTML(tipo)}</td>
        <td>${escapeHTML(nombre)}</td>
        <td class="num">
          ${canOpen
            ? `<a class="tab" style="text-decoration:none; padding:8px 12px; display:inline-flex; justify-content:center;" href="${safeUrl}" target="_blank" rel="noopener">Abrir</a>`
            : `<span class="hint">Sin URL</span>`
          }
        </td>
      </tr>
    `;
  }).join("");
}

async function loadAllForModule() {
  const cfg = GEO.files[state.module];
  setPills();

  // limpiar errores
  $("seccionesErr").textContent = "";
  $("coloniasErr").textContent = "";
  $("planosErr").textContent = "";

  try {
    const seccText = await fetchText(cfg.secciones);
    state.secciones = parseCSV(seccText);
    renderTable($("seccionesThead"), $("seccionesTbody"), state.secciones.cols, state.secciones.rows, 9);
  } catch (e) {
    $("seccionesErr").textContent = `No se pudieron cargar Secciones. ${e.message}`;
    state.secciones = { cols: [], rows: [] };
  }

  try {
    const colText = await fetchText(cfg.colonias);
    state.colonias = parseCSV(colText);
    renderTable($("coloniasThead"), $("coloniasTbody"), state.colonias.cols, state.colonias.rows, 9);
  } catch (e) {
    $("coloniasErr").textContent = `No se pudieron cargar Colonias. ${e.message}`;
    state.colonias = { cols: [], rows: [] };
  }

  try {
    const plaText = await fetchText(cfg.planos);
    const parsed = parseCSV(plaText);
    state.planos = { rows: parsed.rows };
    renderPlanos(state.planos.rows);
  } catch (e) {
    $("planosErr").textContent = `No se pudieron cargar Planos. ${e.message}`;
    state.planos = { rows: [] };
  }
}

function wireEvents() {
  $("geoModuleSelect").addEventListener("change", async (ev) => {
    state.module = ev.target.value;
    await loadAllForModule();
    // mantener tab actual
    setActiveTab(state.activeTab);
  });

  $("tabSecciones").addEventListener("click", () => setActiveTab("secciones"));
  $("tabColonias").addEventListener("click", () => setActiveTab("colonias"));
  $("tabPlanos").addEventListener("click", () => setActiveTab("planos"));

  $("searchSecciones").addEventListener("input", (ev) => {
    const q = ev.target.value;
    const filtered = filterRows(state.secciones.rows, q);
    renderTable($("seccionesThead"), $("seccionesTbody"), state.secciones.cols, filtered, 9);
  });

  $("searchColonias").addEventListener("input", (ev) => {
    const q = ev.target.value;
    const filtered = filterRows(state.colonias.rows, q);
    renderTable($("coloniasThead"), $("coloniasTbody"), state.colonias.cols, filtered, 9);
  });
}

(async function init() {
  // default
  state.module = $("geoModuleSelect").value || "federal";
  state.activeTab = "secciones";

  wireEvents();
  setActiveTab("secciones");
  await loadAllForModule();
})();
