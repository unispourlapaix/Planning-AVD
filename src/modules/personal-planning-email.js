import { DAYS_LONG, MONTHS, SHIFT_DEFS } from "./constants.js";
import { dayName, daysInMonth, monthWeeks } from "./dates.js";
import { manualWorkerIds } from "./manual-workers.js";
import { slotHours, slotWorkerHours } from "./shift-hours.js";

export const escapeEmailHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const number = value => Number(value.toFixed(2)).toLocaleString("fr-FR");
const clock = minutes => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}${minutes >= 1440 ? ` (+${Math.floor(minutes / 1440)} j)` : ""}`;

export function buildPersonalPlanningEmail({ year, month, auxiliary, auxiliaries = [], schedule = {}, beneficiaryName = "", appUrl = "", startTime = "07:30" }) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new Error("Heure de début invalide.");
  const [hour, minute] = startTime.split(":").map(Number);
  const rows = [];
  const calendar = {};
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const plan = schedule[day] || {};
    let start = hour * 60 + minute;
    calendar[day] = SHIFT_DEFS.map(shift => {
      const entry = plan[shift.id];
      const workers = manualWorkerIds(entry?.workers || entry?.worker || []);
      const own = workers.includes(auxiliary.id);
      const hours = own ? slotWorkerHours(entry, shift.id, auxiliary.id) : slotHours(entry, shift.id);
      const range = `${clock(start)}–${clock(start + Math.round(hours * 60))}`;
      const row = { day, label: shift.label, own, hours, range,
        name: own ? auxiliary.name : auxiliaries.find(aux => aux.id === workers[0])?.name || (workers.length ? "Autre intervenant" : "Non attribué") };
      if (own) rows.push(row);
      start += Math.round(slotHours(entry, shift.id) * 60);
      return row;
    });
  }
  const total = Math.round(rows.reduce((sum, row) => sum + row.hours, 0) * 100) / 100;
  const quota = Number.isFinite(Number(auxiliary.quota)) ? Math.max(0, Number(auxiliary.quota)) : 0;
  const difference = Math.round((total - quota) * 100) / 100;
  const balance = difference > 0 ? `Dépassement : ${number(difference)} h` : difference < 0 ? `Reste à attribuer : ${number(-difference)} h` : "Quota atteint";
  const summary = `Total planifié : ${number(total)} h · Quota : ${number(quota)} h · ${balance}`;
  const date = day => `${dayName(year, month, day)} ${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
  const subject = `Planning de ${auxiliary.name} · ${MONTHS[month]} ${year}`;
  const timingNote = `Horaires calculés à partir de ${startTime}, selon les durées des créneaux. Heures planifiées, non réalisées. Pauses non déduites automatiquement.`;
  const text = [`Bonjour ${auxiliary.name},`, "", subject, beneficiaryName ? `Bénéficiaire : ${beneficiaryName}` : "", timingNote, "",
    ...rows.map(row => `${date(row.day)} · ${row.label} · ${row.range} · ${number(row.hours)} h`),
    ...(!rows.length ? ["Aucun créneau attribué ce mois-ci."] : []), "", summary, "", `Planning actualisé après connexion : ${appUrl}`].filter(line => line !== undefined).join("\n");
  const esc = escapeEmailHtml;
  const cellStyle = "border:1px solid #dce2e6;padding:6px;vertical-align:top;width:14.28%;font-size:11px;";
  const calendarHtml = `<table role="table" aria-label="Calendrier du mois" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;table-layout:fixed"><thead><tr>${DAYS_LONG.map(day => `<th style="${cellStyle}background:#f3f5f6">${day}</th>`).join("")}</tr></thead><tbody>${monthWeeks(year, month).map(week => `<tr>${week.map(day => `<td style="${cellStyle}">${day ? `<strong>${day}</strong>${calendar[day].map(row => `<div style="margin-top:5px;padding:5px;background:${row.own ? "#e0f1ff" : "#f1f2f3"};color:${row.own ? "#185981" : "#69727a"};border-left:3px solid ${row.own ? "#488cb5" : "#cdd2d6"};overflow-wrap:anywhere"><small>${esc(row.label)}${row.own ? " · Vous" : ""}</small><br><strong>${esc(row.name)}</strong>${row.own ? `<br>${esc(row.range)}<br>${number(row.hours)} h` : ""}</div>`).join("")}` : ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const detailHtml = `<table cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;text-align:left"><thead><tr><th>Date</th><th>Créneau</th><th>Horaire</th><th>Durée</th></tr></thead><tbody>${rows.map(row => `<tr><td style="border-top:1px solid #ddd">${esc(date(row.day))}</td><td>${esc(row.label)}</td><td>${esc(row.range)}</td><td>${number(row.hours)} h</td></tr>`).join("")}</tbody></table>`;
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;color:#273842;background:#fff;margin:16px"><h2>${esc(subject)}</h2><p>${esc(beneficiaryName)}</p><p>Bleu : vos créneaux. Gris : les autres intervenants.</p>${calendarHtml}<h3>Vos horaires du mois</h3><p style="font-size:12px;color:#576670">${esc(timingNote)}</p>${rows.length ? detailHtml : "<p>Aucun créneau attribué.</p>"}<p><strong>${esc(summary)}</strong></p><p>Planning actualisé après connexion : ${esc(appUrl)}</p></body></html>`;
  return { subject, text, html, rows, total, quota, difference, summary };
}

const base64 = text => btoa(Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join(""));
export function buildPlanningEml({ email, subject, text, html }) {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error("Email invalide.");
  const boundary = "planning-avd-alternative";
  const encoded = value => base64(value).match(/.{1,76}/g)?.join("\r\n") || "";
  const chars = Array.from(subject);
  const encodedSubject = Array.from({ length: Math.ceil(chars.length / 10) }, (_, index) => `=?UTF-8?B?${base64(chars.slice(index * 10, index * 10 + 10).join(""))}?=`).join("\r\n ");
  return [`To: ${email}`, `Subject: ${encodedSubject}`, "X-Unsent: 1", "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`, "", `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encoded(text), `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encoded(html), `--${boundary}--`, ""].join("\r\n");
}
