(() => {
'use strict';
const $ = s => document.querySelector(s), form = $('#editor'), list = $('#items'), KEY = 'qb.doc.v1';
const today = () => new Date().toISOString().slice(0,10);
const plus = (d,n) => {const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const example = () => ({kind:'Quote',fromName:'Rayhan, Web Development',fromEmail:'',fromAddr:'Edmonton, Alberta',toName:'Mill Creek Plumbing',toEmail:'',toAddr:'Edmonton, Alberta',number:'Q-2026-014',date:today(),due:plus(today(),30),currency:'CAD',taxName:'GST',taxRate:5,discType:'pct',discVal:0,deposit:50,
  notes:'50% deposit to start, balance due at launch.\nIncludes two rounds of revisions. Quote valid for 30 days.',
  items:[{d:'Website design and build, 5 pages',q:1,r:1200},{d:'Quote request form with email alerts',q:1,r:250},{d:'Google Business Profile setup',q:1,r:150},{d:'Monthly care plan: updates, backups, fixes',q:3,r:60}]});
const blank = () => ({...example(),toName:'',toAddr:'',number:'',notes:'',deposit:0,items:[{d:'',q:1,r:0}]});
let doc = load();

function load(){
  try{if(location.hash.length>1){const d=JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));history.replaceState(null,'',location.pathname);const m={...example(),...d};try{localStorage.setItem(KEY,JSON.stringify(m))}catch(e){}return m}}catch(e){}
  try{const s=localStorage.getItem(KEY);if(s)return{...example(),...JSON.parse(s)}}catch(e){}
  return example();
}
const save = () => {try{localStorage.setItem(KEY,JSON.stringify(doc))}catch(e){}};
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = n => {try{return new Intl.NumberFormat('en-CA',{style:'currency',currency:doc.currency}).format(n||0)}catch(e){return(n||0).toFixed(2)}};
const n = v => {const x=parseFloat(v);return isFinite(x)?x:0};
const dateStr = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'}):'';

function fillForm(){
  for(const el of form.elements){if(!el.name||el.name==='kind')continue;if(el.name in doc)el.value=doc[el.name]}
  form.querySelector(`[name=kind][value=${doc.kind}]`).checked=true;
  renderItems();
}
function renderItems(){
  list.innerHTML=doc.items.map((it,i)=>`<li class="item" data-i="${i}" draggable="false">
    <button class="handle" type="button" aria-label="Move line ${i+1}" title="Drag to reorder, or use arrow keys"><svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/></g></svg></button>
    <input class="desc" data-k="d" value="${esc(it.d)}" aria-label="Description, line ${i+1}" placeholder="What you will deliver">
    <input class="qty" data-k="q" type="number" min="0" step="any" inputmode="decimal" value="${it.q}" aria-label="Quantity, line ${i+1}">
    <input class="rate" data-k="r" type="number" min="0" step="0.01" inputmode="decimal" value="${it.r}" aria-label="Rate, line ${i+1}">
    <span class="amt">${fmt(n(it.q)*n(it.r))}</span>
    <button class="del" type="button" aria-label="Remove line ${i+1}" ${doc.items.length<2?'disabled':''}>×</button></li>`).join('');
}
function totals(){
  const sub=doc.items.reduce((a,it)=>a+n(it.q)*n(it.r),0);
  const disc=Math.min(sub,doc.discType==='pct'?sub*n(doc.discVal)/100:n(doc.discVal));
  const tax=(sub-disc)*n(doc.taxRate)/100,total=sub-disc+tax,dep=total*n(doc.deposit)/100;
  return{sub,disc,tax,total,dep};
}
function renderPaper(){
  const t=totals(),inv=doc.kind==='Invoice',e=(v,f)=>v?esc(v):`<span class="empty">${f}</span>`;
  $('#dueLabel').textContent=inv?'Due date':'Valid until';
  $('#paper').innerHTML=`
  <div class="doc-h"><div><p class="doc-title">${doc.kind}</p></div>
    <div class="doc-meta">${doc.number?`<span>No. <b>${esc(doc.number)}</b></span>`:''}${doc.date?`<span>Issued <b>${dateStr(doc.date)}</b></span>`:''}${doc.due?`<span>${inv?'Due':'Valid until'} <b>${dateStr(doc.due)}</b></span>`:''}</div></div>
  <div class="parties">
    <div><h3>From</h3><p class="name">${e(doc.fromName,'Your name')}</p><p>${esc(doc.fromAddr)}</p><p>${esc(doc.fromEmail)}</p></div>
    <div><h3>${inv?'Bill to':'Prepared for'}</h3><p class="name">${e(doc.toName,'Client name')}</p><p>${esc(doc.toAddr)}</p><p>${esc(doc.toEmail)}</p></div>
  </div>
  <table class="lines"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
  ${doc.items.map(it=>`<tr><td>${e(it.d,'Line item')}</td><td>${n(it.q)}</td><td>${fmt(n(it.r))}</td><td>${fmt(n(it.q)*n(it.r))}</td></tr>`).join('')}
  </tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>${fmt(t.sub)}</span></div>
    ${t.disc?`<div><span>Discount${doc.discType==='pct'?` (${n(doc.discVal)}%)`:''}</span><span>−${fmt(t.disc)}</span></div>`:''}
    ${n(doc.taxRate)?`<div><span>${esc(doc.taxName||'Tax')} (${n(doc.taxRate)}%)</span><span>${fmt(t.tax)}</span></div>`:''}
    <div class="grand"><span>Total ${esc(doc.currency)}</span><span>${fmt(t.total)}</span></div>
    ${t.dep?`<div class="dep"><span>${inv?'Deposit due':'Deposit to start'} (${n(doc.deposit)}%)</span><span>${fmt(t.dep)}</span></div>`:''}
  </div>
  ${doc.notes?`<div class="notes">${esc(doc.notes)}</div>`:''}`;
  document.title=`${doc.kind}${doc.number?' '+doc.number:''} | Quote Builder`;
}
function update(){renderPaper();save();list.querySelectorAll('.item').forEach((li,i)=>{const it=doc.items[i];li.querySelector('.amt').textContent=fmt(n(it.q)*n(it.r))})}

form.addEventListener('input',e=>{
  const el=e.target;
  if(el.dataset.k){const i=+el.closest('.item').dataset.i;doc.items[i][el.dataset.k]=el.dataset.k==='d'?el.value:el.value}
  else if(el.name){doc[el.name]=el.value}
  update();
});
form.addEventListener('submit',e=>e.preventDefault());
$('#addItem').addEventListener('click',()=>{doc.items.push({d:'',q:1,r:0});renderItems();update();list.lastElementChild.querySelector('.desc').focus()});
list.addEventListener('click',e=>{const b=e.target.closest('.del');if(!b||doc.items.length<2)return;doc.items.splice(+b.closest('.item').dataset.i,1);renderItems();update()});
list.addEventListener('keydown',e=>{const h=e.target.closest('.handle');if(!h||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const i=+h.closest('.item').dataset.i,j=i+(e.key==='ArrowUp'?-1:1);if(j<0||j>=doc.items.length)return;move(i,j);list.children[j].querySelector('.handle').focus()});
function move(i,j){const[x]=doc.items.splice(i,1);doc.items.splice(j,0,x);renderItems();update()}
let from=null;
list.addEventListener('pointerdown',e=>{const h=e.target.closest('.handle');if(h)h.closest('.item').draggable=true});
list.addEventListener('dragstart',e=>{const li=e.target.closest('.item');from=+li.dataset.i;li.classList.add('dragging');e.dataTransfer.effectAllowed='move'});
list.addEventListener('dragover',e=>{e.preventDefault();list.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));e.target.closest('.item')?.classList.add('over')});
list.addEventListener('drop',e=>{e.preventDefault();const li=e.target.closest('.item');if(li&&from!==null)move(from,+li.dataset.i);from=null});
list.addEventListener('dragend',()=>{from=null;renderItems()});
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}
$('#share').addEventListener('click',async()=>{const url=location.href.split('#')[0]+'#'+btoa(unescape(encodeURIComponent(JSON.stringify(doc))));
  try{await navigator.clipboard.writeText(url);toast('Share link copied')}catch(e){prompt('Copy this link',url)}});
$('#print').addEventListener('click',()=>window.print());
$('#newDoc').addEventListener('click',()=>{if(!confirm('Start a new blank document? The current one will be cleared.'))return;doc=blank();fillForm();update();toast('New document started')});
fillForm();renderPaper();
})();
