import { DAYS_LONG } from "./constants.js?v=20260722-shift-7-5";

export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
export const dayIndex = (year, month, day) => (new Date(year, month, day).getDay() + 6) % 7;
export const isWeekendIndex = index => index === 5 || index === 6;
export const isWeekendDay = (year, month, day) => isWeekendIndex(dayIndex(year, month, day));
export const dayName = (year, month, day) => DAYS_LONG[dayIndex(year, month, day)];

export function monthGrid(year, month) {
  const total = daysInMonth(year, month);
  const start = dayIndex(year, month, 1);
  const cells = Array.from({ length: start }, () => null);
  for (let day = 1; day <= total; day += 1) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function weekStarts(year, month) {
  const total = daysInMonth(year, month);
  const starts = [];
  for (let day = 1; day <= total; day += 1) {
    if (day === 1 || dayIndex(year, month, day) === 0) starts.push(day);
  }
  return starts;
}
