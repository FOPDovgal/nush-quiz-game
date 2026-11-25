#!/usr/bin/env node
/* Перевірки без мережі: межі порогів (обидві шкали), декодування банку, валідатор/квоти, Code.gs з заглушками.
   Використання: node tools/test-game.js physics-11-electromagnetic-field */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const game = process.argv[2] || "physics-11-electromagnetic-field";
const html = fs.readFileSync(path.join(__dirname, "..", "games", game, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log("FAIL:", msg); } };

// --- контекст гри без DOM ---
const ctx = { TextEncoder, TextDecoder, atob: s => Buffer.from(s, "base64").toString("binary"), console };
vm.createContext(ctx);
vm.runInContext(scripts[0] + "\n" + scripts[1].split("/* ================== СТАН")[0] +
  "\nthis.G={GAME_CONFIG,GRADE_THRESHOLDS,BANK,validateBank,selectQuestions,quotas,FIG};", ctx);
const G = ctx.G;
function gradeFor(pct, max) { for (const [m, g] of G.GRADE_THRESHOLDS[max]) if (pct >= m) return g; return 1; }

// 1. Межі порогів за специфікацією
const spec = {
  12: [[0, 9, 1], [10, 19, 2], [20, 29, 3], [30, 39, 4], [40, 49, 5], [50, 57, 6], [58, 65, 7], [66, 73, 8], [74, 81, 9], [82, 89, 10], [90, 94, 11], [95, 100, 12]],
  10: [[0, 9, 1], [10, 19, 2], [20, 29, 3], [30, 39, 4], [40, 49, 5], [50, 59, 6], [60, 69, 7], [70, 79, 8], [80, 89, 9], [90, 100, 10]]
};
for (const max of [12, 10]) {
  let n = 0;
  for (const [lo, hi, g] of spec[max]) for (let p = lo; p <= hi; p++) { ok(gradeFor(p, max) === g, `шкала ${max}: ${p}% → ${gradeFor(p, max)}, очікувано ${g}`); n++; }
  console.log(`шкала ${max}: перевірено ${n} значень 0–100%`);
}
ok(G.GAME_CONFIG.maxScore === 12, "за замовчуванням maxScore=12");
// відсоток з кількості правильних (34 питання): 0 правильних → 1
ok(gradeFor(Math.round(0 / 34 * 100), 12) === 1, "0% → 1");
ok(gradeFor(Math.round(34 / 34 * 100), 12) === 12, "100% → 12");

// 2. Банк і валідатор
ok(G.BANK.length === 76, "банк декодовано: " + G.BANK.length);
ok(G.validateBank().length === 0, "валідатор: " + G.validateBank().join("; "));
ok(!/Притягуються|Вільні електрони/.test(html), "текст відповідей не лежить відкрито в HTML");
let minDir = 99, minCalc = 99;
for (let i = 0; i < 500; i++) {
  const s = G.selectQuestions(34);
  ok(s && s.length === 34 && new Set(s).size === 34, "спроба 34 без дублів");
  const topics = {}; s.forEach(q => topics[q.t] = (topics[q.t] || 0) + 1);
  ok(Object.keys(topics).length === 17 && Object.values(topics).every(v => v === 2), "по 2 з кожної з 17 тем");
  minDir = Math.min(minDir, s.filter(q => q.kind === "dir").length); minCalc = Math.min(minCalc, s.filter(q => q.kind === "calc").length);
}
ok(minDir >= 8 && minCalc >= 10, `квоти: мін. dir ${minDir}, мін. calc ${minCalc}`);
console.log(`500 спроб: мінімум ${minDir} на напрямки, ${minCalc} на обчислення`);

// 3. Code.gs із заглушками Google-сервісів
const rows = [], mails = [];
const sheet = { rows, getLastRow: () => rows.length, appendRow: r => rows.push(r), setFrozenRows() {}, getRange: () => ({ setFontWeight() {}, getValue: () => rows[0] && rows[0][0] }) };
const gctx = {
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: (() => { const m = {}; return { getScriptCache: () => ({ get: k => m[k], put: (k, v) => { m[k] = v; } }) }; })(),
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet, getUrl: () => "https://sheet" }) },
  MailApp: { sendEmail: (to, subj, body) => mails.push({ to, subj, body }), getRemainingDailyQuota: () => 100 },
  Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }) },
  ContentService: { createTextOutput: t => ({ t, setMimeType() { return JSON.parse(t); } }), MimeType: { JSON: "json" } }
};
vm.createContext(gctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8"), gctx);
const good = { attemptId: "abc-123", attemptNo: 1, studentName: "=ТЕСТ Перевірка", studentEmail: "test@example.com", studentGroup: "11-А",
  gameTitle: "Поле дії", subject: "Фізика", grade: 11, topic: "Електромагнітне поле", score: 11, maxScore: 12, percent: 91, correct: 31, total: 34,
  durationSec: 125, startedAt: "x", finishedAt: "y", section1: "7/8", section2: "12/12", section3: "2/2", section4: "10/12", weakTopics: "-тема", answers: "t1-1: так: ✓" };
const post = d => gctx.doPost({ postData: { contents: typeof d === "string" ? d : JSON.stringify(d) } });
let r = post(good);
ok(r.ok === true, "Code.gs: ok для коректних даних");
ok(rows.length === 2 && rows[0][0] === "Дата/час", "Code.gs: заголовки + 1 рядок");
ok(rows[1][1] === "'=ТЕСТ Перевірка" && rows[1][17] === "'-тема", "Code.gs: екранування = і -");
ok(rows[1][13] === "'7/8", "Code.gs: розділ як текст, не дата");
ok(mails.length === 1 && mails[0].subj === "[Гра] =ТЕСТ Перевірка — оцінка 11/12" && mails[0].to === "owner@example.com", "Code.gs: тема листа");
r = post(good); ok(r.ok === true && r.duplicate === true && rows.length === 2, "Code.gs: дубль спроби не записується");
ok(post(Object.assign({}, good, { attemptId: "z1", studentEmail: "bad" })).ok === false, "Code.gs: поганий email → ok:false");
ok(post(Object.assign({}, good, { attemptId: "z2", score: "11" })).ok === false, "Code.gs: рядок замість числа → ok:false");
ok(post(Object.assign({}, good, { attemptId: "z3", studentName: "x".repeat(500) })).ok === false, "Code.gs: задовге ПІБ → ok:false");
ok(post("not json").ok === false, "Code.gs: не JSON → ok:false");

console.log(`\n${checks - fails}/${checks} перевірок пройдено`);
process.exit(fails ? 1 : 0);
