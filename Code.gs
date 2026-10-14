/**
 * CLT REFRESH – backend pro webovou časovou osu.
 *
 * Skript je vázaný na Google tabulku (Rozšíření → Apps Script).
 *  - GET  … vrátí úkoly, lidi, nákup, přístroje, otevřené body a log jako JSON (čtení je veřejné).
 *  - POST … změní JEN sloupec stavu u jedné položky a zapíše to do listu „Log“.
 *            Zápis projde jen s platným osobním kódem z listu „Přístup“.
 *
 * Nasazení: Nasadit → Nové nasazení → Webová aplikace
 *           Spustit jako: Já · Kdo má přístup: Kdokoli
 * Kódy:     menu CLT REFRESH → Vytvořit přístupové kódy (v tabulce).
 */

const SHEETS = { tasks: 'Úkoly', people: 'Přehled', buy: 'Nákup', gear: 'Přístroje', open: 'Otevřené body', log: 'Log', access: 'Přístup' };

// Co smí web měnit: list → sloupec (text hlavičky) → povolené hodnoty.
const RULES = {
  'Úkoly': { 'Stav': ['Nezačato', 'Rozpracováno', 'Hotovo', 'Zrušeno'] },
  'Nákup': { 'Koupeno': ['ano', 'ne'] },
  'Přístroje': { 'Zkontrolováno / nabito': ['ano', 'ne'], 'Naloženo': ['ano', 'ne'], 'Na místě': ['ano', 'ne'], 'Vráceno': ['ano', 'ne'] },
  'Otevřené body': { 'Stav': ['Otevřeno', 'Vyřešeno'] },
};

// ---------------------------------------------------------------- HTTP

function doGet() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('all');
  if (hit) return json_(JSON.parse(hit));
  const data = readAll_();
  try { cache.put('all', JSON.stringify(data), 20); } catch (e) { /* příliš velké pro cache – nevadí */ }
  return json_(data);
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const who = whoFromCode_(ss, req.code);
  if (!who) return json_({ ok: false, error: 'bad_code' });
  if (req.action === 'whoami') return json_({ ok: true, key: who.key, name: who.name });

  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return json_({ ok: false, error: 'busy' }); }
  try {
    const res = applyChange_(ss, req, who);
    CacheService.getScriptCache().remove('all');
    return json_(res);
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- přístupové kódy

/** List „Přístup“: B1 = adresa webu, hlavička na řádku 3 (Osoba | Celé jméno | Kód | Aktivní | Osobní odkaz). */
function whoFromCode_(ss, code) {
  code = String(code || '').trim().toUpperCase();
  if (code.length < 8) return null;
  const t = grid_(ss, SHEETS.access);
  if (!t) return null;
  return findCode_(t.values, code);
}

function findCode_(values, code) {
  const h = findRow_(values, 2, 'Kód');
  if (h < 0) return null;
  for (let r = h + 1; r < values.length; r++) {
    const v = values[r];
    if (str_(v[2]).toUpperCase() === code && str_(v[3]).toLowerCase() !== 'ne' && str_(v[0])) {
      return { key: str_(v[0]), name: str_(v[1]) || str_(v[0]) };
    }
  }
  return null;
}

function newCode_() {
  // 12 znaků bez snadno zaměnitelných (0/O, 1/I/L)
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random() + Date.now());
  let out = '';
  for (let i = 0; i < 12; i++) out += abc[(bytes[i] + 256) % abc.length];
  return out;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('CLT REFRESH')
    .addItem('Vytvořit přístupové kódy', 'makeCodes')
    .addItem('Nový kód pro vybraný řádek', 'resetCode')
    .addToUi();
}

