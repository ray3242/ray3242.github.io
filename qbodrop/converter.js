/* Qbodrop conversion core: bank rows in, QBO/OFX text out. Runs in the browser and in Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QboCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 12);
    let best = ',', bestScore = -1;
    for (const d of [',', ';', '\t', '|']) {
      const counts = lines.map(l => splitLine(l, d).length);
      const mode = counts.slice().sort((a, b) => counts.filter(c => c === b).length - counts.filter(c => c === a).length)[0];
      const score = mode > 1 ? mode * counts.filter(c => c === mode).length : 0;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }
  function splitLine(line, d) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  }
  function parseCSV(text, delimiter) {
    text = String(text).replace(/^\uFEFF/, '');
    const d = delimiter || detectDelimiter(text);
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"' && cur.trim() === '') { q = true; cur = ''; }
      else if (ch === d) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.map(r => r.map(c => String(c).trim())).filter(r => r.some(c => c !== ''));
  }

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function validDate(y, m, d) {
    if (!(y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return { y, m, d };
  }
  function fullYear(y) { return y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y; }
  /* order: 'MDY' | 'DMY' | 'YMD' for all-numeric dates */
  function parseDate(v, order) {
    if (v == null) return null;
    if (v instanceof Date && !isNaN(v)) return validDate(v.getFullYear(), v.getMonth() + 1, v.getDate());
    let s = String(v).trim(); if (!s) return null;
    s = s.replace(/[T ]\d{1,2}:\d{2}.*$/, '').trim();
    let m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) return validDate(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return validDate(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/. ]([A-Za-z]{3,9})\.?[-\/., ]+(\d{2,4})$/))) {
      const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; return mo ? validDate(fullYear(+m[3]), mo, +m[1]) : null;
    }
    if ((m = s.match(/^([A-Za-z]{3,9})\.?[-\/. ]+(\d{1,2})(?:st|nd|rd|th)?[-\/., ]+(\d{2,4})$/))) {
      const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; return mo ? validDate(fullYear(+m[3]), mo, +m[2]) : null;
    }
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) {
      const a = +m[1], b = +m[2], y = fullYear(+m[3]);
      return order === 'DMY' ? validDate(y, b, a) : validDate(y, a, b);
    }
    return null;
  }
  function detectDateOrder(values) {
    let dmy = 0, mdy = 0;
    for (const v of values) {
      const m = String(v || '').trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
      if (!m) continue;
      if (+m[1] > 12 && +m[2] <= 12) dmy++;
      if (+m[2] > 12 && +m[1] <= 12) mdy++;
    }
    return dmy > mdy ? 'DMY' : 'MDY';
  }

  function parseAmount(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : null;
    let s = String(v).trim(); if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/\b(DR|DB)\.?$/i.test(s)) neg = true;
    s = s.replace(/\b(CR|DR|DB)\.?$/i, '').replace(/[A-Za-z$€£¥₹\s\u00a0']/g, '');
    if (/-$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    if (/^\+/.test(s)) s = s.slice(1);
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    const lastC = s.lastIndexOf(','), lastD = s.lastIndexOf('.');
    if (lastC > -1 && lastD > -1) {
      if (lastC > lastD) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    } else if (lastC > -1) {
      const dec = s.length - lastC - 1;
      if (s.indexOf(',') === lastC && dec !== 3) s = s.replace(',', '.'); else s = s.replace(/,/g, '');
    } else if (lastD > -1 && s.indexOf('.') !== lastD) s = s.replace(/\./g, '');
    const n = parseFloat(s); if (!isFinite(n)) return null;
    return Math.round((neg ? -n : n) * 100) / 100;
  }

  const HEAD = {
    date: /^(transaction|trans\.?|posted|posting|post|value|booking|effective)?\s*date$|^date\s*(posted|of transaction)?$|^datum$|^fecha$/i,
    description: /desc|narrat|payee|details?|particulars|merchant|^name$|transaction$|text|reference text|concepto/i,
    memo: /memo|note|remark|categor|reference|^ref/i,
    amount: /^amount|amount$|^value$|^sum$|betrag|importe|^cad\$?$|^usd\$?$/i,
    debit: /debit|withdraw|paid out|money out|^out$|payments?$|charges?$/i,
    credit: /credit|deposit|paid in|money in|^in$|receipts?$/i,
    balance: /balance|saldo/i,
    check: /che(ck|que)\s*(no|num|#)?|^num(ber)?$|^no\.?$/i
  };
  /* Finds the header row and a first guess at which column holds what. */
  function analyse(rows) {
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const r = rows[i]; const filled = r.filter(c => c !== '').length;
      if (filled < 2) continue;
      const hits = r.filter(c => Object.values(HEAD).some(re => re.test(c)) && parseDate(c) == null && parseAmount(c) == null).length;
      if (hits >= 2) { headerIdx = i; break; }
    }
    const width = Math.max.apply(null, rows.slice(0, 50).map(r => r.length).concat(0));
    const body = rows.slice(headerIdx + 1);
    const headers = [];
    for (let c = 0; c < width; c++) headers.push(headerIdx >= 0 && rows[headerIdx][c] ? rows[headerIdx][c] : 'Column ' + (c + 1));
    const map = { date: -1, description: -1, memo: -1, amount: -1, debit: -1, credit: -1, balance: -1, check: -1 };
    if (headerIdx >= 0) {
      const order = ['date', 'balance', 'debit', 'credit', 'amount', 'check', 'description', 'memo'];
      for (const key of order) for (let c = 0; c < width; c++) {
        if (map[key] !== -1) break;
        if (Object.values(map).includes(c)) continue;
        if (HEAD[key].test(headers[c])) map[key] = c;
      }
    }
    const sample = body.slice(0, 40);
    const anyDate = v => parseDate(v, 'MDY') || parseDate(v, 'DMY');
    const rate = (c, fn) => sample.length ? sample.filter(r => r[c] && fn(r[c]) != null).length / sample.length : 0;
    if (map.date === -1) for (let c = 0; c < width; c++) if (rate(c, anyDate) > 0.6) { map.date = c; break; }
    if (map.amount === -1 && map.debit === -1 && map.credit === -1) {
      for (let c = 0; c < width; c++) if (c !== map.date && c !== map.balance && rate(c, parseAmount) > 0.6 && rate(c, anyDate) < 0.3) { map.amount = c; break; }
    }
    if (map.description === -1) {
      let best = -1, bestLen = 0;
      for (let c = 0; c < width; c++) {
        if (Object.values(map).includes(c)) continue;
        const len = sample.reduce((s, r) => s + (r[c] && parseAmount(r[c]) == null ? r[c].length : 0), 0);
        if (len > bestLen) { bestLen = len; best = c; }
      }
      map.description = best;
    }
    if (map.debit !== -1 && map.credit !== -1) map.amount = -1;
    const dateOrder = map.date >= 0 ? detectDateOrder(body.map(r => r[map.date])) : 'MDY';
    return { headerIdx, headers, map, dateOrder, body };
  }

  /* opts: { map, dateOrder, flipSign } -> { transactions, skipped } */
  function toTransactions(body, opts) {
    const m = opts.map, tx = [], skipped = [];
    body.forEach((r, i) => {
      const date = m.date >= 0 ? parseDate(r[m.date], opts.dateOrder) : null;
      let amount = null;
      if (m.amount >= 0) amount = parseAmount(r[m.amount]);
      if (amount == null && (m.debit >= 0 || m.credit >= 0)) {
        const d = m.debit >= 0 ? parseAmount(r[m.debit]) : null, c = m.credit >= 0 ? parseAmount(r[m.credit]) : null;
        if (d != null && d !== 0) amount = -Math.abs(d);
        else if (c != null && c !== 0) amount = Math.abs(c);
        else if (d === 0 || c === 0) amount = 0;
      }
      if (!date || amount == null) { if (r.some(c => c !== '')) skipped.push({ row: i, cells: r, why: !date ? 'no date' : 'no amount' }); return; }
      if (opts.flipSign) amount = -amount;
      tx.push({
        date, amount,
        description: clean(m.description >= 0 ? r[m.description] : ''),
        memo: clean(m.memo >= 0 ? r[m.memo] : ''),
        check: m.check >= 0 ? String(r[m.check] || '').replace(/\D/g, '').slice(0, 12) : '',
        balance: m.balance >= 0 ? parseAmount(r[m.balance]) : null
      });
    });
    return { transactions: tx, skipped };
  }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  const ASCII = { 'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a', 'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ý': 'y', 'ÿ': 'y', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '€': 'EUR', '£': 'GBP' };
  function sgml(s, max) {
    s = String(s || '').replace(/[^\x20-\x7e]/g, ch => {
      const lo = ch.toLowerCase(), t = ASCII[lo];
      if (t == null) return ' ';
      return ch === lo ? t : t.toUpperCase();
    });
    s = s.replace(/\s+/g, ' ').trim().slice(0, max);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const p2 = n => String(n).padStart(2, '0');
  const ymd = d => d.y + p2(d.m) + p2(d.d);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

  /* opts: { format: 'qbo'|'ofx', accountType: 'CHECKING'|'SAVINGS'|'CREDITCARD', accountId, bankId, intuBid, org, currency, now } */
  function buildOFX(transactions, opts) {
    const o = Object.assign({ format: 'qbo', accountType: 'CHECKING', accountId: '0000', bankId: '000000000', intuBid: '3000', org: 'Bank', currency: 'USD' }, opts || {});
    const tx = transactions.slice().sort((a, b) => ymd(a.date).localeCompare(ymd(b.date)));
    const now = o.now || new Date();
    const stamp = now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + '120000';
    const start = tx.length ? ymd(tx[0].date) : stamp.slice(0, 8), end = tx.length ? ymd(tx[tx.length - 1].date) : stamp.slice(0, 8);
    const seen = {}, L = [];
    const card = o.accountType === 'CREDITCARD';
    const acct = sgml(String(o.accountId).replace(/\s/g, '') || '0000', 22);
    L.push('OFXHEADER:100', 'DATA:OFXSGML', 'VERSION:102', 'SECURITY:NONE', 'ENCODING:USASCII', 'CHARSET:1252', 'COMPRESSION:NONE', 'OLDFILEUID:NONE', 'NEWFILEUID:NONE', '');
    L.push('<OFX>', '<SIGNONMSGSRSV1>', '<SONRS>', '<STATUS>', '<CODE>0', '<SEVERITY>INFO', '</STATUS>', '<DTSERVER>' + stamp, '<LANGUAGE>ENG');
    if (o.format === 'qbo') L.push('<FI>', '<ORG>' + sgml(o.org, 32), '<FID>' + sgml(o.intuBid, 32), '</FI>', '<INTU.BID>' + sgml(o.intuBid, 32));
    L.push('</SONRS>', '</SIGNONMSGSRSV1>');
    L.push(card ? '<CREDITCARDMSGSRSV1>' : '<BANKMSGSRSV1>', card ? '<CCSTMTTRNRS>' : '<STMTTRNRS>', '<TRNUID>1', '<STATUS>', '<CODE>0', '<SEVERITY>INFO', '</STATUS>', card ? '<CCSTMTRS>' : '<STMTRS>', '<CURDEF>' + sgml(o.currency, 3));
    if (card) L.push('<CCACCTFROM>', '<ACCTID>' + acct, '</CCACCTFROM>');
    else L.push('<BANKACCTFROM>', '<BANKID>' + sgml(String(o.bankId).replace(/\s/g, '') || '000000000', 9), '<ACCTID>' + acct, '<ACCTTYPE>' + o.accountType, '</BANKACCTFROM>');
    L.push('<BANKTRANLIST>', '<DTSTART>' + start + '120000', '<DTEND>' + end + '120000');
    for (const t of tx) {
      const key = ymd(t.date) + '|' + t.amount.toFixed(2) + '|' + t.description + '|' + t.memo + '|' + t.check;
      seen[key] = (seen[key] || 0) + 1;
      const fitid = ymd(t.date) + hash(key) + (seen[key] > 1 ? '-' + seen[key] : '');
      const name = sgml(t.description || t.memo || (t.amount < 0 ? 'Withdrawal' : 'Deposit'), 32);
      const memoSrc = t.description.length > 32 ? (t.memo ? t.description + ' ' + t.memo : t.description) : t.memo;
      L.push('<STMTTRN>', '<TRNTYPE>' + (t.check ? 'CHECK' : t.amount < 0 ? 'DEBIT' : 'CREDIT'), '<DTPOSTED>' + ymd(t.date) + '120000', '<TRNAMT>' + t.amount.toFixed(2), '<FITID>' + fitid);
      if (t.check) L.push('<CHECKNUM>' + t.check);
      L.push('<NAME>' + name);
      if (memoSrc) L.push('<MEMO>' + sgml(memoSrc, 255));
      L.push('</STMTTRN>');
    }
    const last = tx.length ? tx[tx.length - 1] : null;
    const bal = o.balance != null ? o.balance : (last && last.balance != null ? last.balance : 0);
    L.push('</BANKTRANLIST>', '<LEDGERBAL>', '<BALAMT>' + Number(bal).toFixed(2), '<DTASOF>' + end + '120000', '</LEDGERBAL>', card ? '</CCSTMTRS>' : '</STMTRS>', card ? '</CCSTMTTRNRS>' : '</STMTTRNRS>', card ? '</CREDITCARDMSGSRSV1>' : '</BANKMSGSRSV1>', '</OFX>', '');
    return L.join('\r\n');
  }

  return { parseCSV, detectDelimiter, parseDate, detectDateOrder, parseAmount, analyse, toTransactions, buildOFX };
});
