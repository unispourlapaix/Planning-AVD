import { buildSchedule, canWorkShift } from "../src/modules/scheduler-handover.js";

const team = [
  {
    id: "gui",
    name: "Guillaume",
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

const names = Object.fromEntries(team.map(aux => [aux.id, aux.name]));
const shifts = ["morning", "afternoon", "night"];
const monthLabel = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const workerName = id => names[id] || "A definir";

const isOpeningWeekendNight = ({ schedule, year, month, day, worker }) =>
  new Date(year, month, day).getDay() === 5
  && schedule[day + 1]?.morning?.worker === worker;

const isNightHandoverMorning = ({ schedule, day, shift, worker }) =>
  shift === "morning" && day > 1 && schedule[day - 1]?.night?.worker === worker;

const assertValidShift = ({ issues, schedule, year, month, day, shift }) => {
  const entry = schedule[day]?.[shift];
  if (!entry?.worker) {
    issues.push(`${monthLabel(year, month)} ${day} ${shift}: creneau vide`);
    return;
  }

  const workers = Array.isArray(entry.workers) ? entry.workers : [entry.worker];
  workers.filter(Boolean).forEach(worker => {
    const aux = team.find(item => item.id === worker);
    const allowed = canWorkShift(aux, shift, year, month, day)
      || isOpeningWeekendNight({ schedule, year, month, day, worker })
      || isNightHandoverMorning({ schedule, day, shift, worker });
    if (!allowed) {
      issues.push(`${monthLabel(year, month)} ${day} ${shift}: ${workerName(worker)} hors option`);
    }
  });
};

const assertWeekendBlock = ({ issues, schedule, year, month, day }) => {
  const saturday = schedule[day];
  const sunday = schedule[day + 1];
  if (!saturday || !sunday) return;

  if (day > 1 && schedule[day - 1]?.night?.worker !== saturday.morning?.worker) {
    issues.push(`${monthLabel(year, month)} ${day - 1}/${day}: vendredi soir different du samedi matin`);
  }

  shifts.forEach(shift => {
    if (saturday[shift]?.worker !== sunday[shift]?.worker) {
      issues.push(`${monthLabel(year, month)} ${day}/${day + 1}: week-end coupe sur ${shift}`);
    }
  });
};

const assertMondayRest = ({ issues, schedule, year, month, day }) => {
  const sunday = schedule[day];
  const monday = schedule[day + 1];
  if (!sunday || !monday) return;

  const weekendWorker = sunday.night?.worker || sunday.afternoon?.worker || sunday.morning?.worker;
  if (!weekendWorker) return;
  if (monday.afternoon?.worker === weekendWorker || monday.night?.worker === weekendWorker) {
    issues.push(`${monthLabel(year, month)} ${day + 1}: repos lundi PM/SR casse pour ${workerName(weekendWorker)}`);
  }
};

const canPickDifferentNightWorker = ({ year, month, day, dayWorker }) =>
  team.some(aux => aux.id !== dayWorker && canWorkShift(aux, "night", year, month, day));

const assertSplitDay = ({ issues, schedule, year, month, day }) => {
  const weekday = new Date(year, month, day).getDay();
  if (weekday === 0 || weekday === 6) return;
  const plan = schedule[day];
  const dayWorker = plan.morning?.worker;
  if (dayWorker && plan.afternoon?.worker && dayWorker !== plan.afternoon.worker) {
    issues.push(`${monthLabel(year, month)} ${day}: matin et apres-midi separes en mode journee + soir`);
  }
  if (dayWorker && plan.night?.worker === dayWorker && canPickDifferentNightWorker({ year, month, day, dayWorker })) {
    issues.push(`${monthLabel(year, month)} ${day}: soir garde par la personne de jour malgre une alternative`);
  }
};

const checkMonth = ({ year, month, rotationDays }) => {
  const { schedule } = buildSchedule({ year, month, auxiliaries: team, rotationDays });
  const issues = [];
  let previousWeekendOwner = "";
  let nightOnlyCount = 0;

  Object.keys(schedule).map(Number).forEach(day => {
    shifts.forEach(shift => {
      assertValidShift({ issues, schedule, year, month, day, shift });
    });

    const weekday = new Date(year, month, day).getDay();
    if (weekday === 6) {
      assertWeekendBlock({ issues, schedule, year, month, day });
      const owner = schedule[day].morning?.worker || schedule[day].afternoon?.worker || "";
      if (owner && owner === previousWeekendOwner) {
        issues.push(`${monthLabel(year, month)} ${day}: ${workerName(owner)} reprend deux week-ends de suite`);
      }
      previousWeekendOwner = owner;
    }
    if (weekday === 0) {
      assertMondayRest({ issues, schedule, year, month, day });
    }
    if (rotationDays === "split-day") {
      assertSplitDay({ issues, schedule, year, month, day });
    }

    const nightWorkers = Array.isArray(schedule[day].night?.workers)
      ? schedule[day].night.workers
      : [schedule[day].night?.worker];
    if (nightWorkers.includes("mar")) nightOnlyCount += 1;
  });

  if (!nightOnlyCount) {
    issues.push(`${monthLabel(year, month)}: Marie nuits seulement n'a aucune nuit`);
  }

  return issues.map(issue => `mode ${rotationDays} ${issue}`);
};

const periods = [
  { year: 2026, month: 5 },
  { year: 2026, month: 6 },
  { year: 2026, month: 7 },
];

const issues = periods.flatMap(period =>
  [1, "split-day", 2, 3, 4].flatMap(rotationDays => checkMonth({ ...period, rotationDays })),
);

if (issues.length) {
  console.error("Controle roulement KO");
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Controle roulement OK: ${periods.map(period => monthLabel(period.year, period.month)).join(", ")} / modes 1, journée + soir, 2, 3, 4`);
