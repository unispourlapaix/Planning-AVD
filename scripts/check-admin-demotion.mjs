import { resolveMemberRoleUpdate } from "../src/modules/storage.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const demoted = resolveMemberRoleUpdate({
  requestedRole: "auxiliary",
  existingAdminActive: true,
  existingBootstrapActiveForBeneficiary: true,
});

assert(demoted.role === "auxiliary", "Retirer admin doit redonner le role auxiliaire");
assert(demoted.keepBeneficiaryMemberActive === true, "L'auxiliaire doit rester actif dans le groupe");
assert(demoted.shouldWriteInactiveGlobalAdmin === true, "Le droit admin global doit etre desactive");
assert(demoted.shouldDeactivateBootstrapAdmin === true, "Le bootstrap admin du bénéficiaire doit etre desactive");

const promoted = resolveMemberRoleUpdate({ requestedRole: "admin" });
assert(promoted.role === "admin", "Promouvoir admin doit garder le role admin");
assert(promoted.shouldWriteActiveGlobalAdmin === true, "Le droit admin doit etre actif quand le role demande est admin");
assert(promoted.keepBeneficiaryMemberActive === true, "Un admin reste aussi membre actif du groupe");

console.log("Controle droits admin OK: retrait admin sans suppression auxiliaire");
