import { publishPersonalPlannings } from "./storage.js?v=20260722-custom-hours";
import { openPlanningEmailDialog } from "./planning-email-dialog.js";

export async function sharePlanningByEmail(options) {
  if (!options.user?.uid) throw new Error("Connexion admin nécessaire.");
  const valid = options.auxiliaries.filter(aux => aux.active !== false && !aux.removedFromGroup && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(aux.email || "").trim()));
  if (!valid.length) throw new Error("Aucun email auxiliaire valide. Renseignez les adresses dans Réglages.");
  const count = await publishPersonalPlannings(options);
  openPlanningEmailDialog({ ...options, appUrl: `${window.location.origin}${window.location.pathname}` });
  return count;
}