/** Doplní do listu „Přístup“ každého z tabulky Lidé (Přehled), kdo tam ještě není. Stávající kódy nemění. */
function makeCodes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEETS.access);
  if (!sh) {
    sh = ss.insertSheet(SHEETS.access);
    sh.getRange('A1:B1').setValues([['Adresa webu', '']]);
    sh.getRange('A2').setValue('Sem do B1 vlož adresu webu (např. https://jmeno.github.io/clt-refresh/). Odkazy ve sloupci E se pak doplní samy. Kód zrušíš: Aktivní = ne.');
    sh.getRange('A3:E3').setValues([['Osoba', 'Celé jméno', 'Kód', 'Aktivní', 'Osobní odkaz']]).setFontWeight('bold');
    sh.setFrozenRows(3);
    sh.setColumnWidths(1, 2, 180); sh.setColumnWidth(3, 130); sh.setColumnWidth(5, 420);
  }
  const people = parsePeople_(grid_(ss, SHEETS.people)).people;
  const have = sh.getLastRow() > 3 ? sh.getRange(4, 1, sh.getLastRow() - 3, 1).getValues().map(r => str_(r[0])) : [];
  const rows = people.filter(p => have.indexOf(p.key) < 0).map(p => [p.key, p.full, newCode_(), 'ano']);
  if (rows.length) {
    const r0 = sh.getLastRow() + 1;
    sh.getRange(r0, 1, rows.length, 4).setValues(rows);
  }
  const n = sh.getLastRow() - 3;
  if (n > 0) {
    const f = [];
    for (let i = 0; i < n; i++) f.push(['=IF($B$1="","",$B$1&"#k="&C' + (i + 4) + ')']);
    sh.getRange(4, 5, n, 1).setFormulas(f);
  }
  SpreadsheetApp.getUi().alert('Hotovo. Přidáno ' + rows.length + ' lidí. Odkaz ze sloupce E pošli každému zvlášť.');
}

/** Vygeneruje nový kód pro řádek, na kterém stojí kurzor (starý odkaz přestane fungovat). */
function resetCode() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEETS.access) { SpreadsheetApp.getUi().alert('Otevři list Přístup a klikni do řádku osoby.'); return; }
  const r = sh.getActiveCell().getRow();
  if (r < 4) return;
  sh.getRange(r, 3).setValue(newCode_());
  SpreadsheetApp.getUi().alert('Nový kód pro ' + sh.getRange(r, 1).getValue() + '. Pošli mu nový odkaz ze sloupce E.');
}

// ---------------------------------------------------------------- čtení

function grid_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return null;
  const rg = sh.getDataRange();
  return { sheet: sh, values: rg.getValues(), display: rg.getDisplayValues(), backgrounds: rg.getBackgrounds() };
}

function readAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const g = {};
  Object.keys(SHEETS).forEach(k => { g[k] = grid_(ss, SHEETS[k]); });
  return buildData_(g, tz);
}

/** Čistá funkce: z tabulek (values/display/backgrounds) poskládá data pro web. */
function buildData_(g, tz) {
  const pp = g.people ? parsePeople_(g.people) : { people: [], lead: '' };
  return {
    lead: pp.lead,
    people: pp.people,
    types: TYPES,
    tasks: g.tasks ? parseTasks_(g.tasks, tz) : [],
    buy: g.buy ? parseBuy_(g.buy, tz) : [],
    gear: g.gear ? parseGear_(g.gear, tz) : [],
    open: g.open ? parseOpen_(g.open) : [],
    log: g.log ? parseLog_(g.log, tz) : [],
    at: fmtStamp_(new Date(), tz),
  };
}

const TYPES = [
  { name: 'Logistika', color: '#5B7DB1' }, { name: 'Stavba', color: '#8D6E4F' }, { name: 'Nátěr', color: '#E69138' },
  { name: 'Instrumentace', color: '#3C78D8' }, { name: 'Měření', color: '#6AA84F' }, { name: 'Experiment', color: '#CC0000' },
  { name: 'Hašení', color: '#1C4587' }, { name: 'Úklid', color: '#999999' }, { name: 'Bezpečnost', color: '#F1C232' },
  { name: 'Pauza', color: '#D9D9D9' }, { name: 'Milník', color: '#000000' },
];

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function isoDate_(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return fmtDate_(v, tz, 'yyyy-MM-dd');
  const s = str_(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})?/);
  if (m) return (m[3] || '2026') + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function hhmm_(display) {
  const m = str_(display).match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : null;
}

