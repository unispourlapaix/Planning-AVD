import { daysInMonth } from "../src/modules/dates.js";
import { buildSchedule } from "../src/modules/scheduler-handover.js";
import { buildPersonalSharePayloads } from "../src/modules/storage.js";

const shifts = ["morning", "afternoon", "night"];
const team = [
  {
    id: "gui",
    name: "Guillaume",
    email: "guillaume@example.com",
    active: true,
    status: "available",
    lead: true,
    coverage: false,
    night: true,
    days: "all",
    shift: "all",
    quota: 151,
  },
  {
    id: "rom",
    name: "Romain",
    email: "romain@example.com",
    active: true,
    status: "available",
    lead: false,
    coverage: true,
    night: true,
    days: "all",
    shift: "all",
    quota: 151,
  },
  {
    id: "sar",
    name: "Sarah",
    email: "sarah@example.com",
    active: true,
    status: "available",
    lead: false,
    coverage: true,
    night: true,
    days: "weekend",
    shift: "all",
    quota: 72,
  },
  {
    id: "mar",
    name: "Marie",
    email: "marie@example.com",
    active: true,
    status: "available",
    lead: false,
    coverage: false,
    night: true,
    days: "all",
    shift: "night",
    quota: 72,
  },
];

const primaryWorkerId = entry =>
  Array.isArray(entry?.workers) ? entry.workers.filter(Boolean)[0] || "" : (entry?.worker || "");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const checkPayload = ({ payload, aux, schedule, year, month }) => {
  assert(!("hours" in payload), `${aux.name}: les heures ne doivent pas etre envoyees a la vue auxiliaire`);
  assert(payload.team.every(member => !member.email), `${aux.name}: les emails de l'equipe ne doivent pas etre exposes`);
  assert(payload.beneficiaryName === "Payet Emmanuel", `${aux.name}: bénéficiaire absent du planning personnel`);
  assert(payload.calendar.length === daysInMonth(year, month), `${aux.name}: calendrier mensuel incomplet`);
  payload.calendar.forEach(day => {
    shifts.forEach(shift => {
      const names = day.shifts?.[shift] || [];
      assert(Array.isArray(names), `${aux.name}: ${day.day} ${shift} doit rester une liste`);
      assert(names.length <= 1, `${aux.name}: doublon expose le ${day.day} ${shift}`);
    });
  });

  const expectedEntries = [];
  Object.values(schedule).forEach(plan => {
    shifts.forEach(shift => {
      if (primaryWorkerId(plan[shift]) === aux.id) expectedEntries.push(`${plan.day}-${shift}`);
    });
  });
  const actualEntries = payload.entries.map(entry => `${entry.day}-${entry.shift}`);
  assert(
    expectedEntries.join("|") === actualEntries.join("|"),
    `${aux.name}: planning personnel different des titulaires principaux`,
  );
};

const year = 2026;
const month = 5;
const issues = [];

[1, 2, 3, 4].forEach(rotationDays => {
  const { schedule } = buildSchedule({ year, month, auxiliaries: team, rotationDays });
  const payloads = buildPersonalSharePayloads({
    year,
    month,
    auxiliaries: team,
    beneficiaryName: "Payet Emmanuel",
    schedule,
    dayOutings: {
      "2026-5-3": [{ id: "outing-1", title: "Sortie test" }],
      "2026-6-1": [{ id: "other-month", title: "Autre mois" }],
    },
    publishedBy: "admin@example.com",
  });

  try {
    assert(payloads.length === team.length, `mode ${rotationDays}: tous les auxiliaires actifs doivent recevoir une sauvegarde`);
    payloads.forEach(({ aux, sharePayload }) => {
      checkPayload({ payload: sharePayload, aux, schedule, year, month });
      assert(sharePayload.dayOutings["2026-5-3"], `${aux.name}: sortie du mois absente`);
      assert(!sharePayload.dayOutings["2026-6-1"], `${aux.name}: sortie hors mois exposee`);
    });
  } catch (error) {
    issues.push(`mode ${rotationDays}: ${error.message}`);
  }
});

if (issues.length) {
  console.error("Controle vue auxiliaire KO");
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exit(1);
}

console.log("Controle vue auxiliaire OK: planning complet, sans emails equipe, sans heures, sans doublons");
