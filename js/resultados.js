/* resultados.js
   SCETECAMAC · Visor Electoral
   Carga CSV desde /data y pinta tabla + gráfica con Chart.js
*/

/* =========================
   CONFIG
========================= */
const DATA = {
  federal: {
    df_partido: "data/FEDERAL_DF_POR_PARTIDO.csv",
    df_candidatura: "data/FEDERAL_DF_POR_CANDIDATURA.csv",
    mun_acta: "data/FEDERAL_MUN_POR_ACTA.csv",
  },
  local: {
    dl_partido: "data/LOCAL_DL_POR_PARTIDO.csv",
    dl_candidatura: "data/LOCAL_DL_POR_CANDIDATURA.csv",
    mun_acta: "data/LOCAL_MUN_POR_ACTA.csv",
  },
  municipio: {
    partido: "data/MUNICIPIO_POR_PARTIDO.csv",
    candidatura: "data/MUNICIPIO_POR_CANDIDATURA.csv",
  },
};

const LOGO_BASE = "assets/logos/";

/* =========================
   HELPERS
========================= */
function $(id) {
  return document.getElementById(id);
}

function safeText(v) {
  return (v ?? "").toString().trim();
}

function normalizeActorKey(actor) {
  // Normaliza para nombres de archivo: MAYÚSCULAS, sin acentos, espacios->_
  const s = safeText(actor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  // Casos comunes de origen
  if (s === "MORENA") return "MORENA";
  if (s === "NAEM" || s === "N_A_E_M") return "NAEM";
  if (s === "MOVIMIENTO_CIUDADANO") return "MC";

  return s;
}

function isSpecialRow(actorKey) {
  // filas tipo "No Registrados", "Votos Nulos", "Total Votos"
  return /TOTAL|NULOS|NO_REG|NO_REGISTR|REGISTRADOS/i.test(actorKey);
}

function formatInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return safeText(n);
  return x.toLocaleString("es-MX");
}

function formatPct(p) {
  const x = Number(p);
  if (!Number.isFinite(x)) return safeText(p);
  // ya viene como porcentaje (0-100) en tu CSV
  return `${x.toFixed(2)}%`;
}

/* =========================
   COLOR CONFIG
========================= */
function getActorColor(actorKey) {
  // Si tu config_partidos.js define getActorConfig(key) => {color: "#..."}
  try {
    if (typeof window.getActorConfig === "function") {
      const cfg = window.getActorConfig(actorKey);
      if (cfg && cfg.color) return cfg.color;
    }
  } catch (_) {}

  // Fallback (colores consistentes)
  const fallback = {
    MORENA: "#8C1D40",
    PRI: "#0B7A3B",
    PAN: "#1E4FA1",
    PRD: "#F2C100",
    PVEM: "#2E8B57",
    PT: "#C62828",
    MC: "#F57C00",
    NAEM: "#6A1B9A",

    PAN_PRI_PRD: "#37474F",
    PAN_PRI: "#455A64",
    PAN_PRD: "#546E7A",
    PRI_PRD: "#607D8B",

    PVEM_PT_MORENA: "#1B5E20",
    PVEM_PT: "#2E7D32",
    PVEM_MORENA: "#33691E",
    PT_MORENA: "#4E342E",

    PAN_PRI_PRD_NAEM: "#263238",
    PAN_PRI_NAEM: "#3E2723",
    PAN_PRD_NAEM: "#1A237E",
    PRI_PRD_NAEM: "#004D40",
    PAN_NAEM: "#311B92",
    PRD_NAEM: "#827717",
  };

  return fallback[actorKey] || "#2E7D32"; // verde por defecto
}

