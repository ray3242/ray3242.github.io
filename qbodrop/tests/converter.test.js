const assert = require('assert'), fs = require('fs'), path = require('path');
const C = require('../converter.js');
const eq = assert.deepStrictEqual;

// amounts
eq(C.parseAmount('1,234.56'), 1234.56); eq(C.parseAmount('(1,234.56)'), -1234.56); eq(C.parseAmount('-$12.00'), -12);
eq(C.parseAmount('1.234,56'), 1234.56); eq(C.parseAmount('12,50'), 12.5); eq(C.parseAmount('1,234'), 1234);
eq(C.parseAmount('45.10 DR'), -45.1); eq(C.parseAmount('45.10CR'), 45.1); eq(C.parseAmount('12.00-'), -12);
eq(C.parseAmount('50.00DR'), -50); eq(C.parseAmount('-50.00 DR'), -50); eq(C.parseAmount('50.00 CR'), 50);
eq(C.parseAmount(''), null); eq(C.parseAmount('abc'), null); eq(C.parseAmount('€ 1 200,00'), 1200);
// dates
eq(C.parseDate('2026-10-05'), { y: 2026, m: 10, d: 5 }); eq(C.parseDate('10/05/2026', 'MDY'), { y: 2026, m: 10, d: 5 });
eq(C.parseDate('10/05/2026', 'DMY'), { y: 2026, m: 5, d: 10 }); eq(C.parseDate('5 Oct 2026'), { y: 2026, m: 10, d: 5 });
eq(C.parseDate('Oct 5, 2026'), { y: 2026, m: 10, d: 5 }); eq(C.parseDate('05-Oct-26'), { y: 2026, m: 10, d: 5 });
eq(C.parseDate('20261005'), { y: 2026, m: 10, d: 5 }); eq(C.parseDate('31/02/2026', 'DMY'), null); eq(C.parseDate('hello'), null);
eq(C.parseDate('2026-10-05 14:22:01'), { y: 2026, m: 10, d: 5 });
eq(C.detectDateOrder(['01/02/2026', '25/02/2026']), 'DMY'); eq(C.detectDateOrder(['01/02/2026', '02/25/2026']), 'MDY');
// csv
eq(C.parseCSV('a;b;c\n1;"x;y";3\n'), [['a', 'b', 'c'], ['1', 'x;y', '3']]);
eq(C.parseCSV('a,b\r\n"line\nbreak","q""q"\r\n'), [['a', 'b'], ['line\nbreak', 'q"q']]);

// sample statement end to end
const rows = C.parseCSV(fs.readFileSync(path.join(__dirname, '../samples/sample-statement.csv'), 'utf8'));
const a = C.analyse(rows);
eq(a.headerIdx, 3); eq(a.map.date, 0); eq(a.map.description, 1); eq(a.map.debit, 2); eq(a.map.credit, 3); eq(a.map.balance, 4); eq(a.map.amount, -1);
const { transactions, skipped } = C.toTransactions(a.body, { map: a.map, dateOrder: a.dateOrder });
eq(transactions.length, 19); eq(skipped.length, 1);
eq(transactions[0].amount, 2316.4); eq(transactions[1].amount, -1850);
const total = transactions.reduce((s, t) => s + t.amount, 0);
assert.ok(Math.abs(12480.15 + total - 13475.90) < 0.005, 'balances reconcile');
const qbo = C.buildOFX(transactions, { format: 'qbo', accountId: '4821', intuBid: '3000', org: 'Northgate', currency: 'CAD', now: new Date(2026, 10, 21) });
assert.ok(qbo.startsWith('OFXHEADER:100\r\nDATA:OFXSGML\r\nVERSION:102'));
assert.ok(qbo.includes('<INTU.BID>3000')); assert.ok(qbo.includes('<CURDEF>CAD')); assert.ok(qbo.includes('<BALAMT>13475.90'));
eq((qbo.match(/<STMTTRN>/g) || []).length, 19); eq((qbo.match(/<\/STMTTRN>/g) || []).length, 19);
const ids = qbo.match(/<FITID>.*/g); eq(new Set(ids).size, 19);
assert.ok(qbo.includes('<DTSTART>20261002120000') && qbo.includes('<DTEND>20261030120000'));
assert.ok(/^[\x00-\x7f]*$/.test(qbo), 'ascii only');
// same input twice gives the same ids (QuickBooks de-duplicates on FITID)
eq(C.buildOFX(transactions, { now: new Date(2026, 10, 21) }), C.buildOFX(transactions, { now: new Date(2026, 10, 21) }));
// duplicates on one day stay distinct; escaping; credit card; plain ofx
const dup = [{ date: { y: 2026, m: 1, d: 2 }, amount: -4.5, description: 'Café & <Bar> Zürich with a very long merchant name here', memo: '', check: '', balance: null }];
dup.push(Object.assign({}, dup[0]));
const cc = C.buildOFX(dup, { format: 'ofx', accountType: 'CREDITCARD', accountId: '1111' });
assert.ok(cc.includes('<CCACCTFROM>') && !cc.includes('INTU.BID') && cc.includes('Cafe &amp; &lt;Bar&gt; Zurich'));
eq(new Set(cc.match(/<FITID>.*/g)).size, 2); assert.ok(cc.includes('<MEMO>Cafe'));
// single signed amount column, no header, semicolons, European numbers
const eu = C.parseCSV('02.01.2026;Miete;-1.200,00\n15.01.2026;Gehalt;3.450,10\n');
const ea = C.analyse(eu); eq(ea.headerIdx, -1); eq(ea.map.date, 0); eq(ea.map.amount, 2); eq(ea.map.description, 1);
const et = C.toTransactions(ea.body, { map: ea.map, dateOrder: ea.dateOrder }).transactions;
eq(et.map(t => t.amount), [-1200, 3450.1]); eq(et[1].date, { y: 2026, m: 1, d: 15 });
// flip sign for card exports that list charges as positive
eq(C.toTransactions(ea.body, { map: ea.map, dateOrder: 'DMY', flipSign: true }).transactions[0].amount, 1200);
console.log('all converter tests passed');
