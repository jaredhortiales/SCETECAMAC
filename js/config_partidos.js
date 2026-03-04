const LOGO_BASE = "assets/logos/";

const PARTY_COLORS = {
  PAN: "#0057B7",
  PRI: "#006341",
  PRD: "#FFD100",
  PVEM: "#00A651",
  PT: "#D81E05",
  MC: "#F36F21",
  MORENA: "#7A0019",
  NAEM: "#1F7A3A" // define un verde institucional para NAEM
};

function getActorConfig(actor){
  const key = String(actor || "").trim().toUpperCase();

  // Si existe color específico, lo usamos; si no, un verde neutro
  const color = PARTY_COLORS[key] || "#16a34a";

  // Logo: si el archivo existe con el mismo nombre, se carga; si falla, se oculta por onerror
  const logo = `${LOGO_BASE}${key}.png`;

  return { color, logo };
}