/* =========================
   CSV LOADER
========================= */
async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar CSV: ${url} (${res.status})`);
  const text = await res.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (parsed.errors?.length) {
    console.warn("PapaParse warnings:", parsed.errors);
  }
  return parsed.data || [];
}

/* =========================
   ROW MAPPING (robusto a columnas)
========================= */
function mapRows(rawRows) {
  // Detecta columnas típicas del CSV que mostraste:
  // actor_politico, voto_actor_p, porcentaje_voto_actor_p
  // o variantes: votos, porcentaje_voto, porcentaje, etc.
  const rows = rawRows
    .map((r) => {
      const actor =
        r.actor_politico ??
        r.actor_politico_nombre ??
        r.actor ??
        r.partido ??
        r.candidatura ??
        r["Actor Politico"] ??
        r["Actor Político"];

      const votos =
        r.voto_actor_p ??
        r.votos ??
        r["Votos"] ??
        r["votos"] ??
        r.total ??
        r["Total"];

      const pct =
        r.porcentaje_voto_actor_p ??
        r.porcentaje_voto ??
        r.porcentaje ??
        r["Porcentaje"] ??
        r["% de la votación"] ??
        r["porcentaje_v"];

      return {
        actor: safeText(actor),
        actorKey: normalizeActorKey(actor),
        votos: Number(votos),
        pct: Number(pct),
      };
    })
    .filter((x) => x.actorKey.length > 0);

  // Orden: primero normales por votos desc, luego especiales al final
  const normal = rows.filter((x) => !isSpecialRow(x.actorKey)).sort((a, b) => (b.votos || 0) - (a.votos || 0));
  const special = rows.filter((x) => isSpecialRow(x.actorKey));
  return [...normal, ...special];
}

/* =========================
   TABLE RENDER
========================= */
function renderTable(tbodyId, rows) {
  const tbody = $(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");

    // Logo
    const tdLogo = document.createElement("td");
    tdLogo.style.width = "56px";

    if (!isSpecialRow(r.actorKey)) {
      const img = document.createElement("img");
      img.src = `${LOGO_BASE}${r.actorKey}.png`;
      img.alt = r.actor;
      img.style.width = "26px";
      img.style.height = "26px";
      img.style.objectFit = "contain";
      img.onerror = () => {
        // Si falta logo, no rompe la tabla
        img.style.display = "none";
      };
      tdLogo.appendChild(img);
    }

    // Actor
    const tdActor = document.createElement("td");
    tdActor.textContent = r.actor;

    // Votos
    const tdVotos = document.createElement("td");
    tdVotos.className = "num";
    tdVotos.textContent = formatInt(r.votos);

    // %
    const tdPct = document.createElement("td");
    tdPct.className = "num";
    tdPct.textContent = formatPct(r.pct);

    tr.appendChild(tdLogo);
    tr.appendChild(tdActor);
    tr.appendChild(tdVotos);
    tr.appendChild(tdPct);

    tbody.appendChild(tr);
  }
}

/* =========================
   CHART RENDER
========================= */
const chartRegistry = new Map();

function renderBarChart(canvasId, rows, title) {
  const canvas = $(canvasId);
  if (!canvas) return;

  const key = canvasId;
  if (chartRegistry.has(key)) {
    chartRegistry.get(key).destroy();
    chartRegistry.delete(key);
  }

  // Solo filas normales para la gráfica
  const dataRows = rows.filter((x) => !isSpecialRow(x.actorKey));

  const labels = dataRows.map((r) => r.actor);
  const data = dataRows.map((r) => (Number.isFinite(r.votos) ? r.votos : 0));
  const colors = dataRows.map((r) => getActorColor(r.actorKey));

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatInt(ctx.parsed.y)} votos`,
          },
        },
      },
      scales: {
        x: {
          ticks: { maxRotation: 25, minRotation: 0 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => formatInt(v),
          },
        },
      },
    },
  });

  chartRegistry.set(key, chart);
}

