import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { retireInstalledApp } from "../src/modules/web-only.js";

const scope = "https://unispourlapaix.github.io/Planning-AVD/";
const otherScope = "https://unispourlapaix.github.io/Another-App/";
const appCache = `workbox-precache-v2-${scope}`;
const otherCache = `workbox-precache-v2-${otherScope}`;
const removed = [];
const touched = [];
const storage = { keys: async () => ["planning-avd-static", appCache, otherCache, "another-cache"], delete: async key => removed.push(key) };
globalThis.location = { origin: "https://unispourlapaix.github.io" };
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: {
  getRegistrations: async () => [scope, otherScope, "https://unispourlapaix.github.io/"].map(url => ({
    scope: url,
    update: async () => touched.push(`update:${url}`),
    unregister: async () => touched.push(`unregister:${url}`),
  })),
} } });
globalThis.caches = storage;
Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("Local backups must not be touched"); } });
Object.defineProperty(globalThis, "indexedDB", { configurable: true, get: () => { throw new Error("Firestore persistence must not be touched"); } });
await retireInstalledApp();
assert.deepEqual(touched, [`update:${scope}`, `unregister:${scope}`]);
assert.deepEqual(removed, ["planning-avd-static", appCache]);

const handlers = {};
const workerActions = [];
const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
vm.runInNewContext(worker, { caches: storage, self: {
  addEventListener: (name, handler) => { handlers[name] = handler; },
  skipWaiting: async () => workerActions.push("skip"),
  clients: { claim: async () => workerActions.push("claim") },
  registration: { scope, unregister: async () => workerActions.push("unregister") },
} });
assert.equal(handlers.fetch, undefined, "No network interception");
let completion;
handlers.install({ waitUntil: promise => { completion = promise; } });
await completion;
handlers.activate({ waitUntil: promise => { completion = promise; } });
await completion;
assert.deepEqual(workerActions, ["skip", "claim", "unregister"]);
assert.ok(!removed.includes(otherCache));
assert.equal(worker, readFileSync(new URL("../sw.js", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
assert.ok(!Object.keys(lock.packages).some(key => key.startsWith("../") || key.includes("vite-plugin-pwa")));
assert.ok(!Object.values(lock.packages).some(value => value.link));
console.log("Web-only OK: scoped worker/cache retirement, no fetch interception, backups preserved, portable lockfile.");
