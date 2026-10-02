import assert from "node:assert/strict";
import { initializeAuxiliaryRoles } from "../src/modules/storage.js";
const roles = new Map([["new@example.test", {}], ["admin@example.test", { role: "admin" }], ["off@example.test", { role: "auxiliary", active: false }]]);
const writes = [];
const ref = path => ({ path, collection: name => ref(`${path}/${name}`), doc: name => ref(`${path}/${name}`) });
const db = { collection: name => ref(name), runTransaction: fn => fn({
  get: async target => ({ exists: true, data: () => roles.get(target.path.split("/").at(-1)) }),
  set: (target, value) => writes.push({ target, value }),
}) };
await initializeAuxiliaryRoles({ db, beneficiaryId: "test", emails: [...roles.keys(), "new@example.test"] });
assert.equal(writes.length, 1);
assert.equal(writes[0].value.role, "auxiliary");
assert.ok(writes[0].target.path.endsWith("members/new@example.test"));
console.log("Nouveau membre auxiliaire explicite, roles existants preserves : OK");
