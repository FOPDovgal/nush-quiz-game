#!/usr/bin/env node
// Proves that a bank.src.js copy is exactly the bank encoded in a published index.html.
/* node tools/verify-bank.js <bank.src.js> <games/.../index.html>  — exit 0, якщо банк гри відповідає джерелу */
// build-bank.js shuffles options randomly, so a fresh build never gives the same string;
// instead: decode the published bank, check every question against the copy, then
// re-encode the copy with the published option order and compare the strings byte for byte.
// Usage: node verify-bank.js <bank.src.js> <published index.html>
"use strict";
const fs = require("fs"), path = require("path");
const KEY = Buffer.from("pole-dii-v1", "utf8");
const src = require(path.resolve(process.argv[2]));
const html = fs.readFileSync(process.argv[3], "utf8");
const enc = html.match(/\/\*@BANK_START\*\/"([^"]*)"\/\*@BANK_END\*\//)[1];
const xor = buf => Buffer.from(buf.map((x, i) => x ^ KEY[i % KEY.length] ^ ((i * 31) & 255)));
const pub = JSON.parse(xor(Buffer.from(enc, "base64")).toString("utf8"));
let errors = 0;
const fail = m => { errors++; if (errors <= 10) console.log("MISMATCH", m); };
if (pub.length !== src.length) fail(`count ${src.length} vs ${pub.length}`);
const rebuilt = src.map((q, n) => {
  const p = pub[n];
  if (!p || p.id !== q.id) { fail(`#${n} id ${q.id} vs ${p && p.id}`); return q; }
  const strip = o => { const c = Object.assign({}, o); delete c.opts; delete c.c; return JSON.stringify(c); };
  if (strip(q) !== strip(p)) fail(`${q.id}: fields differ`);
  if (q.type !== "choice") { if (JSON.stringify(q) !== JSON.stringify(p)) fail(`${q.id}: differs`); return q; }
  if (JSON.stringify([...q.opts].sort()) !== JSON.stringify([...p.opts].sort())) fail(`${q.id}: options differ`);
  if (p.opts[p.c] !== q.opts[0]) fail(`${q.id}: correct answer differs`);
  return Object.assign({}, q, { opts: p.opts, c: p.c });
});
const reenc = xor(Buffer.from(JSON.stringify(rebuilt), "utf8")).toString("base64");
const byteEqual = reenc === enc;
console.log(JSON.stringify({ questions: src.length, published: pub.length, mismatches: errors, reencodedEqualsPublished: byteEqual, encLength: enc.length }));
process.exit(errors || !byteEqual ? 1 : 0);
