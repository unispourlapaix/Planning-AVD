import React from "react";
import { previousDayTemplate } from "./previous-day-template.js";
const h = React.createElement;
export function DayTemplatePicker({ auxiliaries, onApply, defaultOpen = false, year, month, day, overrides, hourOverrides }) {
  const [template] = React.useState(() => previousDayTemplate({ year, month, day, overrides, hourOverrides }));
  const [slots, setSlots] = React.useState(template.slots);
  const available = auxiliaries.filter(aux => aux.active !== false && !aux.removedFromGroup);
  const invalid = slots.some(slot => slot.workers.some(worker => worker.id && !available.some(aux => aux.id === worker.id)) || new Set(slot.workers.filter(worker => worker.id).map(worker => worker.id)).size !== slot.workers.filter(worker => worker.id).length);
  return h("details", { className: "slot-editor-section", open: defaultOpen || undefined },
    h("summary", null, "Remplir la journée · mois précédent"),
    h("p", null, template.found ? `Modèle du ${template.sourceDay}/${template.sourceMonth + 1}/${template.sourceYear} · même jour de semaine` : "Aucune affectation sur la journée correspondante du mois précédent."),
    template.found ? h("div", { className: "day-template-fields" }, slots.map((slot, slotIndex) => h("div", { key: slot.id },
      h("b", null, slot.label),
      (slot.workers.length ? slot.workers : [{ id: "", hours: slot.hours }]).map((worker, index) => h("label", { key: index }, `${index ? "Renfort" : "Titulaire"} · ${worker.hours} h`,
        h("select", { value: worker.id, onChange: event => {
          const id = event.target.value;
          setSlots(current => current.map((item, i) => i !== slotIndex ? item : { ...item, workers: (item.workers.length ? item.workers : [worker]).map((entry, n) => n === index ? { ...entry, id } : entry) }));
        } }, h("option", { value: "" }, "Non attribué"),
        worker.id && !available.some(aux => aux.id === worker.id) ? h("option", { value: worker.id, disabled: true }, `${auxiliaries.find(aux => aux.id === worker.id)?.name || worker.id} · à remplacer`) : null,
        available.map(aux => h("option", { key: aux.id, value: aux.id }, aux.name)))))
    ))) : null,
    invalid ? h("p", { role: "status" }, "Remplacez les intervenants retirés et évitez les doublons sur un même créneau.") : null,
    h("button", { type: "button", disabled: !template.found || invalid, onClick: () => onApply(slots) }, "Appliquer à cette journée"));
}