function fmtDate_(d, tz, f) {
  if (typeof Utilities !== 'undefined') return Utilities.formatDate(d, tz, f);
  // jen pro test mimo Google
  const p = n => ('0' + n).slice(-2);
  const s = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  return f === 'yyyy-MM-dd' ? s : s + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function fmtStamp_(d, tz) { return fmtDate_(d, tz, 'yyyy-MM-dd HH:mm'); }

function findRow_(values, col, text, from) {
  for (let r = from || 0; r < values.length; r++) if (str_(values[r][col]) === text) return r;
  return -1;
}

function headerMap_(row) {
  const m = {};
  row.forEach((h, i) => { const k = str_(h); if (k && !(k in m)) m[k] = i; });
  return m;
}

function parsePeople_(t) {
  const h = findRow_(t.values, 0, 'Ve sloupci Kdo');
  const people = [];
  let lead = '';
  if (h < 0) return { people, lead };
  for (let r = h + 1; r < t.values.length; r++) {
    const key = str_(t.values[r][0]);
    if (!key) break;
    const full = str_(t.values[r][1]) || key;
    const role = str_(t.values[r][3]);
    let color = str_(t.backgrounds[r][0]).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(color) || color === '#FFFFFF') color = '#7F7F7F';
    people.push({ key: key, color: color, full: full });
    if (!lead && role.toLowerCase().indexOf('hlavní řešitel') >= 0) lead = full;
  }
  return { people, lead: lead || (people[0] ? people[0].full : '') };
}

function parseTasks_(t, tz) {
  const h = findRow_(t.values, 0, 'ID');
  if (h < 0) return [];
  const c = headerMap_(t.values[h]);
  const out = [];
  for (let r = h + 1; r < t.values.length; r++) {
    const v = t.values[r], d = t.display[r];
    const what = str_(v[c['Činnost']]);
    if (!what) continue;
    const date = isoDate_(v[c['Datum']], tz);
    const from = hhmm_(d[c['Čas od']]);
    if (!date || !from) continue;
    out.push({
      id: str_(v[c['ID']]) || ('R' + (r + 1)), type: str_(v[c['Typ']]), date: date, from: from,
      to: hhmm_(d[c['Čas do']]) || from, what: what, detail: str_(v[c['Detail']]), who: str_(v[c['Kdo']]),
      gear: str_(v[c['Vybavení / materiál']]), note: str_(v[c['Poznámka / otevřené']]), state: str_(v[c['Stav']]) || 'Nezačato',
    });
  }
  out.sort((a, b) => (a.date + a.from + a.to + a.id < b.date + b.from + b.to + b.id ? -1 : 1));
  return out;
}

// Tabulky s hlavičkou „#“ (může jich být víc pod sebou – Přístroje A a B).
function eachTable_(t, fn) {
  let r = 0;
  while ((r = findRow_(t.values, 0, '#', r)) >= 0) {
    const c = headerMap_(t.values[r]);
    const title = r > 0 ? str_(t.values[r - 1][0]) : '';
    let q = r + 1;
    for (; q < t.values.length; q++) {
      const n = t.values[q][0];
      if (n === '' || n === null || isNaN(Number(n))) break;
      fn(t.values[q], t.display[q], c, title, q);
    }
    r = q;
  }
}

function parseBuy_(t, tz) {
  const out = [];
  eachTable_(t, (v, d, c) => out.push({
    n: Number(v[0]), name: str_(v[c['Položka']]), qty: str_(d[c['Množství']]), unit: str_(v[c['Jedn.']]),
    spec: str_(v[c['Specifikace']]), act: str_(v[c['Pro činnost']]), need: isoDate_(v[c['Potřeba k']], tz),
    who: str_(v[c['Kdo koupí']]), note: str_(v[c['Poznámka']]), Koupeno: str_(v[c['Koupeno']]) || 'ne',
  }));
  return out;
}

