/* Qbodrop page logic: file in, mapping, preview, licence, download. */
(function () {
  'use strict';
  const C = window.QboCore, CFG = Object.assign({ gumroadUrl: '', gumroadProductId: '', price: '$29', freeRows: 10 }, window.QBODROP_CONFIG || {});
  const $ = id => document.getElementById(id);
  const paid = !!(CFG.gumroadUrl && CFG.gumroadProductId);
  const KEY = 'qbodrop.licence';
  let state = null, unlocked = !paid;

  /* pricing copy follows the config */
  document.querySelectorAll('[data-price]').forEach(e => { e.textContent = CFG.price; });
  document.querySelectorAll('[data-free-line]').forEach(e => { e.textContent = 'The first ' + CFG.freeRows + ' transactions of each file'; });
  if (paid) {
    document.querySelectorAll('[data-buy]').forEach(a => { a.href = CFG.gumroadUrl; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Buy the full version'; });
    document.querySelectorAll('[data-plan-note]').forEach(e => { e.textContent = 'Key delivered by email at checkout'; });
    $('k-buy').href = CFG.gumroadUrl;
    $('k-buy').textContent = 'Buy a key for ' + CFG.price;
    const saved = safeGet(KEY);
    if (saved) verify(saved, true);
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  async function verify(key, quiet) {
    const st = $('k-status');
    if (!quiet) { st.className = ''; st.textContent = 'Checking the key.'; }
    try {
      const res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ product_id: CFG.gumroadProductId, license_key: key.trim(), increment_uses_count: 'false' })
      });
      const data = await res.json();
      const p = data.purchase || {};
      if (data.success && !p.refunded && !p.chargebacked && !p.disputed) {
        unlocked = true; safeSet(KEY, key.trim());
        st.className = 'is-ok'; st.textContent = 'Key accepted. Whole statements are unlocked in this browser.';
      } else {
        if (quiet) safeSet(KEY, null);
        st.className = 'is-bad'; st.textContent = 'That key was not recognised. Copy it from your Gumroad receipt and try again.';
      }
    } catch (e) {
      if (quiet && safeGet(KEY)) unlocked = true; /* offline with a key that was accepted before */
      else { st.className = 'is-bad'; st.textContent = 'The key could not be checked. Check your connection and try again.'; }
    }
    if (state) render();
  }
  $('k-apply').addEventListener('click', () => { const v = $('k-input').value; if (v.trim()) verify(v, false); else $('k-input').focus(); });
  $('k-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('k-apply').click(); } });

  /* file in */
  const drop = $('qd-drop'), input = $('qd-file');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readFile(f); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());
  input.addEventListener('change', () => { if (input.files[0]) readFile(input.files[0]); input.value = ''; });
  document.querySelectorAll('[data-try-sample]').forEach(b => b.addEventListener('click', async () => {
    try {
      const text = await (await fetch('samples/sample-statement.csv')).text();
      load(C.parseCSV(text), 'sample-statement.csv', { currency: 'CAD', acct: '4821' });
    } catch (e) { fail('The sample could not be loaded. Check your connection and try again.'); }
  }));
  $('qd-reset').addEventListener('click', reset);

  function fail(msg) { const e = $('qd-error'); e.textContent = msg; e.hidden = false; }
  function loadScript(src) {
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  async function readFile(file) {
    $('qd-error').hidden = true;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      if (file.size > 25 * 1024 * 1024) return fail('That file is over 25 MB. Export a shorter date range and try again.');
      if (ext === 'pdf') return fail('PDF statements are not supported. Download the CSV or Excel export from online banking instead.');
      let rows;
      if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') {
        if (!window.XLSX) await loadScript('vendor/xlsx.full.min.js');
        rows = sheetRows(await file.arrayBuffer());
      } else {
        const buf = await file.arrayBuffer();
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('windows-1252').decode(buf); }
        if (/^PK\u0003\u0004/.test(text)) { if (!window.XLSX) await loadScript('vendor/xlsx.full.min.js'); rows = sheetRows(buf); }
        else rows = C.parseCSV(text);
      }
      load(rows, file.name, {});
    } catch (e) { fail('That file could not be read. Export it again from your bank as CSV or Excel.'); }
  }
  function sheetRows(buf) {
    const X = window.XLSX, wb = X.read(buf, { type: 'array', cellNF: true });
    let best = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]; if (!ws['!ref']) continue;
      const r = X.utils.decode_range(ws['!ref']), rows = [];
      for (let R = r.s.r; R <= r.e.r; R++) {
        const row = [];
        for (let Cc = r.s.c; Cc <= r.e.c; Cc++) {
          const cell = ws[X.utils.encode_cell({ r: R, c: Cc })];
          if (!cell || cell.v == null) row.push('');
          else if (cell.t === 'n' && cell.z && X.SSF.is_date(cell.z)) row.push(X.SSF.format('yyyy-mm-dd', cell.v));
          else if (cell.t === 'n') row.push(String(Math.round(cell.v * 1e6) / 1e6));
          else if (cell.t === 'd') row.push(cell.v.toISOString().slice(0, 10));
          else row.push(String(cell.w != null && cell.t !== 's' ? cell.w : cell.v).trim());
        }
        if (row.some(c => c !== '')) rows.push(row);
      }
      if (rows.length > best.length) best = rows;
    }
    return best;
  }

  function load(rows, name, preset) {
    const a = C.analyse(rows);
    const probe = C.toTransactions(a.body, { map: a.map, dateOrder: a.dateOrder });
    if (!rows.length || a.map.date < 0 || !probe.transactions.length) {
      return fail('No transactions were found in that file. It needs a date column and an amount column.');
    }
    state = { name, headers: a.headers, body: a.body, map: Object.assign({}, a.map), dateOrder: a.dateOrder };
    for (const sel of document.querySelectorAll('[data-map]')) {
      sel.innerHTML = '';
      sel.add(new Option('Not in this file', '-1'));
      a.headers.forEach((h, i) => sel.add(new Option(h, String(i))));
      sel.value = String(state.map[sel.dataset.map]);
    }
    $('o-order').value = state.dateOrder; $('o-flip').checked = false;
    if (preset.currency) $('o-cur').value = preset.currency;
    if (preset.acct) $('o-acct').value = preset.acct;
    $('qd-empty').hidden = true; $('qd-loaded').hidden = false; $('qd-reset').hidden = false; $('qd-error').hidden = true;
    render();
    $('convert').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function reset() {
    state = null;
    $('qd-empty').hidden = false; $('qd-loaded').hidden = true; $('qd-reset').hidden = true;
    $('qd-name').textContent = 'No file yet'; $('qd-sub').textContent = 'CSV, TXT, XLSX or XLS';
    drop.focus();
  }

  const money = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const p2 = n => String(n).padStart(2, '0');
  const iso = d => d.y + '-' + p2(d.m) + '-' + p2(d.d);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const short = d => d.d + ' ' + MON[d.m - 1] + ' ' + String(d.y).slice(2);
  const fmt = () => document.querySelector('input[name=fmt]:checked').value;
  function current() {
    const r = C.toTransactions(state.body, { map: state.map, dateOrder: $('o-order').value, flipSign: $('o-flip').checked });
    r.transactions.sort((a, b) => iso(a.date).localeCompare(iso(b.date)));
    return r;
  }
  function render() {
    const { transactions: tx, skipped } = current();
    const limit = unlocked ? tx.length : Math.min(CFG.freeRows, tx.length);
    $('qd-name').textContent = state.name;
    $('qd-sub').textContent = tx.length + (tx.length === 1 ? ' transaction' : ' transactions');
    $('st-count').textContent = tx.length.toLocaleString('en-US');
    $('st-range').textContent = tx.length ? short(tx[0].date) + ' to ' + short(tx[tx.length - 1].date) : 'None';
    $('st-range').title = tx.length ? iso(tx[0].date) + ' to ' + iso(tx[tx.length - 1].date) : '';
    $('st-in').textContent = money(tx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0));
    $('st-out').textContent = money(Math.abs(tx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)));
    const body = $('qd-rows'); body.textContent = '';
    tx.slice(0, 500).forEach((t, i) => {
      const tr = document.createElement('tr'); if (i >= limit) tr.className = 'is-locked';
      const cell = (text, cls) => { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; if (text.length > 30) td.title = text; tr.appendChild(td); };
      cell(iso(t.date), 'date'); cell(t.description || '(no description)'); cell(t.memo, 'hide-sm');
      cell((t.amount > 0 ? '+' : '') + money(t.amount), 'num' + (t.amount > 0 ? ' in' : ''));
      body.appendChild(tr);
    });
    const note = $('qd-note'), bits = [];
    if (tx.length > 500) bits.push('Showing the first 500 of ' + tx.length.toLocaleString('en-US') + ' transactions. The download holds them all.');
    if (skipped.length) bits.push('<b>' + skipped.length + (skipped.length === 1 ? ' row' : ' rows') + ' skipped</b> for having no date or no amount (headings, opening balances and totals).');
    note.innerHTML = bits.join(' '); note.hidden = !bits.length;
    const locked = paid && !unlocked && tx.length > limit;
    $('qd-key').hidden = !(paid && !unlocked);
    $('qd-foot-note').textContent = !tx.length ? 'No transactions with these columns. Pick the date and amount columns on the left.'
      : locked ? 'The free version saves the first ' + limit + ' of ' + tx.length + ' transactions. A licence key unlocks the rest.'
      : 'Ready. ' + tx.length + (tx.length === 1 ? ' transaction' : ' transactions') + ' will be saved.';
    const btn = $('qd-download');
    btn.disabled = !tx.length;
    btn.textContent = 'Download .' + fmt() + (locked ? ' (first ' + limit + ')' : '');
    $('o-bid').closest('label').hidden = fmt() !== 'qbo';
    $('o-bid-custom-row').hidden = fmt() !== 'qbo' || $('o-bid').value !== 'custom';
  }
  $('qd-form').addEventListener('input', onForm); $('qd-form').addEventListener('change', onForm);
  function onForm(e) {
    if (!state) return;
    const key = e.target.dataset && e.target.dataset.map;
    if (key) {
      state.map[key] = +e.target.value;
      if (key === 'amount' && state.map.amount >= 0) { state.map.debit = state.map.credit = -1; $('m-debit').value = $('m-credit').value = '-1'; }
      if ((key === 'debit' || key === 'credit') && state.map[key] >= 0) { state.map.amount = -1; $('m-amount').value = '-1'; }
    }
    render();
  }
  $('qd-download').addEventListener('click', () => {
    if (!state) return;
    const { transactions: tx } = current(); if (!tx.length) return;
    const out = unlocked ? tx : tx.slice(0, CFG.freeRows);
    const bid = $('o-bid').value === 'custom' ? ($('o-bid-custom').value.replace(/\D/g, '') || '3000') : $('o-bid').value;
    const last = out[out.length - 1];
    const text = C.buildOFX(out, {
      format: fmt(), accountType: $('o-type').value, accountId: $('o-acct').value || '0000', currency: $('o-cur').value,
      intuBid: bid, org: bid === '10898' ? 'Chase' : bid === '3000' ? 'Wells Fargo' : 'Bank', balance: last.balance != null ? last.balance : 0
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/vnd.intu.qbo' }));
    a.download = state.name.replace(/\.[^.]+$/, '') + '.' + fmt();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('qd-foot-note').textContent = 'Saved ' + a.download + ' with ' + out.length + (out.length === 1 ? ' transaction.' : ' transactions.');
  });
})();
