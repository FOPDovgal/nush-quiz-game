#!/usr/bin/env node
/* Кодує банк завдань гри: bank.src.js → BANK_ENC в index.html.
   Використання: node tools/build-bank.js <папка гри у games/>
   Варіанти відповідей перемішуються, правильний індекс зберігається як поле c.
   Це легка обфускація (XOR + base64), а НЕ захист відповідей. */
"use strict";
const fs = require("fs"), path = require("path");
const KEY = "pole-dii-v1"; // має збігатися з decodeBank() в index.html
const dir = path.resolve(__dirname, "..", "games", process.argv[2] || "");
const src = require(path.join(dir, "bank.src.js"));
const bank = src.map(q => {
  if (q.type !== "choice") return q;
  const order = q.opts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return Object.assign({}, q, { opts: order.map(i => q.opts[i]), c: order.indexOf(0) });
});
const k = Buffer.from(KEY, "utf8");
const raw = Buffer.from(JSON.stringify(bank), "utf8");
const enc = Buffer.from(raw.map((x, i) => x ^ k[i % k.length] ^ ((i * 31) & 255))).toString("base64");
const file = path.join(dir, "index.html");
let html = fs.readFileSync(file, "utf8");
const re = /\/\*@BANK_START\*\/[\s\S]*?\/\*@BANK_END\*\//;
if (!re.test(html)) throw new Error("markers not found in " + file);
html = html.replace(re, () => `/*@BANK_START*/"${enc}"/*@BANK_END*/`);
fs.writeFileSync(file, html);
console.log(`encoded ${bank.length} questions → ${file} (${enc.length} chars)`);
