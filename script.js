/* ---------- Helpers ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const today = () => new Date().toISOString().slice(0,10);
const mkey  = (d) => (d||today()).slice(0,7);
const fmt2  = (n) => Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc   = (x) => String(x==null?'':x).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

let chart = null;

/* ---------- Data ---------- */
const CATS = [
  'Rent','Groceries','Investments','Utilities','Phone/Internet','Savings',
  'Subscriptions','Restaurants','Education','Hygiene','Transport','Clothes',
  'Medicine','Gifts','Pets','Hobbies','Home','Other'
];

const STORE_KEY = 'penny.v3';
const state = load() || {
  expenses: {},            // { mk: [ {id,date,cat,note,amt<0>} ] }
  income:   {},            // legacy totals { mk:number }
  incomeRows: {},          // history { mk: [ {id,date,amt>0} ] }
  limits:   {},            // { mk: { [cat]: percent } }
  jar:      {},            // { mk: { total:number } }
  wishlist: { items:[], activeGoalId:null }
};

function load(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)||''); } catch { return null; } }
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Month/Year ---------- */
(function initDateSelectors(){
  const msel = $('#month-select'), ysel = $('#year-select');
  if(!msel || !ysel) return;
  for(let m=0;m<12;m++){ const o=document.createElement('option'); o.value=String(m+1).padStart(2,'0'); o.textContent=new Date(2000,m,1).toLocaleString(undefined,{month:'long'}); msel.appendChild(o); }
  const nowY = new Date().getFullYear();
  for(let y=nowY-3;y<=nowY+1;y++){ const o=document.createElement('option'); o.value=y; o.textContent=y; ysel.appendChild(o); }
  const mk=mkey(); msel.value=mk.slice(5,7); ysel.value=mk.slice(0,4);
  msel.addEventListener('change', onDateChange);
  ysel.addEventListener('change', onDateChange);
})();
function currentKey(){ const y=$('#year-select')?.value||mkey().slice(0,4); const m=$('#month-select')?.value||mkey().slice(5,7); return `${y}-${m}`; }
function onDateChange(){ renderAll(); if($('.bt-tab.bt-active')?.dataset.tab==='limits'){ $('.card.entry-card')?.scrollIntoView({behavior:'smooth',block:'start'}); } }

/* ---------- Router ---------- */
(function router(){
  const SECTIONS = {
    home:    $('#home'),
    savings: $('#savings'),
    reports: $('#reports')
  };

  function reveal(route){
    
    Object.values(SECTIONS).forEach(s => {
      if (!s) return;
      s.classList.add('bt-hidden');
      s.style.display = 'none';
    });

    
    const tgt = SECTIONS[route] || SECTIONS.home;
    if (tgt) {
      tgt.classList.remove('bt-hidden');
      tgt.style.display = 'block';
    }

    
    $$('.bt-nav-btn').forEach(b => {
      b.setAttribute('aria-current', b.dataset.route === route ? 'page' : 'false');
    });

    
    window.scrollTo({ top: 0, behavior: 'instant' });

    
    if (route === 'home' && chart) {
      setTimeout(() => chart.resize(), 0);
    }

    
    if (route === 'reports' && window.renderPennyReports) {
      window.renderPennyReports();
    }
  }

  
  document.addEventListener('click', e => {
    const b = e.target.closest('.bt-nav-btn');
    if (!b) return;
    e.preventDefault();
    const r = b.dataset.route;
    try { history.replaceState(null, '', '#'+r); } catch {}
    reveal(r);
  });

  
  const init = (location.hash || '#home').slice(1);
  reveal(['home','savings','reports'].includes(init) ? init : 'home');

  
  window.addEventListener('hashchange', () => {
    const r = (location.hash || '#home').slice(1);
    reveal(['home','savings','reports'].includes(r) ? r : 'home');
  });
})();


