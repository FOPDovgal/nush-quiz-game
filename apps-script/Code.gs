/**
 * НУШ Тести-гра — приймач результатів.
 * Записує кожну спробу в аркуш «Результати» цієї Google Таблиці і надсилає лист учителю.
 * Встановлення — див. README.md поруч.
 */
var TEACHER_EMAIL = '';          // email учителя; порожньо = лист на адресу власника скрипта
var SHEET_NAME = 'Результати';
var HEADERS = ['Отримано', 'ПІБ', 'Email учня', 'Клас', 'Бал', 'Шкала', 'Відсоток', 'Правильно', 'Усього',
  'Час (с)', 'Початок', 'Завершення', 'Тест', 'Предмет', 'Клас (програма)', 'Тема', 'Слабкі теми', 'Відповіді', 'ID спроби'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);
    var s = function (v, max) { return String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, max || 200); };
    if (!d.studentName || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.studentEmail))) return out({ ok: false, error: 'bad input' });

    lock.waitLock(20000);
    var cache = CacheService.getScriptCache();
    var key = 'att_' + s(d.attemptId, 60);
    if (cache.get(key)) return out({ ok: true, duplicate: true });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
    var n = function (v) { var x = Number(v); return isFinite(x) ? x : ''; };
    sh.appendRow([new Date(), s(d.studentName, 120), s(d.studentEmail, 120), s(d.studentGroup, 40),
      n(d.score), n(d.maxScore), n(d.percent), n(d.correct), n(d.total), n(d.durationSec),
      s(d.startedAt, 40), s(d.finishedAt, 40), s(d.gameTitle), s(d.subject), n(d.grade), s(d.topic),
      s(d.weakTopics, 2000), s(d.answers, 3000), s(d.attemptId, 60)]);
    cache.put(key, '1', 21600);
    lock.releaseLock();

    var to = TEACHER_EMAIL || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(to,
      'Результат: ' + s(d.gameTitle) + ' — ' + s(d.studentName, 120) + ' — ' + n(d.score) + '/' + n(d.maxScore),
      'Учень: ' + s(d.studentName, 120) + '\nEmail: ' + s(d.studentEmail, 120) + '\nКлас: ' + s(d.studentGroup, 40) +
      '\nТест: ' + s(d.gameTitle) + ' (' + s(d.subject) + ', ' + n(d.grade) + ' кл., ' + s(d.topic) + ')' +
      '\nБал: ' + n(d.score) + ' з ' + n(d.maxScore) +
      '\nПравильно: ' + n(d.correct) + ' з ' + n(d.total) + ' (' + n(d.percent) + '%)' +
      '\nЧас: ' + Math.round(n(d.durationSec) / 60) + ' хв' +
      '\nСлабкі теми: ' + (s(d.weakTopics, 2000) || '—') +
      '\n\nУсі результати: ' + ss.getUrl());
    return out({ ok: true });
  } catch (err) {
    try { lock.releaseLock(); } catch (e2) {}
    return out({ ok: false, error: String(err).slice(0, 200) });
  }
}

function doGet() { return out({ ok: true, service: 'nush-quiz-game results' }); }

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Запустіть один раз вручну з редактора, щоб надати дозволи (Таблиця + пошта). */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  MailApp.getRemainingDailyQuota();
}