function parseGear_(t, tz) {
  const out = [];
  eachTable_(t, (v, d, c, title) => out.push({
    n: Number(v[0]), sec: title, name: str_(v[c['Přístroj']]), act: str_(v[c['Činnost']]), need: isoDate_(v[c['Potřeba od']], tz),
    op: str_(v[c['Obsluha']]), carrier: str_(v[c['Kdo veze']]), note: str_(v[c['Poznámka']]),
    'Zkontrolováno / nabito': str_(v[c['Zkontrolováno / nabito']]) || 'ne',
    'Naloženo': str_(v[c['Naloženo']]) || 'ne', 'Na místě': str_(v[c['Na místě']]) || 'ne', 'Vráceno': str_(v[c['Vráceno']]) || 'ne',
  }));
  return out;
}

function parseOpen_(t) {
  const out = [];
  eachTable_(t, (v, d, c) => out.push({
    n: Number(v[0]), area: str_(v[c['Oblast']]), text: str_(v[c['Problém / otázka']]), why: str_(v[c['Proč to vadí']]),
    owner: str_(v[c['Kdo zjistí / rozhodne']]), Stav: str_(v[c['Stav']]) || 'Otevřeno',
  }));
  return out;
}

function parseLog_(t, tz) {
  const out = [];
  for (let r = 1; r < t.values.length; r++) {
    const v = t.values[r];
    if (!v[0]) continue;
    out.push({ at: Object.prototype.toString.call(v[0]) === '[object Date]' ? fmtStamp_(v[0], tz) : str_(v[0]),
      who: str_(v[1]), name: str_(v[2]), sheet: str_(v[3]), key: str_(v[4]), field: str_(v[5]), value: str_(v[6]) });
  }
  return out.slice(-300);
}

// ---------------------------------------------------------------- zápis

/** req: { sheet, key, field, value }  – key = ID úkolu, nebo číslo „#“ u ostatních listů. */
function applyChange_(ss, req, who) {
  const rules = RULES[req.sheet];
  if (!rules || !rules[req.field]) return { ok: false, error: 'field_not_allowed' };
  if (rules[req.field].indexOf(req.value) < 0) return { ok: false, error: 'value_not_allowed' };
  const t = grid_(ss, req.sheet);
  if (!t) return { ok: false, error: 'sheet_missing' };
  const hit = locate_(t, req.sheet, String(req.key), req.field);
  if (!hit) return { ok: false, error: 'item_not_found' };
  // Ochrana proti přečíslování: název položky musí sedět s tím, co viděl web.
  if (req.name && str_(t.values[hit.row][hit.nameCol]) !== str_(req.name)) return { ok: false, error: 'item_changed' };
  t.sheet.getRange(hit.row + 1, hit.col + 1).setValue(req.value);
  let log = ss.getSheetByName(SHEETS.log);
  if (!log) {
    log = ss.insertSheet(SHEETS.log);
    log.appendRow(['Čas', 'Osoba', 'Jméno', 'List', 'Položka', 'Pole', 'Hodnota']);
    log.setFrozenRows(1);
  }
  const now = new Date();
  log.appendRow([now, who.key, who.name, req.sheet, String(req.key), req.field, req.value]);
  return { ok: true, at: fmtStamp_(now, ss.getSpreadsheetTimeZone()), key: who.key, name: who.name };
}

/** Najde buňku: řádek položky a sloupec pole (hlavička nejbližší tabulky nad položkou). */
function locate_(t, sheetName, key, field) {
  if (sheetName === SHEETS.tasks) {
    const h = findRow_(t.values, 0, 'ID');
    if (h < 0) return null;
    const c = headerMap_(t.values[h]);
    if (!(field in c)) return null;
    for (let r = h + 1; r < t.values.length; r++) if (str_(t.values[r][0]) === key) return { row: r, col: c[field], nameCol: c['Činnost'] };
    return null;
  }
  const NAME = { 'Nákup': 'Položka', 'Přístroje': 'Přístroj', 'Otevřené body': 'Problém / otázka' }[sheetName];
  let found = null;
  eachTable_(t, (v, d, c, title, q) => {
    if (!found && String(Number(v[0])) === key && field in c) found = { row: q, col: c[field], nameCol: c[NAME] };
  });
  return found;
}

// ---------------------------------------------------------------- test v editoru
function test_readAll() { Logger.log(JSON.stringify(readAll_()).slice(0, 2000)); }