/* ---------- Tabs ---------- */
(function tabs(){
  $$('.entry-card .bt-panel').forEach(p=> p.classList.toggle('bt-hidden', p.dataset.panel!=='expense'));
  document.addEventListener('click', (e)=>{
    const btn=e.target.closest('.bt-tab'); if(!btn) return; e.preventDefault();
    const tab=btn.dataset.tab;
    $$('.bt-tab').forEach(b=>{ b.classList.toggle('bt-active', b===btn); b.setAttribute('aria-selected', b===btn?'true':'false'); });
    $$('.entry-card .bt-panel').forEach(p=> p.classList.toggle('bt-hidden', p.dataset.panel!==tab));
    if(tab==='limits'){ $('.card.entry-card')?.scrollIntoView({behavior:'smooth',block:'start'}); refreshLimitsBrief(); }
  }, {passive:false});
})();

/* ---------- Categories select ---------- */
(function fillCategories(){
  const sel=$('#category'); if(!sel) return;
  sel.innerHTML=CATS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
})();

/* ---------- Expenses CRUD ---------- */
$('#expense-form')?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const amt=parseFloat($('#amount').value);
  const cat=$('#category').value;
  const note=$('#note').value.trim();
  if(!(amt>0) || !cat) return;
  const mk=currentKey();
  (state.expenses[mk] ||= []).push({ id:(crypto.randomUUID?.()||Math.random().toString(36).slice(2)), date:today(), cat, note, amt:-Math.abs(amt) });
  save(); e.target.reset(); renderAll();
});
$('#clear-data')?.addEventListener('click', ()=>{
  if(!confirm('Reset ALL data (all months)?')) return;
  localStorage.removeItem(STORE_KEY);
  Object.assign(state,{ expenses:{}, income:{}, incomeRows:{}, limits:{}, jar:{}, wishlist:{ items:[], activeGoalId:null } });
  renderAll();
});

/* ---------- Income (history; no double count) ---------- */
$('#add-income-btn')?.addEventListener('click', ()=>{
  const mk=currentKey(); const val=parseFloat($('#income-input').value); if(!(val>0)) return;
  (state.incomeRows[mk] ||= []).push({ id:(crypto.randomUUID?.()||Math.random().toString(36).slice(2)), date:today(), amt:Math.abs(val) });
  // legacy state.income[mk] НЕ чіпаємо
  save(); $('#income-input').value=''; renderAll();
});

/* ---------- Month data ---------- */
function getMonthData(mk){
  const rows = state.expenses[mk]||[];
  const incomeLegacy = state.income[mk] || 0;
  const incomeRows   = state.incomeRows[mk] || [];
  const incomeSum = incomeRows.length ? incomeRows.reduce((a,b)=>a+b.amt, 0) : incomeLegacy;
  const byCat = {}; rows.forEach(r=>{ byCat[r.cat]=(byCat[r.cat]||0)+r.amt; });
  const totalExp = rows.reduce((a,b)=>a+b.amt, 0); // negative
  return { rows, incomeRows, incomeSum, byCat, totalExp };
}

/* ---------- Expenses table ---------- */
function renderExpenses(){
  const mk=currentKey();
  const { rows }=getMonthData(mk);
  const body=$('#expense-body'), empty=$('#empty-expenses'), count=$('#expense-count'), grand=$('#grand-total');

  
  if (!body || !empty || !count || !grand) return;

  body.innerHTML=rows.map(r=>`
    <tr>
      <td>${r.date}</td><td>${esc(r.cat)}</td><td>${esc(r.note||'')}</td>
      <td class="right">${fmt2(r.amt)} CHF</td>
      <td class="right"><button class="ghost small" data-del="${r.id}">Delete</button></td>
    </tr>`).join('');
  count.textContent=`${rows.length} item${rows.length===1?'':'s'}`;
  grand.textContent=`${fmt2(rows.reduce((a,b)=>a+b.amt,0))} CHF`;
  empty.style.display=rows.length?'none':'block';
  body.addEventListener('click',(e)=>{
    const id=e.target?.dataset?.del; if(!id) return;
    state.expenses[mk]=(state.expenses[mk]||[]).filter(r=>r.id!==id); save(); renderAll();
  }, {once:true});
}

