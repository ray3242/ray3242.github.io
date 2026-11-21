(() => {
'use strict';
const $ = s => document.querySelector(s);
const FIELDS = {date:['date','order_date','day','created','timestamp'],region:['region','province','state','area','territory'],category:['category','segment','department','type'],product:['product','item','sku','name','product_name'],units:['units','qty','quantity','count'],unit_price:['unit_price','price','unitprice','rate'],revenue:['revenue','sales','amount','total','net_sales'],channel:['channel','source','store','medium'],order_id:['order_id','order','id','invoice']};
const LABELS = {date:'Date',region:'Region',category:'Category',product:'Product',units:'Units',unit_price:'Unit price',revenue:'Revenue',channel:'Channel',order_id:'Order ID'};
const money = n => n.toLocaleString('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:n>=1000?0:2});
const num = n => Math.round(n).toLocaleString('en-CA');
let headers = [], raw = [], map = {}, rows = [], sortKey = 'revenue', sortDir = -1;

function parseCSV(text){
  const out=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===','){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);f='';if(row.some(v=>v!==''))out.push(row);row=[]}
    else f+=c}
  row.push(f);if(row.some(v=>v!==''))out.push(row);return out;
}
function guess(){map={};const low=headers.map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
  for(const[k,al]of Object.entries(FIELDS)){const i=low.findIndex(h=>al.includes(h));map[k]=i>=0?i:-1}}
