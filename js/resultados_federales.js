const FEDERAL_PARTIDO_URL = "data/FEDERAL_POR_PARTIDO.csv";
const FEDERAL_CANDIDATURA_URL = "data/FEDERAL_POR_CANDIDATURA.csv";

let chartPartido = null;
let chartCandidatura = null;

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

function renderChart(dataset, canvasId, setRef){
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  const labels = dataset.map(d => d.actor);
  const data = dataset.map(d => d.votos);
  const colors = dataset.map(d => getActorConfig(d.actor).color);

  const ch = new Chart(ctx, {
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
        tooltip: {
          callbacks: { label: (c) => ` ${fmtInt(c.raw)} votos` }
        }
      },
      scales: {
        x: { ticks: { color: "#a8b6d6" }, grid: { color: "rgba(32,49,79,.35)" } },
        y: { ticks: { color: "#a8b6d6" }, grid: { color: "rgba(32,49,79,.35)" } }
      }
    }
  });

  setRef(ch);
}

async function cargarPorPartido(){
  const rows = await parseCSV(FEDERAL_PARTIDO_URL);
  const dataset = toDataset(rows);

  renderTabla(dataset, "tbodyPartido");

  destroyChart(chartPartido);
  renderChart(dataset, "chartPartido", (c) => chartPartido = c);
}

async function cargarPorCandidatura(){
  const rows = await parseCSV(FEDERAL_CANDIDATURA_URL);
  const dataset = toDataset(rows);

  renderTabla(dataset, "tbodyCandidatura");

  destroyChart(chartCandidatura);
  renderChart(dataset, "chartCandidatura", (c) => chartCandidatura = c);
}

function setActiveTab(which){
  const tabPartido = document.getElementById("tabPartido");
  const tabCandidatura = document.getElementById("tabCandidatura");
  const viewPartido = document.getElementById("viewPartido");
  const viewCandidatura = document.getElementById("viewCandidatura");

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

async function init(){
  document.getElementById("tabPartido").addEventListener("click", async () => {
    setActiveTab("partido");
    await cargarPorPartido();
  });

  document.getElementById("tabCandidatura").addEventListener("click", async () => {
    setActiveTab("candidatura");
    await cargarPorCandidatura();
  });

  setActiveTab("partido");
  await cargarPorPartido();
}

init().catch(err => {
  console.error(err);
  alert("No se pudieron cargar los resultados federales. Revisa /data y nombres de archivos.");
});
