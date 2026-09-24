// Suggestions only: a real break requires an available replacement.
export function planningBreakNote(hours, shift) {
  if (!(Number(hours) > 0)) return "";
  const notes = [];
  if (shift === "morning") notes.push("Repas du midi : prévoir 30 min avec un relais, à un horaire adapté pendant le service.");
  if (Number(hours) >= 6) notes.push("Pause continue à organiser avant 6 h de travail : prévoir au moins 20 min ; le repas peut inclure cette pause.");
  if (!notes.length) return "";
  notes.push("À confirmer par l’administrateur selon le contrat et le régime applicable. Aucune pause considérée comme prise, ni déduite automatiquement des heures. Si l’auxiliaire reste disponible pour intervenir, ne pas considérer ce temps comme une pause libre.");
  return notes.join(" ");
}
