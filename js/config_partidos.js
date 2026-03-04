// Catálogo base (colores fijos) + ruta de logo.
// Regla: actor_politico (CSV) debe coincidir con el nombre del PNG en assets/logos/.

const PARTIDOS_BASE = {
  PAN:    { nombre: "PAN",    color: "#0056A3" },
  PRI:    { nombre: "PRI",    color: "#006847" },
  PRD:    { nombre: "PRD",    color: "#FFD400" },
  PVEM:   { nombre: "PVEM",   color: "#3AAA35" },
  PT:     { nombre: "PT",     color: "#D50000" },
  MC:     { nombre: "MC",     color: "#F58220" },
  MORENA: { nombre: "MORENA", color: "#7A1F1F" },
  NAEM:   { nombre: "NAEM",   color: "#7E57C2" }
};

function actorToLogo(actor){
  return `assets/logos/${actor}.png`;
}

// Color neutro fijo para coaliciones (consistencia visual)
const COALICION_COLOR = "#64748b";

function getActorConfig(actor){
  const key = String(actor || "").trim();

  if (PARTIDOS_BASE[key]) {
    return { ...PARTIDOS_BASE[key], logo: actorToLogo(key) };
  }

  if (key.includes("_")) {
    return {
      nombre: key.replaceAll("_", "-"),
      color: COALICION_COLOR,
      logo: actorToLogo(key)
    };
  }

  return { nombre: key, color: "#94a3b8", logo: actorToLogo(key) };
}
