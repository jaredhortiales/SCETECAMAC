// Requiere: Chart.js + PapaParse + getActorConfig(actor) desde config_partidos.js

const DATASETS = {
  // Distrital: 2 opciones
  federal_df: {
    partido: "data/FEDERAL_DF_POR_PARTIDO.csv",
    candidatura: "data/FEDERAL_DF_POR_CANDIDATURA.csv"
  },

  // Municipal general: SOLO "Por Acta"
  federal_mun_general: {
    acta: "data/FEDERAL_MUN_POR_ACTA.csv"
  },

  // Municipio individual (Tecámac): 2 opciones
  federal_mun_tecamac: {
    partido: "data/FEDERAL_MUN_TECAMAC_POR_PARTIDO.csv",
    candidatura: "data/FEDERAL_MUN_TECAMAC_POR_CANDIDATURA.csv"
  }
};

function fmtInt(n){
  const x = Number(n);
  return isFinite(x) ? x.toLocaleString("es-MX") : "—";
}
function fmtPct(n){
  const x = Number(n);
  return isFinite(x) ? `${x.toFixed(2)}%` : "—";
}

function parseCSV(url){
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err)
    });
  });
}

function getVal(row, keys){
  for (const k of keys){
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

/**
 * Convierte filas del CSV a dataset de actores (PAN, MORENA, coaliciones, etc.)
 * y extrae meta (totales, nulos, no registrados) si vienen en el archivo.
 */
function toDatasetWithMeta(rows){
  const out = [];
  const meta = {
    total_votos: null,
    votos_nulos: null,
    pct_nulos: null,
    no_registrados: null,
    pct_no_registrados: null,
    casillas: null,
    secciones: null
  };

  for (const r of rows){
    // Meta (son iguales en todas las filas; tomamos la primera disponible)
    if (meta.total_votos === null) {
      const tv = getVal(r, ["total_votos","Total Votos","total"]);
      if (tv !== "") meta.total_votos = Number(tv);
    }
    if (meta.votos_nulos === null) {
      const vn = getVal(r, ["num_votos_n","votos_nulos","Votos Nulos"]);
      if (vn !== "") meta.votos_nulos = Number(vn);
    }
    if (meta.pct_nulos === null) {
      const pn = getVal(r, ["porcentaje_votos_nulos","porcentaje_vn","porcentaje_v_n","porcentaje_v"]);
      // En tu CSV, la columna de % nulos parece ser la que acompaña a num_votos_n.
      // Si viene repetida como "porcentaje_v..." la tomamos.
      if (pn !== "") meta.pct_nulos = Number(pn);
    }
    if (meta.no_registrados === null) {
      const nr = getVal(r, ["num_votos_c","no_registrados","No Registrados"]);
      if (nr !== "") meta.no_registrados = Number(nr);
    }
    if (meta.pct_no_registrados === null) {
      const pnr = getVal(r, ["porcentaje_ca","porcentaje_no_registrados","porcentaje_nr"]);
      if (pnr !== "") meta.pct_no_registrados = Number(pnr);
    }
    if (meta.casillas === null) {
      const c = getVal(r, ["casillas"]);
      if (c !== "") meta.casillas = Number(c);
    }
    if (meta.secciones === null) {
      const s = getVal(r, ["secciones"]);
      if (s !== "") meta.secciones = Number(s);
    }

    // Dataset por actor
    const actor = String(getVal(r, ["actor_politico","Actor Politico","Actor Político"])).trim();
    if (!actor || actor === "0") continue;

    const votos = Number(getVal(r, ["voto_actor_politico","voto_actor_p","votos","Votos"])) || 0;
    const pct = Number(getVal(r, ["porcentaje_votacion","porcentaje_vc","porcentaje_v","porcentaje"])) || 0;

    out.push({ actor, votos, pct });
  }

  out.sort((a,b) => b.votos - a.votos);
  return { dataset: out, meta };
}

function renderTabla(dataset, tbodyId, meta=null){
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";

  if (!dataset.length){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">Sin datos.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const row of dataset){
    const cfg = getActorConfig(row.actor);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <img class="logo" src="${cfg.logo}" alt="${row.actor}" onerror="this.style.display='none';" />
      </td>
      <td>${row.actor}</td>
      <td class="num">${fmtInt(row.votos)}</td>
      <td class="num">${fmtPct(row.pct)}</td>
    `;
    tbody.appendChild(tr);
  }

  // Si hay meta, agregamos las filas finales como en el sistema (No registrados, Votos nulos, Total votos)
  if (meta && (meta.no_registrados !== null || meta.votos_nulos !== null || meta.total_votos !== null)) {
    const makeTotalRow = (label, value, pct) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td></td>
        <td><b>${label}</b></td>
        <td class="num"><b>${fmtInt(value)}</b></td>
        <td class="num"><b>${pct !== null && pct !== undefined ? fmtPct(pct) : "—"}</b></td>
      `;
      tbody.appendChild(tr);
    };

    if (meta.no_registrados !== null) makeTotalRow("No registrados", meta.no_registrados, meta.pct_no_registrados);
    if (meta.votos_nulos !== null) makeTotalRow("Votos nulos", meta.votos_nulos, meta.pct_nulos);
    if (meta.total_votos !== null) makeTotalRow("Total votos", meta.total_votos, 100);
  }
}

function destroyChart(ch){
  if (ch) ch.destroy();
}

function renderChart(dataset, canvasId){
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  const labels = dataset.map(d => d.actor);
  const data = dataset.map(d => d.votos);
  const colors = dataset.map(d => getActorConfig(d.actor).color);

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Votos",
        data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${fmtInt(c.raw)} votos` } }
      },
      scales: {
        x: { ticks: { color: "#475569" }, grid: { color: "rgba(226,232,240,.9)" } },
        y: { ticks: { color: "#475569" }, grid: { color: "rgba(226,232,240,.9)" } }
      }
    }
  });
}

/**
 * Vista con dos opciones (tabs): partido / candidatura
 */
function makeViewTwoTabs(prefix, datasetKey){
  const tabPartido = document.getElementById(`${prefix}_tabPartido`);
  const tabCandidatura = document.getElementById(`${prefix}_tabCandidatura`);
  const viewPartido = document.getElementById(`${prefix}_viewPartido`);
  const viewCandidatura = document.getElementById(`${prefix}_viewCandidatura`);

  let chartPartido = null;
  let chartCandidatura = null;

  async function loadAndRender(tipo){
    const url = DATASETS[datasetKey][tipo];
    const rows = await parseCSV(url);
    const { dataset } = toDatasetWithMeta(rows);

    if (tipo === "partido"){
      renderTabla(dataset, `${prefix}_tbodyPartido`);
      destroyChart(chartPartido);
      chartPartido = renderChart(dataset, `${prefix}_chartPartido`);
    } else {
      renderTabla(dataset, `${prefix}_tbodyCandidatura`);
      destroyChart(chartCandidatura);
      chartCandidatura = renderChart(dataset, `${prefix}_chartCandidatura`);
    }
  }

  function setActive(which){
    if (which === "partido"){
      tabPartido.classList.add("active");
      tabCandidatura.classList.remove("active");
      viewPartido.classList.remove("hidden");
      viewCandidatura.classList.add("hidden");
    } else {
      tabCandidatura.classList.add("active");
      tabPartido.classList.remove("active");
      viewCandidatura.classList.remove("hidden");
      viewPartido.classList.add("hidden");
    }
  }

  tabPartido.addEventListener("click", async () => {
    setActive("partido");
    await loadAndRender("partido");
  });

  tabCandidatura.addEventListener("click", async () => {
    setActive("candidatura");
    await loadAndRender("candidatura");
  });

  return {
    init: async () => {
      setActive("partido");
      await loadAndRender("partido");
    }
  };
}

/**
 * Vista única: "Por Acta" (con totales al final)
 */
function makeViewSingleActa(prefix, datasetKey){
  let chartActa = null;

  async function loadAndRender(){
    const url = DATASETS[datasetKey].acta;
    const rows = await parseCSV(url);
    const { dataset, meta } = toDatasetWithMeta(rows);

    renderTabla(dataset, `${prefix}_tbodyActa`, meta);
    destroyChart(chartActa);
    chartActa = renderChart(dataset, `${prefix}_chartActa`);
  }

  return {
    init: async () => {
      await loadAndRender();
    }
  };
}

async function init(){
  // 1) Federal por Distrito Federal (2 tabs)
  const df = makeViewTwoTabs("df", "federal_df");
  await df.init();

  // 2) Federal por Municipio (General) SOLO Acta (con totales)
  const mgen = makeViewSingleActa("mgen", "federal_mun_general");
  await mgen.init();

  // 3) Federal por Municipio individual (Tecámac) (2 tabs)
  const munTec = makeViewTwoTabs("mun", "federal_mun_tecamac");
  await munTec.init();
}

init().catch(err => {
  console.error(err);
  alert("No se pudieron cargar los resultados. Verifica los CSV en /data y sus nombres.");
});
