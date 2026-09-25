import assert from "node:assert/strict";
import { gmailComposeUrl } from "../src/modules/gmail-compose.js";
const url = new URL(gmailComposeUrl(" test+planning@example.com ", "Planning été & septembre"));
assert.equal(url.searchParams.get("to"), "test+planning@example.com");
assert.equal(url.searchParams.get("su"), "Planning été & septembre");
assert.equal(url.searchParams.has("body"), false);
assert.ok(gmailComposeUrl("test@example.com", "é".repeat(20000)).length < 2000);
assert.throws(() => gmailComposeUrl("test@example.com\nBcc:other@example.com", "Test"));
console.log("Liens Gmail courts : OK");