/* ---------- Incomes table ---------- */
function renderIncomes(){
  const mk=currentKey();
  const { incomeRows, incomeSum } = getMonthData(mk);
  const body=$('#income-body'), empty=$('#empty-incomes'), total=$('#income-total');

  
  if (!body || !empty || !total) return;
  body.innerHTML = (incomeRows||[]).map(r=>`
    <tr>
      <td>${r.date}</td>
      <td class="right">+${fmt2(r.amt)} CHF</td>
      <td class="right"><button class="ghost small" data-del-income="${r.id}">Delete</button></td>
    </tr>`).join('');
  total.textContent = `${fmt2(incomeSum)} CHF`;
  empty.style.display = incomeRows.length ? 'none' : 'block';

  body.addEventListener('click', e=>{
    const id = e.target?.dataset?.delIncome; if(!id) return;
    state.incomeRows[mk] = (state.incomeRows[mk]||[]).filter(r=>r.id!==id);
    save(); renderAll();
  }, { once:true });
}

/* ---------- Totals & Chart (Leftover + CHF tooltips + center label) ---------- */
function renderTotalsAndChart(){
  const mk=currentKey();
  const { byCat, totalExp, incomeSum } = getMonthData(mk);
  const jarTotal = state.jar[mk]?.total || 0;
  const leftover = incomeSum + totalExp - jarTotal; // expenses negative

  const entries = Object.entries(byCat).filter(([_,v])=>v!==0).sort((a,b)=>a[0].localeCompare(b[0]));
  const totals = $('#totals');
  const maxAbs = entries.reduce((mx,[,v])=>Math.max(mx,Math.abs(v)), 1);
  const sumAll = entries.reduce((a,[,v])=>a+v, 0);

  totals.innerHTML = entries.concat([['Total', sumAll]]).map(([k,v])=>{
    const width = Math.min(100, Math.abs(v)/maxAbs*100);
    return `<div class="line${k==='Total'?' total':''}">
      <div class="name" style="min-width:140px;">${esc(k)}</div>
      <div class="bar"><div style="width:${width}%"></div></div>
      <div class="amt">${fmt2(v)} CHF</div>
    </div>`;
  }).join('');

  const ctx = $('#categoryChart')?.getContext('2d'); if(!ctx) return;
  const chartLabels = entries.map(([k])=>k);
  const chartValues = entries.map(([,v])=>Math.abs(v));
  if(leftover>0){ chartLabels.push('Leftover'); chartValues.push(leftover); }

  $('#no-chart').style.display = chartValues.length ? 'none' : 'block';
  if(chart){ chart.destroy(); chart=null; }

  const centerTextPlugin = {
    id: 'centerText',
    afterDatasetsDraw(c){
      if(leftover<=0) return;
      const {ctx} = c;
      const meta = c.getDatasetMeta(0).data[0];
      if(!meta) return;
      ctx.save();
      ctx.textAlign='center'; ctx.fillStyle='#1e293b';
      ctx.font='600 16px Inter, system-ui, sans-serif';
      ctx.fillText('Leftover', meta.x, meta.y - 6);
      ctx.font='800 18px Inter, system-ui, sans-serif';
      ctx.fillText(`${fmt2(leftover)} CHF`, meta.x, meta.y + 18);
      ctx.restore();
    }
  };

  chart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: chartLabels, datasets: [{ data: chartValues, borderWidth:0 }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{
        legend:{ position:'bottom' },
        tooltip:{ callbacks:{ label: (ctx)=> ` ${ctx.label}: ${fmt2(ctx.raw)} CHF` } }
      }
    },
    plugins: [centerTextPlugin]
  });
  setTimeout(()=>chart.resize(),0);
}

