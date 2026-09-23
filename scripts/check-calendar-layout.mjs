import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { MonthView } from "../src/App.js";
import { daysInMonth, monthWeeks, dayIndex } from "../src/modules/dates.js";
import { buildEmptySchedule } from "../src/modules/manual-schedule.js";

for (const year of [2026, 2028]) for (let month = 0; month < 12; month++) {
  const weeks = monthWeeks(year, month);
  assert.deepEqual(weeks.flat().filter(Boolean), Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1));
  weeks.forEach(week => week.forEach((day, column) => { if (day) assert.equal(dayIndex(year, month, day), column); }));
}
const year = 2026;
const month = 8;
const auxiliaries = [{ id: "A", name: "Alexandra" }, { id: "B", name: "Jean-Christophe" }];
const schedule = buildEmptySchedule({ year, month });
Object.values(schedule).forEach(plan => {
  for (const shift of ["morning", "afternoon", "night"]) {
    if (plan.day % 5 === 0) continue;
    const worker = plan.day % 2 ? "A" : "B";
    plan[shift] = { ...plan[shift], worker, workers: [worker], hours: shift === "night" ? 2 : plan[shift].hours };
  }
});
const markup = renderToStaticMarkup(React.createElement(MonthView, { year, month, schedule, auxiliaries, overrides: {}, onEditSlot() {}, onOpenMeal() {} }));
assert.equal((markup.match(/<article /g) || []).length, 30);
assert.ok(markup.includes("Jean-Christophe") && markup.includes("Non attribué") && markup.includes("2 h"));
assert.ok(!markup.includes("manual-badge"));
console.log("Calendar OK: aligned Monday-Sunday weeks, no duplicate dates, leap years, full names and durations.");

if (process.argv.includes("--serve")) {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8") + readFileSync(new URL("../src/calendar.css", import.meta.url), "utf8");
  createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.url === "/mobile") return res.end('<iframe title="Mobile 390px" src="/" style="width:390px;height:850px;border:1px solid #ccc"></iframe>');
    res.end(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main class="app"><h2>Septembre 2026</h2>${markup}</main></html>`);
  }).listen(5179, "127.0.0.1", () => console.log("Calendar preview http://127.0.0.1:5179"));
}
