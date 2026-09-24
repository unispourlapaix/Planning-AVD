import React from "react";
import { DAY_TEMPLATE } from "./day-template.js";
const h = React.createElement;

export function DayTemplatePicker({ auxiliaries, onApply }) {
  const [workers, setWorkers] = React.useState({ morning: "", afternoon: "", bedtime: "" });
  const available = auxiliaries.filter(aux => aux.active !== false && !aux.removedFromGroup);
  const complete = DAY_TEMPLATE.every(slot => available.some(aux => aux.id === workers[slot.id]));
  return h("details", { className: "slot-editor-section" },
    h("summary", null, "Remplir la journée · 12 h (5 + 5 + 2)"),
    h("div", { className: "day-template-fields" }, DAY_TEMPLATE.map(slot => h("label", { key: slot.id },
      `${slot.label} · ${slot.hours} h`,
      h("select", { value: workers[slot.id], onChange: event => setWorkers(previous => ({ ...previous, [slot.id]: event.target.value })) },
        h("option", { value: "" }, "Choisir un auxiliaire"),
        available.map(aux => h("option", { key: aux.id, value: aux.id }, aux.name)),
      ),
    ))),
    h("button", { type: "button", disabled: !complete, onClick: () => onApply(workers) }, "Appliquer à cette journée"),
  );
}