function parseDate(v){if(!v)return null;const d=new Date(v.length===10?v+'T00:00:00':v);return isNaN(d)?null:d}
const toNum = v => {const n=parseFloat(String(v??'').replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n};
function build(){
  const g=(r,k)=>map[k]>=0?r[map[k]]:'';
  rows=raw.map(r=>{const units=map.units>=0?toNum(g(r,'units')):1;const rev=map.revenue>=0?toNum(g(r,'revenue')):units*toNum(g(r,'unit_price'));
    return{date:parseDate(g(r,'date')),region:g(r,'region')||'Unassigned',category:g(r,'category')||'Unassigned',product:g(r,'product')||'Unnamed',channel:g(r,'channel')||'Unassigned',units,rev,id:g(r,'order_id')}}).filter(r=>r.date);
  const ds=rows.map(r=>+r.date);const min=new Date(Math.min(...ds)),max=new Date(Math.max(...ds));
  $('#from').value=iso(min);$('#to').value=iso(max);$('#from').min=$('#to').min=iso(min);$('#from').max=$('#to').max=iso(max);
  fill('#fRegion','region','All regions');fill('#fCat','category','All categories');fill('#fChan','channel','All channels');
  const missing=['date','revenue'].filter(k=>map[k]<0&&!(k==='revenue'&&map.unit_price>=0));
  $('#mapHint').textContent=missing.length?`· check: ${missing.map(k=>LABELS[k]).join(', ')}`:`· ${Object.values(map).filter(i=>i>=0).length} of ${Object.keys(FIELDS).length} matched`;
  renderMap();render();
}
const iso = d => d.toISOString().slice(0,10);
function fill(sel,key,all){const vals=[...new Set(rows.map(r=>r[key]))].sort();$(sel).innerHTML=`<option value="">${all}</option>`+vals.map(v=>`<option>${esc(v)}</option>`).join('')}
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function renderMap(){$('#mapRow').innerHTML=Object.keys(FIELDS).map(k=>`<label>${LABELS[k]}<select data-k="${k}"><option value="-1">Not in file</option>${headers.map((h,i)=>`<option value="${i}" ${map[k]===i?'selected':''}>${esc(h)}</option>`).join('')}</select></label>`).join('');}
$('#mapRow').addEventListener('change',e=>{if(e.target.dataset.k){map[e.target.dataset.k]=+e.target.value;build()}});

function filtered(from,to){const r=$('#fRegion').value,c=$('#fCat').value,ch=$('#fChan').value;
  return rows.filter(x=>x.date>=from&&x.date<=to&&(!r||x.region===r)&&(!c||x.category===c)&&(!ch||x.channel===ch))}
function totals(list){const rev=list.reduce((a,x)=>a+x.rev,0),units=list.reduce((a,x)=>a+x.units,0);const ord=map.order_id>=0?new Set(list.map(x=>x.id)).size:list.length;return{rev,units,ord,aov:ord?rev/ord:0}}
function delta(el,cur,prev){if(!prev){el.textContent='';el.className='';return}const p=(cur-prev)/prev*100;el.textContent=`${p>=0?'▲':'▼'} ${Math.abs(p).toFixed(1)}% vs previous period`;el.className=p>=0?'up':'down'}
function group(list,key){const m=new Map();for(const x of list){const k=typeof key==='function'?key(x):x[key];const o=m.get(k)||{name:k,rev:0,units:0,orders:0};o.rev+=x.rev;o.units+=x.units;o.orders++;m.set(k,o)}return[...m.values()]}

function render(){
  if(!rows.length)return;
  const from=parseDate($('#from').value),to=parseDate($('#to').value);to.setHours(23,59,59);
  const cur=filtered(from,to),span=to-from,prev=filtered(new Date(+from-span-1),new Date(+from-1));
  const t=totals(cur),p=totals(prev);
  $('#kRev').textContent=money(t.rev);$('#kOrd').textContent=num(t.ord);$('#kAov').textContent=money(t.aov);$('#kUnits').textContent=num(t.units);
  delta($('#dRev'),t.rev,p.rev);delta($('#dOrd'),t.ord,p.ord);delta($('#dAov'),t.aov,p.aov);delta($('#dUnits'),t.units,p.units);
  const months=group(cur,x=>x.date.toISOString().slice(0,7)).sort((a,b)=>a.name<b.name?-1:1);
  drawTrend(months);
  const cats=group(cur,'category').sort((a,b)=>b.rev-a.rev);drawDonut(cats,t.rev);
  const regs=group(cur,'region').sort((a,b)=>b.rev-a.rev),top=regs[0]?.rev||1;
  $('#regions').innerHTML=regs.map(r=>`<div class="barrow"><span>${esc(r.name)}</span><div class="track"><i style="width:${(r.rev/top*100).toFixed(1)}%"></i></div><b>${short(r.rev)}</b></div>`).join('')||'<p class="muted">No rows match these filters.</p>';
  const prods=group(cur,'product').map(x=>({...x,revenue:x.rev,share:t.rev?x.rev/t.rev:0}));
  prods.sort((a,b)=>{const A=a[sortKey],B=b[sortKey];return(typeof A==='string'?A.localeCompare(B):A-B)*sortDir});
  $('#tbl tbody').innerHTML=prods.slice(0,50).map(x=>`<tr><td>${esc(x.name)}</td><td>${num(x.orders)}</td><td>${num(x.units)}</td><td>${money(x.revenue)}</td><td><span class="share"><i style="width:${(x.share*100).toFixed(1)}%"></i></span>${(x.share*100).toFixed(1)}%</td></tr>`).join('');
  document.querySelectorAll('#tbl th').forEach(th=>{th.setAttribute('aria-sort',th.dataset.k===sortKey?(sortDir>0?'ascending':'descending'):'none')});
  insights(cur,months,regs,cats,prods,t,p);
  window.__view=cur;
}
function insights(cur,months,regs,cats,prods,t,p){
  const li=[];if(!cur.length){$('#insights').innerHTML='<li>No rows match these filters. Widen the date range or clear a filter.</li>';return}
  if(p.rev)li.push(`Revenue is <b>${t.rev>=p.rev?'up':'down'} ${Math.abs((t.rev-p.rev)/p.rev*100).toFixed(1)}%</b> on the previous period of the same length.`);
  if(months.length>1){const best=months.reduce((a,b)=>b.rev>a.rev?b:a);li.push(`Best month: <b>${monthName(best.name)}</b> at ${money(best.rev)}.`)}
  if(regs.length>1)li.push(`<b>${esc(regs[0].name)}</b> leads regions with ${(regs[0].rev/t.rev*100).toFixed(1)}% of revenue; <b>${esc(regs.at(-1).name)}</b> is lowest at ${(regs.at(-1).rev/t.rev*100).toFixed(1)}%.`);
  const top=[...prods].sort((a,b)=>b.rev-a.rev);if(top.length){const n=Math.max(1,Math.ceil(top.length*.2)),s=top.slice(0,n).reduce((a,x)=>a+x.rev,0);li.push(`The top ${n} of ${top.length} products bring in <b>${(s/t.rev*100).toFixed(0)}%</b> of revenue. Led by ${esc(top[0].name)}.`)}
  if(cats.length)li.push(`<b>${esc(cats[0].name)}</b> is the largest category at ${money(cats[0].rev)}.`);
  const ch=group(cur,'channel').map(c=>({...c,aov:c.rev/c.orders})).sort((a,b)=>b.aov-a.aov);if(ch.length>1)li.push(`<b>${esc(ch[0].name)}</b> orders average ${money(ch[0].aov)}, the highest of any channel.`);
  $('#insights').innerHTML=li.map(x=>`<li>${x}</li>`).join('');
}
const monthName = k => new Date(k+'-01T00:00:00').toLocaleDateString('en-CA',{month:'long',year:'numeric'});
function ctx(c){const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;const x=c.getContext('2d');x.scale(d,d);return[x,r.width,r.height]}
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let trendPts=[];
function drawTrend(months){
  const c=$('#trend'),[x,w,h]=ctx(c),pad={l:56,r:16,t:16,b:28};x.clearRect(0,0,w,h);trendPts=[];
  $('#trendNote').textContent=months.length?`${monthName(months[0].name)} to ${monthName(months.at(-1).name)}`:'';
  if(!months.length)return;
  const max=Math.max(...months.map(m=>m.rev))*1.1,iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;
  x.font='12px Inter, system-ui, sans-serif';x.fillStyle=css('--muted');x.strokeStyle=css('--border');x.lineWidth=1;
  for(let i=0;i<=4;i++){const y=pad.t+ih-ih*i/4;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.textAlign='right';x.fillText(short(max*i/4),pad.l-8,y+4)}
  const X=i=>pad.l+(months.length===1?iw/2:iw*i/(months.length-1)),Y=v=>pad.t+ih-ih*v/max;
  const step=Math.ceil(months.length/8);x.textAlign='center';months.forEach((m,i)=>{if(i%step===0)x.fillText(new Date(m.name+'-01T00:00:00').toLocaleDateString('en-CA',{month:'short',year:'2-digit'}),X(i),h-8)});
  const g=x.createLinearGradient(0,pad.t,0,pad.t+ih);g.addColorStop(0,'rgba(45,212,191,.35)');g.addColorStop(1,'rgba(45,212,191,0)');
  x.beginPath();months.forEach((m,i)=>i?x.lineTo(X(i),Y(m.rev)):x.moveTo(X(i),Y(m.rev)));x.lineTo(X(months.length-1),pad.t+ih);x.lineTo(X(0),pad.t+ih);x.fillStyle=g;x.fill();
  x.beginPath();months.forEach((m,i)=>i?x.lineTo(X(i),Y(m.rev)):x.moveTo(X(i),Y(m.rev)));x.strokeStyle=css('--a');x.lineWidth=2.5;x.lineJoin='round';x.stroke();
  months.forEach((m,i)=>{trendPts.push({x:X(i),y:Y(m.rev),m});x.beginPath();x.arc(X(i),Y(m.rev),3,0,7);x.fillStyle=css('--a');x.fill()});
}
const short = n => n>=1e6?'$'+(n/1e6).toFixed(1)+'M':n>=1e3?'$'+(n/1e3).toFixed(0)+'k':'$'+n.toFixed(0);
$('#trend').addEventListener('mousemove',e=>{const r=e.target.getBoundingClientRect(),mx=e.clientX-r.left;let best=null,d=1e9;for(const p of trendPts){const dd=Math.abs(p.x-mx);if(dd<d){d=dd;best=p}}const tip=$('#tip');if(!best||d>40){tip.style.opacity=0;return}tip.innerHTML=`<b>${monthName(best.m.name)}</b>${money(best.m.rev)} · ${num(best.m.orders)} orders`;tip.style.left=best.x+'px';tip.style.top=best.y+'px';tip.style.opacity=1});
$('#trend').addEventListener('mouseleave',()=>$('#tip').style.opacity=0);
const PAL=['#2dd4bf','#fbbf24','#60a5fa','#f87171','#34d399','#fb923c','#e5e7eb','#94a3b8'];
function drawDonut(cats,total){
  const c=$('#cats'),[x,w,h]=ctx(c);x.clearRect(0,0,w,h);if(!total)return;
  const R=Math.min(h/2-8,w/4),cx=R+12,cy=h/2;let a=-Math.PI/2;
  cats.forEach((k,i)=>{const s=k.rev/total*Math.PI*2;x.beginPath();x.arc(cx,cy,R,a,a+s);x.arc(cx,cy,R*.62,a+s,a,true);x.closePath();x.fillStyle=PAL[i%PAL.length];x.fill();a+=s});
  x.fillStyle=css('--text');x.textAlign='center';x.font='600 15px Inter, system-ui, sans-serif';x.fillText(short(total),cx,cy+5);
  x.textAlign='left';x.font='13px Inter, system-ui, sans-serif';const lx=cx+R+24;
  cats.slice(0,8).forEach((k,i)=>{const y=cy-(Math.min(cats.length,8)-1)*12+i*24;x.fillStyle=PAL[i%PAL.length];x.fillRect(lx,y-9,10,10);x.fillStyle=css('--text');x.fillText(`${k.name}  ${(k.rev/total*100).toFixed(1)}%`,lx+18,y)});
}
function load(text,name){
  const data=parseCSV(text.replace(/^\uFEFF/,''));if(data.length<2){alert('That file has no data rows. Choose a CSV with a header row and at least one row of data.');return}
  headers=data[0];raw=data.slice(1);guess();$('#srcName').textContent=name;build();
  if(!rows.length){$('#mapping').open=true;$('#insights').innerHTML='<li>No dates were recognised. Pick the date column under Column mapping.</li>'}
}
function readFile(f){if(!f)return;const r=new FileReader();r.onload=()=>load(r.result,f.name);r.readAsText(f)}
$('#file').addEventListener('change',e=>readFile(e.target.files[0]));
$('#sample').addEventListener('click',loadSample);
function loadSample(){fetch('sample-sales.csv').then(r=>r.text()).then(t=>load(t,'Synthetic data: Northern Roast Co.'))}
['#from','#to','#fRegion','#fCat','#fChan'].forEach(s=>$(s).addEventListener('change',render));
$('#reset').addEventListener('click',()=>{['#fRegion','#fCat','#fChan'].forEach(s=>$(s).value='');$('#from').value=$('#from').min;$('#to').value=$('#to').max;render()});
document.querySelectorAll('#tbl th').forEach(th=>{th.tabIndex=0;const go=()=>{const k=th.dataset.k;sortDir=sortKey===k?-sortDir:(k==='name'?1:-1);sortKey=k;render()};th.addEventListener('click',go);th.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})});
$('#export').addEventListener('click',()=>{const v=window.__view||[];const q=s=>/[",\n]/.test(s)?`"${String(s).replace(/"/g,'""')}"`:s;
  const csv=['date,region,category,product,channel,units,revenue',...v.map(x=>[iso(x.date),x.region,x.category,x.product,x.channel,x.units,x.rev.toFixed(2)].map(q).join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='filtered-sales.csv';a.click();URL.revokeObjectURL(a.href)});
let dc=0;const drop=$('#drop');
addEventListener('dragenter',e=>{e.preventDefault();dc++;drop.style.display='grid'});
addEventListener('dragleave',()=>{if(--dc<=0){dc=0;drop.style.display='none'}});
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();dc=0;drop.style.display='none';readFile(e.dataTransfer.files[0])});
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(render,120)});
loadSample();
})();
