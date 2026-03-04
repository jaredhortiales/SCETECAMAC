let chartInstance = null;

// Archivos (GitHub Pages)
const DATA_MUNICIPIO = "data/federales_por_municipio.csv";
const DATA_DISTRITO  = "data/federales_por_distrito.csv"; // lo subirás después

const selNivel = document.getElementById("selNivel");
const selMunicipio = document.getElementById("selMunicipio");
const selDistrito = document.getElementById("selDistrito");
const btnConsultar = document.getElementById("btnConsultar");

const tbody = document.getElementById("tbodyResultados");
const cardsResumen = document.getElementById("cardsResumen");
const tituloTabla = document.getElementById("tituloTabla");

function fmtInt(n){
  const x = Number(n);
  if (!isFinite(x)) return "—";
  return x.toLocaleString("es-MX");
}
function fmtPct(n){
  const x = Number(n);
  if (!isFinite(x)) return "—";
  return `${x.toFixed(2)}%`;
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

function uniqueSorted(arr){
  return [...new Set(arr)].filter(v => v !== null && v !== undefined && v !== "").sort((a,b) => String(a).localeCompare(String(b)));
}

function getVal(row, keys){
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return "";
}

function normalizeActor(actor){
  return String(actor || "").trim();
}

// En tu CSV actual, "municipios" viene como 0 (agregado). Esto lo soporta.
// Cuando subas el CSV real por municipio, aquí saldrán los nombres/códigos.
function loadMunicipios(rows){
  const vals = rows.map(r => getVal(r, ["municipios", "municipio", "MUNICIPIO"]));
  const uniq = uniqueSorted(vals.map(v => String(v)));
  selMunicipio.innerHTML = "";
  (uniq.length ? uniq : ["0"]).forEach(v => {
    const op = document.createElement("option");
    op.value = v;
    op.textContent = (v === "0") ? "Todos / Agregado" : v;
    selMunicipio.appendChild(op);
  });
}

// Para distrito: se habilita cuando exista el CSV de distritos y podamos cargarlo.
async function tryLoadDistritos(){
  try{
    const rows = await parseCSV(DATA_DISTRITO);
    const vals = rows.map(r => getVal(r, ["distritos", "distrito", "DISTRITO"]));
    const uniq = uniqueSorted(vals.map(v => String(v)));
    selDistrito.innerHTML = "";
    uniq.forEach(v => {
      const op = document.createElement("option");
      op.value = v;
      op.textContent = v;
      selDistrito.appendChild(op);
    });
    selDistrito.disabled = (uniq.length === 0);
    return rows;
  }catch(e){
    selDistrito.innerHTML = "";
    selDistrito.disabled = true;
    return null;
  }
}

function buildResumenCard(label, value){
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `<div class="k">${label}</div><div class="v">${value}</div>`;
  return div;
}

function renderResumen(rows){
  cardsResumen.innerHTML = "";
  if (!rows || !rows.length) return;

  const r0 = rows[0];
  const totalVotos = getVal(r0, ["total_votos","TOTAL_VOTOS"]);
  const nulos = getVal(r0, ["num_votos_nulos","NUM_VOTOS_NULOS"]);
  const nreg  = getVal(r0, ["num_votos_can_nreg","NUM_VOTOS_CAN_NREG"]);
  const casillas  = getVal(r0, ["casillas","CASILLAS"]);
  const secciones = getVal(r0, ["secciones","SECCIONES"]);

  cardsResumen.appendChild(buildResumenCard("Total de votos", fmtInt(totalVotos)));
  cardsResumen.appendChild(buildResumenCard("Votos nulos", fmtInt(nulos)));
  cardsResumen.appendChild(buildResumenCard("No registrados", fmtInt(nreg)));
  cardsResumen.appendChild(buildResumenCard("Casillas / Secciones", `${fmtInt(casillas)} / ${fmtInt(secciones)}`));
}

// Render tabla (logo + actor + votos + %)
function renderTabla(rows){
  tbody.innerHTML = "";
  if (!rows || !rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">Sin datos para la selección.</td>`;
    tbody.appendChild(tr);
    return;
  }

  // ordenar por votos desc
  const sorted = [...rows].sort((a,b) => Number(b.votos) - Number(a.votos));

  for (const row of sorted){
    const actor = row.actor;
    const cfg = getActorConfig(actor);

    const tr = document.createElement("tr");
    const logoSrc = cfg.logo;

    tr.innerHTML = `
      <td>
        <img class="logo" src="${logoSrc}" alt="${actor}"
             onerror="this.style.display='none';" />
      </td>
      <td>${actor}</td>
      <td class="num">${fmtInt(row.votos)}</td>
      <td class="num">${fmtPct(row.pct)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderChart(rows){
  const canvas = document.getElementById("chartVotos");
  const ctx = canvas.getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!rows || !rows.length) return;

  const sorted = [...rows].sort((a,b) => Number(b.votos) - Number(a.votos));
  const labels = sorted.map(r => r.actor);
  const data = sorted.map(r => Number(r.votos));

  const colors = sorted.map(r => getActorConfig(r.actor).color);

  chartInstance = new Chart(ctx, {
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
          callbacks: {
            label: (c) => ` ${fmtInt(c.raw)} votos`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#a8b6d6" },
          grid: { color: "rgba(32,49,79,.35)" }
        },
        y: {
          ticks: { color: "#a8b6d6" },
          grid: { color: "rgba(32,49,79,.35)" }
        }
      }
    }
  });
}

// Convierte filas CSV a dataset “limpio” de tabla
function toDataset(rows){
  // Filtrar la distribución que venga en el archivo. En tu CSV aparece "Por Total de votos".
  // Si mañana viene "Por Partido", seguirá funcionando (no amarra a un literal).
  const filtered = rows.filter(r => {
    const actor = normalizeActor(getVal(r, ["actor_politico","Actor Politico","Actor Político"]));
    return actor && actor !== "0";
  });

  // Agrupar por actor (por seguridad)
  const map = new Map();
  for (const r of filtered){
    const actor = normalizeActor(getVal(r, ["actor_politico","Actor Politico","Actor Político"]));
    const votos = Number(getVal(r, ["voto_actor_politico","votos","Votos"])) || 0;
    const pct = Number(getVal(r, ["porcentaje_votacion","porcentaje","%"])) || 0;

    if (!map.has(actor)) map.set(actor, { actor, votos:0, pct:0, pct_count:0 });
    const item = map.get(actor);
    item.votos += votos;
    item.pct += pct;
    item.pct_count += 1;
  }

  // Promedio de pct si venía por fila; si no, queda 0 y se puede recalcular después
  const out = [...map.values()].map(x => ({
    actor: x.actor,
    votos: x.votos,
    pct: x.pct_count ? (x.pct / x.pct_count) : 0
  }));

  return out;
}

async function consultar(){
  const nivel = selNivel.value;

  if (nivel === "municipio"){
    tituloTabla.textContent = "Resultados · Por Municipio";
    const rows = await parseCSV(DATA_MUNICIPIO);

    // Filtro por municipio (si existe en el dataset)
    const m = selMunicipio.value;
    const rowsFiltradas = rows.filter(r => String(getVal(r, ["municipios","municipio","MUNICIPIO"]) || "0") === String(m));

    const dataset = toDataset(rowsFiltradas.length ? rowsFiltradas : rows);

    renderResumen(rowsFiltradas.length ? rowsFiltradas : rows);
    renderTabla(dataset);
    renderChart(dataset);
    return;
  }

  // nivel distrito
  tituloTabla.textContent = "Resultados · Por Distrito Federal";
  const rowsD = await parseCSV(DATA_DISTRITO); // si no existe, lanzará error

  const d = selDistrito.value;
  const rowsFiltradas = rowsD.filter(r => String(getVal(r, ["distritos","distrito","DISTRITO"])) === String(d));

  const dataset = toDataset(rowsFiltradas.length ? rowsFiltradas : rowsD);

  renderResumen(rowsFiltradas.length ? rowsFiltradas : rowsD);
  renderTabla(dataset);
  renderChart(dataset);
}

async function init(){
  // Cargar municipios desde el CSV actual
  const rowsM = await parseCSV(DATA_MUNICIPIO);
  loadMunicipios(rowsM);

  // Intentar cargar distritos (si aún no existe el CSV, deja deshabilitado)
  await tryLoadDistritos();

  selNivel.addEventListener("change", async () => {
    const nivel = selNivel.value;
    if (nivel === "municipio"){
      selMunicipio.disabled = false;
      selDistrito.disabled = true;
    } else {
      selMunicipio.disabled = true;
      // si el CSV de distritos ya existe, se habilita
      const rowsD = await tryLoadDistritos();
      selDistrito.disabled = !rowsD;
    }
  });

  btnConsultar.addEventListener("click", () => {
    consultar().catch(err => {
      console.error(err);
      alert("No se pudo cargar el archivo de datos para esta consulta. Verifica que exista en /data.");
    });
  });

  // primera carga automática
  await consultar();
}

init().catch(err => {
  console.error(err);
  alert("No se pudo iniciar el módulo. Verifica que el CSV esté en /data y que el nombre coincida.");
});
