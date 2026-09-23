export const listedAuxiliaries = (auxiliaries = []) => auxiliaries.filter(aux => !aux.removedFromGroup);

// Keep stable IDs and names so historical assignments remain readable.
export function retireAuxiliaries(auxiliaries, ids, removedAt = new Date().toISOString()) {
  const selected = new Set(ids);
  return auxiliaries.map(aux => selected.has(aux.id)
    ? { ...aux, active: false, removedFromGroup: true, removedAt }
    : aux);
}

export function retiredAuxiliaryEmails(auxiliaries = []) {
  const emailOf = aux => String(aux.email || "").trim().toLowerCase();
  const retained = new Set(listedAuxiliaries(auxiliaries).map(emailOf));
  return [...new Set(auxiliaries.filter(aux => aux.removedFromGroup).map(emailOf))]
    .filter(email => email && !retained.has(email));
}
