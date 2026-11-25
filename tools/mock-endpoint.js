#!/usr/bin/env node
/* Локальна імітація веб-застосунку Apps Script для перевірки гри без Google.
   Виконує справжній apps-script/Code.gs із заглушками; як і Google, відповідає на POST редиректом 302 на GET з JSON.
   node tools/mock-endpoint.js [порт]   → POST http://localhost:<порт>/exec ; рядки друкуються в консоль (лише для тестів) */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const port = +process.argv[2] || 8766;
const rows = [];
const cacheMap = {};
const sheet = { getLastRow: () => rows.length, appendRow: r => rows.push(r), setFrozenRows() {}, getRange: () => ({ setFontWeight() {}, getValue: () => rows[0] && rows[0][0] }) };
const g = {
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: k => cacheMap[k], put: (k, v) => { cacheMap[k] = v; } }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet, getUrl: () => "mock://sheet" }) },
  MailApp: { sendEmail: (to, s) => console.log("MAIL to", to, "|", s), getRemainingDailyQuota: () => 100 },
  Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }) },
  ContentService: { createTextOutput: t => ({ setMimeType: () => t }), MimeType: { JSON: "json" } }
};
vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8"), g);
const results = {};
http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*" };
  if (req.method === "POST" && req.url.startsWith("/exec")) {
    let body = ""; req.on("data", c => body += c); req.on("end", () => {
      const out = g.doPost({ postData: { contents: body } });
      const id = Math.random().toString(36).slice(2); results[id] = out;
      console.log("POST", req.headers["content-type"], "→", out, "| rows:", rows.length - 1);
      if (rows.length > 1) console.log("ROW", JSON.stringify(rows[rows.length - 1]));
      res.writeHead(302, Object.assign({ Location: `/echo?id=${id}` }, cors)); res.end();
    });
  } else if (req.url.startsWith("/echo")) {
    const id = new URL(req.url, "http://x").searchParams.get("id");
    res.writeHead(200, Object.assign({ "Content-Type": "application/json" }, cors)); res.end(results[id] || '{"ok":false}');
  } else if (req.method === "OPTIONS") {
    console.log("PREFLIGHT (не має бути!)"); res.writeHead(405); res.end();
  } else { res.writeHead(200, Object.assign({ "Content-Type": "application/json" }, cors)); res.end(g.doGet()); }
}).listen(port, () => console.log("mock Apps Script on", port));
