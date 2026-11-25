# НУШ Тести-гра (`nush-quiz-game`)

Генератор інтерактивних тестів-ігор НУШ. Кожна гра — один автономний `index.html` (без фреймворків, CDN і зовнішніх ресурсів), працює з `file://` і як статичний сайт.

- `games/<subject>-<grade>-<topic>/index.html` — гра. Угорі файла `GAME_CONFIG` (subject, grade, topic, questionCount, maxScore 10/12, resultsEndpoint, teacherEmail, allowRetake) і `GRADE_THRESHOLDS`.
- `apps-script/` — приймач результатів (Google Таблиця + лист учителю), інструкція в `apps-script/README.md`.

Ігри:
- `games/physics-11-electromagnetic-field/` — «Поле дії: аварійний протокол» (Фізика, 11 клас, Електромагнітне поле): 17 тем, банк 76 завдань, спроба 34 питання.

Зареєстровано в AEOS: `ai-platform/projects/nush-quiz-game/`.
