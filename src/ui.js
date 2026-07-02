import React from "react";

export const h = React.createElement;

export function Button({ active = false, className = "", children, ...props }) {
  return h("button", { className: `btn ${active ? "active" : ""} ${className}`.trim(), ...props }, children);
}

export function Field({ label, children }) {
  return h("label", { className: "field" }, h("span", null, label), children);
}

export function TextInput({ value, onChange, ...props }) {
  return h("input", { value: value ?? "", onChange: event => onChange(event.target.value), ...props });
}

export function Select({ value, onChange, children, ...props }) {
  return h("select", { value, onChange: event => onChange(event.target.value), ...props }, children);
}

export function Checkbox({ checked, onChange, label, ...props }) {
  return h("label", { className: "check-row" },
    h("input", { type: "checkbox", checked: !!checked, onChange: event => onChange(event.target.checked), ...props }),
    h("span", null, label),
  );
}
