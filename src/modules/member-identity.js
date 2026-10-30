export async function updateMemberIdentity({ db, user, beneficiaryId, oldEmail, email, name }) {
  const normalize = value => String(value || "").trim().toLowerCase();
  const previous = normalize(oldEmail);
  const next = normalize(email);
  const label = String(name || "").trim();
  if (!label || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(next)) throw new Error("Renseignez un nom et un email complet.");
  if (!db || !user?.uid || !beneficiaryId || !previous) throw new Error("Reliez d'abord cette fiche à un membre du bénéficiaire.");
  if (previous === normalize(user.email) && previous !== next) throw new Error("Vous ne pouvez pas changer l'adresse du compte connecté ici.");
  const members = db.collection("planning-avd-beneficiaries").doc(beneficiaryId).collection("members");
  const share = address => db.collection("planning-avd-shares").doc(address).collection("beneficiaries").doc(beneficiaryId);
  await db.runTransaction(async tx => {
    const old = await tx.get(members.doc(previous));
    const target = previous === next ? old : await tx.get(members.doc(next));
    if (!old.exists) throw new Error("Membre associé introuvable.");
    if (previous !== next && target.exists) throw new Error("Cet email appartient déjà à un membre. Utilisez Membre associé.");
    const data = old.data();
    const stamp = { updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: normalize(user.email) };
    tx.set(members.doc(next), { ...data, email: next, emailLower: next, name: label, ...stamp });
    tx.set(share(next), { beneficiaryId, email: next, emailOriginal: next, readEmails: [next], name: label, role: data.role || "auxiliary", active: data.active !== false, deleted: false, ...stamp }, { merge: true });
    if (previous !== next) {
      tx.delete(members.doc(previous));
      tx.set(share(previous), { active: false, deleted: true, ...stamp }, { merge: true });
    }
  });
  return { email: next, name: label };
}
