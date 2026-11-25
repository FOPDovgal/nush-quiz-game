/**
 * НУШ Тести-гра — приймач результатів (Google Apps Script, веб-застосунок).
 * Кожна спроба → рядок в аркуші «Результати» цієї Таблиці + лист власнику скрипта.
 * Відповідь: JSON {ok:true} або {ok:false, error:"..."}. Встановлення — README.md поруч.
 */
var SHEET_NAME = 'Результати';
var HEADERS = ['Дата/час', 'ПІБ', 'Email', 'Клас', 'Предмет', 'Тема', 'Правильні', 'Всього', '%', 'Оцінка', 'maxScore',
  'Тривалість (хв:с)', 'Номер спроби', 'Розділ 1', 'Розділ 2', 'Розділ 3', 'Розділ 4', 'Слабкі теми',
  'Відповіді (id: відповідь: ✓/✗)', 'ID спроби', 'Гра', 'Клас програми'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    if (!e || !e.postData || !e.postData.contents) return out_({ ok: false, error: 'empty body' });
    if (e.postData.contents.length > 50000) return out_({ ok: false, error: 'body too large' });
    var d;
    try { d = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad json' }); }

    // --- валідація типів і довжин ---
    var err = [];
    var str = function (k, min, max) { var v = d[k]; if (typeof v !== 'string' || v.trim().length < min || v.length > max) err.push(k); return typeof v === 'string' ? v.trim() : ''; };
    var num = function (k, min, max) { var v = d[k]; if (typeof v !== 'number' || !isFinite(v) || v < min || v > max) err.push(k); return v; };
    var name = str('studentName', 3, 120), email = str('studentEmail', 5, 120), group = str('studentGroup', 0, 40);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) err.push('studentEmail');
    var subject = str('subject', 1, 60), topic = str('topic', 1, 120), title = str('gameTitle', 1, 120);
    var attemptId = str('attemptId', 4, 60);
    var correct = num('correct', 0, 500), total = num('total', 1, 500), percent = num('percent', 0, 100);
    var maxScore = num('maxScore', 10, 12), score = num('score', 1, 12), dur = num('durationSec', 0, 864000);
    var attemptNo = num('attemptNo', 1, 1000), grade = num('grade', 1, 12);
    if (maxScore !== 10 && maxScore !== 12) err.push('maxScore');
    if (correct > total || score > maxScore) err.push('consistency');
    var secs = ['section1', 'section2', 'section3', 'section4'].map(function (k) { return str(k, 3, 9); });
    var weak = str('weakTopics', 0, 2000), answers = str('answers', 0, 8000);
    if (err.length) return out_({ ok: false, error: 'invalid: ' + err.join(',') });

    lock.waitLock(20000); locked = true;
    var cache = CacheService.getScriptCache();
    var key = 'att_' + attemptId;
    if (cache.get(key)) return out_({ ok: true, duplicate: true });   // повторне надсилання тієї ж спроби

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = sheet_(ss);
    var mmss = Math.floor(dur / 60) + ':' + ('0' + Math.round(dur % 60)).slice(-2);
    sh.appendRow([new Date(), safe_(name), safe_(email), safe_(group), safe_(subject), safe_(topic),
      correct, total, percent, score, maxScore, safe_(mmss), attemptNo,
      safe_(secs[0]), safe_(secs[1]), safe_(secs[2]), safe_(secs[3]), safe_(weak), safe_(answers),
      safe_(attemptId), safe_(title), grade]);
    cache.put(key, '1', 21600);
    lock.releaseLock(); locked = false;

    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
        '[Гра] ' + name + ' — оцінка ' + score + '/' + maxScore,
        'Учень: ' + name + '\nEmail: ' + email + '\nКлас: ' + (group || '—') +
        '\nГра: ' + title + ' (' + subject + ', ' + grade + ' кл., ' + topic + ')' +
        '\nСпроба №' + attemptNo + '\nОцінка: ' + score + ' з ' + maxScore +
        '\nПравильно: ' + correct + ' з ' + total + ' (' + percent + '%)' +
        '\nТривалість: ' + mmss +
        '\nРозділи: ' + secs.join(' | ') +
        '\nТеми для повторення: ' + (weak || '—') +
        '\n\nТаблиця з усіма результатами: ' + ss.getUrl());
    } catch (mailErr) { /* рядок уже записано; ліміт пошти не має зривати збереження */ }
    return out_({ ok: true });
  } catch (ex) {
    return out_({ ok: false, error: String(ex).slice(0, 200) });
  } finally {
    if (locked) try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet() { return out_({ ok: true, service: 'nush-quiz-game results' }); }

/** Екранування: рядки, що починаються з = + - @, і дроби на кшталт 3/4 зберігаються як текст. */
function safe_(v) {
  v = String(v == null ? '' : v);
  return /^[=+\-@]/.test(v) || /^\d+\/\d+$/.test(v) || /^\d+:\d+$/.test(v) ? "'" + v : v;
}

function sheet_(ss) {
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  // аркуш від попередньої версії скрипта з іншими стовпцями — не змішуємо, пишемо в новий
  if (sh.getLastRow() > 0 && sh.getRange(1, 1).getValue() !== HEADERS[0]) {
    sh = ss.getSheetByName(SHEET_NAME + ' v2') || ss.insertSheet(SHEET_NAME + ' v2');
  }
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold'); }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Запустіть один раз вручну з редактора, щоб надати дозволи (Таблиця + пошта) і створити аркуш. */
function setup() {
  sheet_(SpreadsheetApp.getActiveSpreadsheet());
  MailApp.getRemainingDailyQuota();
}
