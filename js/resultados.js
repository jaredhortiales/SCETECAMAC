// Requiere: Chart.js + PapaParse + getActorConfig(actor) desde config_partidos.js

const DATASETS = {
  // Diputados Federales por Distrito Federal
  federal_df: {
    partido: "data/FEDERAL_DF_POR_PARTIDO.csv",
    candidatura: "data/FEDERAL_DF_POR_CANDIDATURA.csv"
  },
  // Diputados Federales por Municipio (Tecámac)
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

function toDataset(rows){
  const out = [];
  for (const r of rows){
    const actor = String(getVal(r, ["actor_politico","Actor Politico","Actor Político"])).trim();
    if (!actor || actor === "0") continue;

    const votos = Number(getVal(r, ["voto_actor_politico","votos","Votos"])) || 0;
    const pct = Number(getVal(r, ["porcentaje_votacion","porcentaje","%"])) || 0;

    out.push({ actor, votos, pct });
  }
  out.sort((a,b) => b.votos - a.votos);
  return out;
}

function renderTabla(dataset, tbodyId){
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

// Control genérico de una vista (tabs + tabla + gráfica)
function makeView(prefix, datasetKey){
  const tabPartido = document.getElementById(`${prefix}_tabPartido`);
  const tabCandidatura = document.getElementById(`${prefix}_tabCandidatura`);
  const viewPartido = document.getElementById(`${prefix}_viewPartido`);
  const viewCandidatura = document.getElementById(`${prefix}_viewCandidatura`);

  let chartPartido = null;
  let chartCandidatura = null;

  async function loadAndRender(tipo){
    const url = DATASETS[datasetKey][tipo];
    const rows = await parseCSV(url);
    const dataset = toDataset(rows);

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

  // Inicial
  return {
    init: async () => {
      setActive("partido");
      await loadAndRender("partido");
    }
  };
}

async function init(){
  // Federal DF
  const df = makeView("df", "federal_df");
  await df.init();

  // Federal Municipio Tecámac
  const mun = makeView("mun", "federal_mun_tecamac");
  await mun.init();
}

init().catch(err => {
  console.error(err);
  alert("No se pudieron cargar los resultados. Verifica los CSV en /data y sus nombres.");
});