/* ---------- Limits (modal + brief fact/limit list) ---------- */
function usedCategoriesThisMonth(mk){
  const { byCat }=getMonthData(mk);
  return Object.keys(byCat).filter(k => (byCat[k]||0) !== 0).sort();
}
$('#open-limits-modal')?.addEventListener('click', ()=>{
  const mk=currentKey();
  const cats=usedCategoriesThisMonth(mk);
  const limits=state.limits[mk]||{};
  $('#limits-subtitle').textContent=`Set target share per category for ${mk}. Leave empty for no limit.`;

  const list=$('#limits-form-list');
  list.innerHTML=cats.length? cats.map(c=>{
    const val=limits[c]??'';
    return `<div class="cat">${esc(c)}</div>
            <div><input type="number" class="limit-input" data-cat="${esc(c)}" min="0" max="100" step="1" placeholder="%" value="${val!==''?esc(val):''}"></div>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1;">No expenses this month.</div>`;

  $('#limits-modal').classList.remove('hidden');
  $('#limits-modal').setAttribute('aria-hidden','false');
});
$('#limits-cancel')?.addEventListener('click', ()=>{
  $('#limits-modal').classList.add('hidden');
  $('#limits-modal').setAttribute('aria-hidden','true');
});
$('#limits-save')?.addEventListener('click', ()=>{
  const mk=currentKey(); const lim=(state.limits[mk] ||= {});
  $$('#limits-form-list .limit-input').forEach(inp=>{
    const v=(inp.value||'').trim(); if(v===''){ delete lim[inp.dataset.cat]; return; }
    const n=Math.max(0,Math.min(100,parseFloat(v)||0)); lim[inp.dataset.cat]=n;
  });
  save();
  $('#limits-modal').classList.add('hidden'); $('#limits-modal').setAttribute('aria-hidden','true');
  refreshLimitsBrief();
});
function refreshLimitsBrief(){
  const mk = currentKey();
  const { byCat } = getMonthData(mk);
  const limits = state.limits[mk] || {};
  const box = document.getElementById('limits-brief');
  if(!box) return;

  const cats = Object.keys(byCat).filter(k => (byCat[k]||0) !== 0).sort();
  const totalAbs = cats.reduce((acc,k)=> acc + Math.abs(byCat[k]||0), 0);

  if(!cats.length || totalAbs === 0){
    box.className = 'empty';
    box.textContent = 'No expenses this month.';
    return;
  }
  box.className = '';
  box.innerHTML = cats.map(c=>{
    const fact = Math.abs(byCat[c] || 0) / totalAbs * 100;
    const lim  = limits[c];
    const over = (lim !== undefined && fact > Number(lim));
    return `<div class="limit-row ${over?'over':''}">
      <div class="name">${esc(c)}</div>
      <div class="meta">${fact.toFixed(1)}%${lim!==undefined?` / ${Number(lim).toFixed(1)}%`:''}</div>
    </div>`;
  }).join('');
}

/* ---------- Hide expenses toggle ---------- */
(function(){ const btn=$('#toggle-expenses'), wrap=$('#expense-table-wrap'); if(!btn||!wrap) return;
  btn.addEventListener('click',()=>{ const h=wrap.classList.toggle('bt-hidden'); btn.textContent=h?'Show':'Hide'; });
})();

/* ---------- Wishlist ---------- */
const W={
  addItem(t,u,target,note){ (state.wishlist.items).push({ id:(crypto.randomUUID?.()||Math.random().toString(36).slice(2)), title:t, url:u, target:parseFloat(target)||0, note:note||'', created:Date.now() }); save(); renderWishlist(); },
  clear(){ if(confirm('Clear all wishlist items?')){ state.wishlist.items=[]; state.wishlist.activeGoalId=null; save(); renderWishlist(); renderSavings(); } },
  setActive(id){ state.wishlist.activeGoalId=id; save(); renderWishlist(); renderSavings(); },
  getActiveGoal(){
    return state.wishlist.items.find(item => item.id === state.wishlist.activeGoalId);
  }
};
$('#wish-form')?.addEventListener('submit', e=>{
  e.preventDefault(); const t=$('#w-title').value.trim(); if(!t) return;
  W.addItem(t,$('#w-url').value.trim(),$('#w-target').value,$('#w-note').value.trim()); e.target.reset();
});
$('#clear-wishlist')?.addEventListener('click', ()=>W.clear());
function renderWishlist(){
  const list=$('#wish-list'), empty=$('#empty-wishlist'); if(!list||!empty) return;
  const items=state.wishlist.items.slice().sort((a,b)=>b.created-a.created);
  empty.style.display=items.length?'none':'block';
  list.innerHTML=items.map(it=>{
    const isActive=state.wishlist.activeGoalId===it.id;
    return `<div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;">
        <div style="font-weight:800">${esc(it.title)}</div>
        <div class="muted">${it.target? fmt2(it.target)+' CHF' : '—'}</div>
      </div>
      ${it.url? `<div style="margin:8px 0;"><img src="${esc(it.url)}" alt="" style="max-width:100%; border-radius:10px;"></div>`:''}
      ${it.note? `<div class="muted" style="margin:6px 0 10px;">${esc(it.note)}</div>`:''}
      <div class="row" style="justify-content:flex-end; gap:8px;">
        <button class="ghost small" data-goal="${it.id}">${isActive?'★ Active goal':'☆ Set as goal'}</button>
      </div>
    </div>`;
  }).join('');
  list.addEventListener('click', e=>{
    const id=e.target?.dataset?.goal; if(!id) return; W.setActive(id);
  }, { once:true });
}

// ---------- Savings (final, under CSS-jar) ----------
function renderSavings(){
  const mk = currentKey();
  const { incomeSum, totalExp } = getMonthData(mk);
  const jarTotal = state.jar[mk]?.total || 0;

  
  $('#savings-total').textContent = `${fmt2(jarTotal)} CHF`;
  const targetObj = W.getActiveGoal();
  const target = targetObj?.target ? Number(targetObj.target) : 0;
  $('#s-target').textContent = target ? `${fmt2(target)} CHF` : '—';

  
  let pct = 0, over = 0;
  if (target > 0) {
    pct = (jarTotal / target) * 100;
    if (pct > 100) pct = 100;
    over = jarTotal - target;
  }
  $('#s-progress').textContent = target
    ? `${Math.floor(pct)}%${over>0 ? ` (+${fmt2(over)} CHF over)` : ''}`
    : '0%';

  
  const jarEl = $('#savings-jar');
  if (jarEl) {
    const level = Math.min(82, Math.max(0, pct)); // 82% щоб не в кришку
    jarEl.style.setProperty('--fill', level.toFixed(2) + '%');
  }

  
  const leftover = (incomeSum || 0) + (totalExp || 0) - (jarTotal || 0);
  const lo = $('#s-leftover');
  lo.textContent = `${fmt2(leftover)} CHF`;
  lo.style.color = leftover < 0 ? '#b91c1c' : 'inherit';
}


$('#jar-plus')?.addEventListener('click', () => {
  const mk = currentKey();
  const obj = state.jar[mk] ||= { total: 0 };
  obj.total = Math.max(0, (obj.total||0) + 10);
  save();
  renderSavings();
});

$('#jar-minus')?.addEventListener('click', () => {
  const mk = currentKey();
  const obj = state.jar[mk] ||= { total: 0 };
  obj.total = Math.max(0, (obj.total||0) - 10);
  save();
  renderSavings();
});

/* ---------- Render ---------- */
function renderAll(){
  renderExpenses();
  renderIncomes();
  renderTotalsAndChart();
  renderWishlist();
  renderSavings();
  refreshLimitsBrief();
}

/* ---------- Init ---------- */
renderAll();
