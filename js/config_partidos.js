// Catálogo base (colores fijos) + ruta de logo.
// Regla: actor_politico (CSV) debe coincidir con el nombre del PNG.
const PARTIDOS_BASE = {
  PAN:    { nombre: "PAN",    color: "#0056A3" },
  PRI:    { nombre: "PRI",    color: "#006847" },
  PRD:    { nombre: "PRD",    color: "#FFD400" },
  PVEM:   { nombre: "PVEM",   color: "#3AAA35" },
  PT:     { nombre: "PT",     color: "#D50000" },
  MC:     { nombre: "MC",     color: "#F58220" },
  MORENA: { nombre: "MORENA", color: "#7A1F1F" },
  NAEM:   { nombre: "NAEM",   color: "#7E57C2" } // ajuste si quieres otro tono oficial
};

// Si la coalición tiene logo propio (y tú lo subiste), se usará por nombre exacto.
// Si mañana aparece otra combinación, el sistema no se rompe (usa placeholder y color neutro).
const LOGO_PLACEHOLDER = "assets/logos/GEN.png"; // opcional: si no existe, se ocultará la imagen

function actorToLogo(actor){
  return `assets/logos/${actor}.png`;
}

// Color para coaliciones: neutro fijo (consistencia visual)
// Si prefieres un color por coalición, lo agregamos como override.
const COALICION_COLOR = "#64748b";

function getActorConfig(actor){
  if (PARTIDOS_BASE[actor]) {
    return { ...PARTIDOS_BASE[actor], logo: actorToLogo(actor) };
  }
  if (actor.includes("_")) {
    return {
      nombre: actor.replaceAll("_", "-"),
      color: COALICION_COLOR,
      logo: actorToLogo(actor)
    };
  }
  return { nombre: actor, color: "#94a3b8", logo: LOGO_PLACEHOLDER };
}
