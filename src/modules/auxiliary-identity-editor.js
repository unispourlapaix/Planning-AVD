import React from "react";
const h = React.createElement;
export function AuxiliaryIdentityEditor({ auxiliary, onSave }) {
  const [name, setName] = React.useState(auxiliary.name || "");
  const [email, setEmail] = React.useState(auxiliary.email || "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  return h("details", null, h("summary", { title: "Modifier le nom et l'email" }, "Modifier"),
    h("form", { onSubmit: async event => {
      event.preventDefault();
      if (busy) return;
      if (email.trim().toLowerCase() !== String(auxiliary.email || "").trim().toLowerCase() && !window.confirm("Changer l'email désactivera l'ancien accès à ce bénéficiaire. Continuer ?")) return;
      setBusy(true); setError("");
      try { await onSave({ email, name }); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
    } },
      h("label", { className: "field" }, "Nom complet", h("input", { required: true, value: name, disabled: busy, onChange: event => setName(event.target.value) })),
      h("label", { className: "field" }, "Email", h("input", { type: "email", required: true, value: email, disabled: busy, onChange: event => setEmail(event.target.value) })),
      h("button", { type: "submit", className: "btn", disabled: busy }, busy ? "Enregistrement…" : "Enregistrer"),
      error ? h("p", { role: "alert", className: "field-error" }, error) : null,
    ));
}
