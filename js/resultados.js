// Requiere: Chart.js + PapaParse + getActorConfig(actor) en config_partidos.js

const DATASETS = {
  federal_df: {
    partido: "data/FEDERAL_DF_POR_PARTIDO.csv",
    candidatura: "data/FEDERAL_DF_POR_CANDIDATURA.csv"
  },
  federal_mun_general: {
    acta: "data/FEDERAL_MUN_POR_ACTA.csv"
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

function toDatasetWithMeta(rows){
  const out = [];
  const meta = {
    total_votos: null,
    votos_nulos: null,
    pct_nulos: null,
    no_registrados: null,
    pct_no_registrados: null
  };

  for (const r of rows){
    if (meta.total_votos === null) {
      const tv = getVal(r, ["total_votos","total"]);
      if (tv !== "") meta.total_votos = Number(tv);
    }
    if (meta.votos_nulos === null) {
      const vn = getVal(r, ["num_votos_n","votos_nulos"]);
      if (vn !== "") meta.votos_nulos = Number(vn);
    }
    if (meta.pct_nulos === null) {
      const pn = getVal(r, ["porcentaje_votos_nulos","porcentaje_vn","porcentaje_v_n","porcentaje_v"]);
      if (pn !== "") meta.pct_nulos = Number(pn);
    }
    if (meta.no_registrados === null) {
      const nr = getVal(r, ["num_votos_c","no_registrados"]);
      if (nr !== "") meta.no_registrados = Number(nr);
    }
    if (meta.pct_no_registrados === null) {
      const pnr = getVal(r, ["porcentaje_ca","porcentaje_no_registrados","porcentaje_nr"]);
      if (pnr !== "") meta.pct_no_registrados = Number(pnr);
    }

    const actor = String(getVal(r, ["actor_politico"])).trim();
    if (!actor) continue;

    const votos = Number(getVal(r, ["voto_actor_politico","voto_actor_p","votos"])) || 0;
    const pct = Number(getVal(r, ["porcentaje_votacion","porcentaje_vc","porcentaje_v","porcentaje"])) || 0;

    out.push({ actor, votos, pct });
  }

  out.sort((a,b) => b.votos - a.votos);
  return { dataset: out, meta };
}

function renderTabla(dataset, tbodyId, meta=null){
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

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
      <td><img class="logo" src="${cfg.logo}" alt="${row.actor}" onerror="this.style.display='none';" /></td>
      <td>${row.actor}</td>
      <td class="num">${fmtInt(row.votos)}</td>
      <td class="num">${fmtPct(row.pct)}</td>
    `;
    tbody.appendChild(tr);
  }

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
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");
  const labels = dataset.map(d => d.actor);
  const data = dataset.map(d => d.votos);
  const colors = dataset.map(d => getActorConfig(d.actor).color);

  return new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Votos", data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#475569" }, grid: { color: "rgba(226,232,240,.9)" } },
        y: { ticks: { color: "#475569" }, grid: { color: "rgba(226,232,240,.9)" } }
      }
    }
  });
}

function makeViewTwoTabs(prefix, datasetKey){
  const tabPartido = document.getElementById(`${prefix}_tabPartido`);
  const tabCandidatura = document.getElementById(`${prefix}_tabCandidatura`);
  const viewPartido = document.getElementById(`${prefix}_viewPartido`);
  const viewCandidatura = document.getElementById(`${prefix}_viewCandidatura`);

  let chartPartido = null;
  let chartCandidatura = null;

  async function safeLoad(tipo){
    try{
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
    }catch(e){
      console.error(e);
    }
  }

  function setActive(which){
    if (which === "partido"){
      tabPartido?.classList.add("active");
      tabCandidatura?.classList.remove("active");
      viewPartido?.classList.remove("hidden");
      viewCandidatura?.classList.add("hidden");
    } else {
      tabCandidatura?.classList.add("active");
      tabPartido?.classList.remove("active");
      viewCandidatura?.classList.remove("hidden");
      viewPartido?.classList.add("hidden");
    }
  }

  tabPartido?.addEventListener("click", async () => { setActive("partido"); await safeLoad("partido"); });
  tabCandidatura?.addEventListener("click", async () => { setActive("candidatura"); await safeLoad("candidatura"); });

  return { init: async () => { setActive("partido"); await safeLoad("partido"); } };
}

function makeViewSingleActa(prefix, datasetKey){
  let chartActa = null;

  async function safeLoad(){
    try{
      const url = DATASETS[datasetKey].acta;
      const rows = await parseCSV(url);
      const { dataset, meta } = toDatasetWithMeta(rows);

      renderTabla(dataset, `${prefix}_tbodyActa`, meta);
      destroyChart(chartActa);
      chartActa = renderChart(dataset, `${prefix}_chartActa`);
    }catch(e){
      console.error(e);
    }
  }

  return { init: async () => { await safeLoad(); } };
}

async function init(){
  // Esto funciona con los 3 archivos que ya tienes en /data
  const df = makeViewTwoTabs("df", "federal_df");
  await df.init();

  const mgen = makeViewSingleActa("mgen", "federal_mun_general");
  await mgen.init();
}

init();
