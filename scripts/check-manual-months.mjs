import { buildEmptySchedule } from "../src/modules/manual-schedule.js";
import { buildRotationAudit } from "../src/modules/rotation-audit.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const dayCount = schedule => Object.keys(schedule).length;

const july = buildEmptySchedule({ year: 2026, month: 6 });
assert(dayCount(july) === 31, "Juillet doit prevoir 31 jours");
assert(july[31]?.day === 31, "Le jour 31 doit exister");

const february = buildEmptySchedule({ year: 2026, month: 1 });
assert(dayCount(february) === 28, "Fevrier 2026 doit prevoir 28 jours");
assert(!february[29], "Fevrier 2026 ne doit pas creer de 29");

const leapFebruary = buildEmptySchedule({ year: 2028, month: 1 });
assert(dayCount(leapFebruary) === 29, "Fevrier bissextile doit prevoir 29 jours");
assert(leapFebruary[29]?.day === 29, "Le 29 fevrier bissextile doit exister");

const checks = buildRotationAudit({
  year: 2026,
  month: 1,
  auxiliaries: [{ id: "A", name: "Auxiliaire", active: true, shift: "all", customDays: [0, 1, 2, 3, 4, 5, 6] }],
  schedule: february,
  rotationDays: 1,
});
assert(checks.some(item => item.title === "Journees sans auxiliaire" && item.detail.includes("28/28")), "Les jours sans auxiliaire doivent etre detectes sur tout fevrier");
assert(!checks.some(item => item.title === "Creneaux a definir"), "Un mois totalement vide ne doit pas noyer l'admin avec tous les creneaux");

console.log("Controle mois manuel OK: 31 jours, fevrier 28/29 et jours sans auxiliaire");