/* =========================
   TAB HANDLERS
========================= */
function wireTabs({
  tabAId,
  tabBId,
  viewAId,
  viewBId,
  onShowA,
  onShowB,
}) {
  const tabA = $(tabAId);
  const tabB = $(tabBId);
  const viewA = $(viewAId);
  const viewB = $(viewBId);

  function showA() {
    tabA?.classList.add("active");
    tabB?.classList.remove("active");
    viewA?.classList.remove("hidden");
    viewB?.classList.add("hidden");
    onShowA?.();
  }

  function showB() {
    tabB?.classList.add("active");
    tabA?.classList.remove("active");
    viewB?.classList.remove("hidden");
    viewA?.classList.add("hidden");
    onShowB?.();
  }

  tabA?.addEventListener("click", showA);
  tabB?.addEventListener("click", showB);

  // default
  showA();
}

/* =========================
   INIT MODULES
========================= */
async function initFederal() {
  // DF tabs
  const dfPartidoRows = mapRows(await loadCSV(DATA.federal.df_partido));
  const dfCandRows = mapRows(await loadCSV(DATA.federal.df_candidatura));
  const munActaRows = mapRows(await loadCSV(DATA.federal.mun_acta));

  const paintDFPartido = () => {
    renderTable("df_tbodyPartido", dfPartidoRows);
    renderBarChart("df_chartPartido", dfPartidoRows, "Votos por Partido");
  };
  const paintDFCand = () => {
    renderTable("df_tbodyCandidatura", dfCandRows);
    renderBarChart("df_chartCandidatura", dfCandRows, "Votos por Candidatura");
  };

  wireTabs({
    tabAId: "df_tabPartido",
    tabBId: "df_tabCandidatura",
    viewAId: "df_viewPartido",
    viewBId: "df_viewCandidatura",
    onShowA: paintDFPartido,
    onShowB: paintDFCand,
  });

  // Municipal general (acta)
  renderTable("mgen_tbodyActa", munActaRows);
  renderBarChart("mgen_chartActa", munActaRows, "Votos (Por Acta)");
}

async function initLocal() {
  const dlPartidoRows = mapRows(await loadCSV(DATA.local.dl_partido));
  const dlCandRows = mapRows(await loadCSV(DATA.local.dl_candidatura));
  const munActaRows = mapRows(await loadCSV(DATA.local.mun_acta));

  const paintDLPartido = () => {
    renderTable("ldl_tbodyPartido", dlPartidoRows);
    renderBarChart("ldl_chartPartido", dlPartidoRows, "Votos por Partido");
  };
  const paintDLCand = () => {
    renderTable("ldl_tbodyCandidatura", dlCandRows);
    renderBarChart("ldl_chartCandidatura", dlCandRows, "Votos por Candidatura");
  };

  wireTabs({
    tabAId: "ldl_tabPartido",
    tabBId: "ldl_tabCandidatura",
    viewAId: "ldl_viewPartido",
    viewBId: "ldl_viewCandidatura",
    onShowA: paintDLPartido,
    onShowB: paintDLCand,
  });

  renderTable("lmgen_tbodyActa", munActaRows);
  renderBarChart("lmgen_chartActa", munActaRows, "Votos (Por Acta)");
}

async function initMunicipio() {
  const pRows = mapRows(await loadCSV(DATA.municipio.partido));
  const cRows = mapRows(await loadCSV(DATA.municipio.candidatura));

  const paintP = () => {
    renderTable("mun_tbodyPartido", pRows);
    renderBarChart("mun_chartPartido", pRows, "Votos por Partido");
  };
  const paintC = () => {
    renderTable("mun_tbodyCandidatura", cRows);
    renderBarChart("mun_chartCandidatura", cRows, "Votos por Candidatura");
  };

  wireTabs({
    tabAId: "mun_tabPartido",
    tabBId: "mun_tabCandidatura",
    viewAId: "mun_viewPartido",
    viewBId: "mun_viewCandidatura",
    onShowA: paintP,
    onShowB: paintC,
  });
}

/* =========================
   BOOT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Inicializa TODO (Federal/Local/Municipio) para que al cambiar módulo ya esté listo.
    await initFederal();
    await initLocal();
    await initMunicipio();
  } catch (err) {
    console.error(err);
    alert("No se pudieron cargar los resultados. Revisa nombres/rutas de CSV y consola.");
  }
});
