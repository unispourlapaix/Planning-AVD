export const listedAuxiliaries = (auxiliaries = []) => auxiliaries.filter(aux => !aux.removedFromGroup);

const memberEmail = value => String(value?.email || value?.emailLower || "").trim().toLowerCase();
export function availableAuxiliaryMembers(members, auxiliaries, exceptId) {
  const used = new Set(listedAuxiliaries(auxiliaries).filter(aux => aux.id !== exceptId).map(memberEmail));
  const seen = new Set();
  return members.filter(member => {
    const email = memberEmail(member);
    if (!email || member.active === false || member.role === "viewer" || used.has(email) || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

export function assignExistingMember(auxiliaries, member, defaults) {
  const email = memberEmail(member);
  if (!availableAuxiliaryMembers([member], auxiliaries).length) return auxiliaries;
  const archived = auxiliaries.find(aux => aux.removedFromGroup && memberEmail(aux) === email);
  if (archived) return auxiliaries.map(aux => aux === archived ? { ...aux, name: member.name || email, email, active: true, removedFromGroup: false } : aux);
  return [...auxiliaries, { ...defaults, id: `aux-${globalThis.crypto.randomUUID()}`, name: member.name || email, email, active: true }];
}

export function syncAuxiliaryMember(auxiliaries, { email, name, active }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return auxiliaries;
  return auxiliaries.map(aux => {
    if (aux.removedFromGroup || String(aux.email || "").trim().toLowerCase() !== normalized) return aux;
    return { ...aux,
      ...(typeof active === "boolean" ? { active } : {}),
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
    };
  });
}

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
