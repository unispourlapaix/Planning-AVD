export const MONTHS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

export const DAYS_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

export const SHIFT_DEFS = [
  { id: "morning", label: "Matin", hours: 6 },
  { id: "afternoon", label: "Apres-midi", hours: 6 },
  { id: "night", label: "Nuit", hours: 12 },
];

export const SHIFT_LABEL = Object.fromEntries(SHIFT_DEFS.map(shift => [shift.id, shift.label]));
export const DEFAULT_QUOTA = 151;
export const MAX_AUXILIARIES = 100;

export const PALETTE = [
  { solid: "#7BAFD4", light: "#E6F3FF", text: "#1E5A8A" },
  { solid: "#68C49A", light: "#E4F8F0", text: "#1A6A44" },
  { solid: "#E08A8A", light: "#FFF0F0", text: "#A02828" },
  { solid: "#9E8ED8", light: "#F0ECFF", text: "#3E2A9E" },
  { solid: "#F0B66E", light: "#FFF4E6", text: "#8A5515" },
  { solid: "#78C8C0", light: "#E7FAF8", text: "#17645E" },
  { solid: "#E89BC2", light: "#FFF0F7", text: "#8E2D62" },
  { solid: "#A7B879", light: "#F3F7E8", text: "#4F5D22" },
];

export const DEFAULT_AUXILIARIES = Array.from({ length: 4 }, (_, i) => ({
  id: `P${i + 1}`,
  name: `Auxiliaire ${i + 1}`,
  email: "",
  phone: "",
  address: "",
  active: true,
  status: "available",
  quota: i === 3 ? 72 : DEFAULT_QUOTA,
  lead: i === 0,
  night: i !== 2,
  days: "all",
  customDays: [0, 1, 2, 3, 4, 5, 6],
  shift: "all",
}));
