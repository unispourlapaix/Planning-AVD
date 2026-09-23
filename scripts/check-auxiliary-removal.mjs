import assert from "node:assert/strict";
import { listedAuxiliaries, retireAuxiliaries, retiredAuxiliaryEmails } from "../src/modules/auxiliary-membership.js";
import { ensureBeneficiaryGroup } from "../src/modules/storage.js";

const originals = [
  { id: "A", name: "Alice", email: "alice@example.test", active: true },
  { id: "B", name: "Benoit", email: "benoit@example.test", active: true },
  { id: "C", name: "Camille", email: "camille@example.test", active: true },
];
const removed = retireAuxiliaries(originals, ["A", "C"], "2026-09-23T10:00:00Z");
assert.deepEqual(listedAuxiliaries(removed).map(aux => aux.id), ["B"]);
assert.equal(removed.find(aux => aux.id === "A").name, "Alice", "Historical assignments keep their name");
assert.equal(originals[0].active, true, "Do not mutate the previous state");
assert.equal(removed[0].active, false);
assert.deepEqual(retiredAuxiliaryEmails([...removed, { id: "D", email: "ALICE@example.test" }]), ["camille@example.test"], "A retained duplicate email keeps its access");

globalThis.firebase = { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } };
const writes = [];
const makeRef = path => ({
  path,
  collection: name => makeRef(`${path}/${name}`),
  doc: id => makeRef(`${path}/${id}`),
  get: async () => ({ exists: true, data: () => ({ role: path.endsWith("camille@example.test") ? "admin" : "auxiliary" }) }),
});
const db = {
  collection: name => makeRef(name),
  batch: () => ({
    set: (ref, data) => writes.push({ type: "set", path: ref.path, data }),
    delete: ref => writes.push({ type: "delete", path: ref.path }),
    commit: async () => {},
  }),
};
const args = { db, user: { uid: "owner", email: "owner@example.test" }, state: { beneficiaryId: "group-A", beneficiaryName: "Test", auxiliaries: removed } };
await ensureBeneficiaryGroup(args);
await ensureBeneficiaryGroup(args);
assert.equal(writes.filter(item => item.type === "delete" && item.path.endsWith("alice@example.test")).length, 2);
assert.ok(!writes.some(item => item.type === "set" && item.path.endsWith("members/alice@example.test")), "Saving again must not recreate retired membership");
assert.ok(writes.some(item => item.path === "planning-avd-shares/alice@example.test/beneficiaries/group-A" && item.data.active === false));
assert.ok(!writes.some(item => item.path.includes("camille@example.test")), "Retiring an auxiliary must preserve their independent admin role");
assert.ok(writes.every(item => item.path.includes("group-A")), "Only this beneficiary group is changed");
console.log("Auxiliary removal OK: history, duplicate email, repeat sync, admin rights and group isolation.");
