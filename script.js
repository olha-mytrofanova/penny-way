/* =========================================
   PennyWay – Home + Savings
   ========================================= */

/* ---------- Helpers ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const today = () => new Date().toISOString().slice(0,10);
const mkey  = (d) => (d||today()).slice(0,7);
const fmt2  = (n) => Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc   = (x) => String(x==null?'':x).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* chart handle must be defined early to avoid temporal dead zone */
let chart = null;

/* ---------- Data ---------- */
const CATS = [
  'Rent','Groceries','Investments','Utilities','Phone/Internet','Savings',
  'Subscriptions','Restaurants','Education','Hygiene','Transport','Clothes',
  'Medicine','Gifts','Pets','Hobbies','Home','Other'
];

/* ---------- Color palette (shared between chart & bars) ---------- */
const CAT_COLORS = {
  'Rent':           '#6366f1',
  'Groceries':      '#f59e0b',
  'Investments':    '#10b981',
  'Utilities':      '#3b82f6',
  'Phone/Internet': '#8b5cf6',
  'Savings':        '#22c55e',
  'Subscriptions':  '#ec4899',
  'Restaurants':    '#f97316',
  'Education':      '#06b6d4',
  'Hygiene':        '#e879f9',
  'Transport':      '#fbbf24',
  'Clothes':        '#f43f5e',
  'Medicine':       '#ef4444',
  'Gifts':          '#a78bfa',
  'Pets':           '#34d399',
  'Hobbies':        '#fb923c',
  'Home':           '#60a5fa',
  'Other':          '#94a3b8',
  'Leftover':       '#cbd5e1',
};
const catColor = (name) => CAT_COLORS[name] || '#94a3b8';

const STORE_KEY = 'penny.v3';
const state = load() || {
  expenses: {},     // { mk: [ {id,date,cat,note,amt<0>} ] }
  income:   {},     // legacy totals { mk:number }
  incomeRows: {},   // history { mk: [ {id,date,amt>0} ] }
  limits:   {},     // { mk: { [cat]: percent } }
  jar:      {},     // { mk: { total:number } }
  wishlist: { items:[], activeGoalId:null }
};

function load(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)||''); } catch { return null; } }
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Month/Year selectors ---------- */
(function initDateSelectors(){
  const msel = $('#month-select'), ysel = $('#year-select');
  if(!msel || !ysel) return;
  for(let m=0;m<12;m++){
    const o=document.createElement('option');
    o.value=String(m+1).padStart(2,'0');
    o.textContent=new Date(2000,m,1).toLocaleString(undefined,{month:'long'});
    msel.appendChild(o);
  }
  const nowY = new Date().getFullYear();
  for(let y=nowY-3;y<=nowY+1;y++){
    const o=document.createElement('option'); o.value=y; o.textContent=y; ysel.appendChild(o);
  }
  const mk=mkey(); msel.value=mk.slice(5,7); ysel.value=mk.slice(0,4);
  msel.addEventListener('change', onDateChange);
  ysel.addEventListener('change', onDateChange);
})();

function currentKey(){
  const y=$('#year-select')?.value||mkey().slice(0,4);
  const m=$('#month-select')?.value||mkey().slice(5,7);
  return `${y}-${m}`;
}
function onDateChange(){
  renderAll();
  if($('.bt-tab.bt-active')?.dataset.tab==='limits'){
    $('.card.entry-card')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
}

/* ---------- Month Picker UI ---------- */
(function initMonthPicker(){
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTHS_FULL  = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

  const msel     = $('#month-select');
  const ysel     = $('#year-select');
  const labelBtn = $('#mp-label');
  const dropdown = $('#mp-dropdown');
  const yrLabel  = $('#mp-yr-label');
  const grid     = $('#mp-grid');

  const now = mkey();
  let curY  = parseInt(now.slice(0,4));
  let curM  = parseInt(now.slice(5,7));
  let pickY = curY;

  function syncSelects(){
    if(msel) msel.value = String(curM).padStart(2,'0');
    if(ysel) ysel.value = String(curY);
  }
  function updateLabel(){
    if(labelBtn) labelBtn.textContent = `${MONTHS_FULL[curM-1]} ${curY}`;
  }
  function renderGrid(){
    if(!grid || !yrLabel) return;
    yrLabel.textContent = pickY;
    grid.innerHTML = MONTHS_SHORT.map((m,i) => {
      const active = (i+1===curM && pickY===curY) ? ' mp-active' : '';
      return `<button class="mp-month${active}" data-m="${i+1}" data-y="${pickY}">${m}</button>`;
    }).join('');
  }
  function setDate(y, m){
    curY=y; curM=m; pickY=y;
    syncSelects(); updateLabel(); renderGrid(); onDateChange();
  }
  function navigate(delta){
    let m=curM+delta, y=curY;
    if(m>12){m=1;y++;} if(m<1){m=12;y--;}
    setDate(y,m);
  }

  syncSelects(); updateLabel(); renderGrid();

  $('#mp-prev')?.addEventListener('click', e=>{e.stopPropagation();navigate(-1);});
  $('#mp-next')?.addEventListener('click', e=>{e.stopPropagation();navigate(+1);});
  labelBtn?.addEventListener('click', e=>{
    e.stopPropagation(); pickY=curY; renderGrid();
    dropdown?.classList.toggle('mp-open');
  });
  $('#mp-yr-prev')?.addEventListener('click', e=>{e.stopPropagation();pickY--;renderGrid();});
  $('#mp-yr-next')?.addEventListener('click', e=>{e.stopPropagation();pickY++;renderGrid();});
  grid?.addEventListener('click', e=>{
    const btn=e.target.closest('.mp-month'); if(!btn) return;
    setDate(parseInt(btn.dataset.y), parseInt(btn.dataset.m));
    dropdown?.classList.remove('mp-open');
  });
  document.addEventListener('click', ()=>dropdown?.classList.remove('mp-open'));
})();

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
      s.setAttribute('aria-hidden', 'true');
    });

    const tgt = SECTIONS[route] || SECTIONS.home;
    if (tgt) {
      tgt.classList.remove('bt-hidden');
      tgt.style.display = 'block';
      tgt.setAttribute('aria-hidden', 'false');
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
  $$('.entry-card .bt-panel').forEach(p => p.classList.toggle('bt-hidden', p.dataset.panel!=='expense'));
  document.addEventListener('click', (e) => {
    const btn=e.target.closest('.bt-tab'); if(!btn) return; e.preventDefault();
    const tab=btn.dataset.tab;
    $$('.bt-tab').forEach(b => { b.classList.toggle('bt-active', b===btn); b.setAttribute('aria-selected', b===btn?'true':'false'); });
    $$('.entry-card .bt-panel').forEach(p => p.classList.toggle('bt-hidden', p.dataset.panel!==tab));
    if(tab==='limits'){ $('.card.entry-card')?.scrollIntoView({behavior:'smooth',block:'start'}); refreshLimitsBrief(); }
  }, {passive:false});
})();

/* ---------- Category select ---------- */
(function fillCategories(){
  const sel=$('#category'); if(!sel) return;
  sel.innerHTML=CATS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
})();

/* ---------- Quick amount buttons ---------- */
document.addEventListener('click', e => {
  const qa = e.target.closest('.quick-amt');
  if (qa) { $('#amount').value = qa.dataset.amt; $('#amount').focus(); }
});

/* ---------- Entry summary ---------- */
function renderEntrySummary() {
  const mk = currentKey();
  const { incomeSum, totalExp } = getMonthData(mk);
  const spent   = Math.abs(totalExp);
  const left    = (incomeSum || 0) + (totalExp || 0);
  const box     = $('#entry-summary');
  if (!box) return;
  if (!incomeSum && !spent) { box.innerHTML = ''; return; }
  const monthName = new Date(mk + '-01').toLocaleString(undefined, { month: 'long', year: 'numeric' });
  box.innerHTML = `${monthName} &nbsp;·&nbsp; spent <span class="s-spent">${fmt2(spent)} CHF</span> &nbsp;·&nbsp; left <span class="s-left">${fmt2(left)} CHF</span>`;
}

/* ---------- Expenses CRUD ---------- */
$('#expense-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const amt=parseFloat($('#amount').value);
  const cat=$('#category').value;
  const note=$('#note').value.trim();
  if(!(amt>0) || !cat) return;
  const mk=currentKey();
  (state.expenses[mk] ||= []).push({
    id: (crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
    date: today(), cat, note, amt: -Math.abs(amt)
  });
  save(); e.target.reset(); renderAll();
  // success flash on Add button
  const btn = $('#add-expense-btn');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Added';
    btn.classList.add('btn-success');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('btn-success'); }, 1000);
  }
});

$('#clear-data')?.addEventListener('click', () => {
  if(!confirm('Reset ALL data (all months)?')) return;
  localStorage.removeItem(STORE_KEY);
  Object.assign(state,{ expenses:{}, income:{}, incomeRows:{}, limits:{}, jar:{}, wishlist:{ items:[], activeGoalId:null } });
  renderAll();
});

/* ---------- Income ---------- */
$('#add-income-btn')?.addEventListener('click', () => {
  const mk=currentKey(); const val=parseFloat($('#income-input').value); if(!(val>0)) return;
  (state.incomeRows[mk] ||= []).push({
    id: (crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
    date: today(), amt: Math.abs(val)
  });
  save(); $('#income-input').value=''; renderAll();
});

/* ---------- Month data ---------- */
function getMonthData(mk){
  const rows = state.expenses[mk]||[];
  const incomeLegacy = state.income[mk] || 0;
  const incomeRows   = state.incomeRows[mk] || [];
  const incomeSum = incomeRows.length ? incomeRows.reduce((a,b)=>a+b.amt, 0) : incomeLegacy;
  const byCat = {}; rows.forEach(r=>{ byCat[r.cat]=(byCat[r.cat]||0)+r.amt; });
  const totalExp = rows.reduce((a,b)=>a+b.amt, 0);
  return { rows, incomeRows, incomeSum, byCat, totalExp };
}

/* ---------- Expenses table ---------- */
function renderExpenses(){
  const mk=currentKey();
  const { rows }=getMonthData(mk);
  const body=$('#expense-body'), empty=$('#empty-expenses'), count=$('#expense-count'), grand=$('#grand-total');
  if (!body || !empty || !count || !grand) return;

  body.innerHTML=rows.map(r=>{
    const isSavings = r.cat === 'Savings';
    const amtColor = isSavings ? '#16a34a' : '#b91c1c';
    const noteDisplay = r.note === 'Jar' ? '🫙 Jar' : esc(r.note||'');
    return `<tr>
      <td>${r.date}</td>
      <td><span class="cat-dot" style="background:${catColor(r.cat)}"></span>${esc(r.cat)}</td>
      <td>${noteDisplay}</td>
      <td class="right" style="color:${amtColor};font-weight:600">${fmt2(r.amt)} CHF</td>
      <td class="right"><button class="ghost small" data-del="${esc(r.id)}">Delete</button></td>
    </tr>`;
  }).join('');
  count.textContent=`${rows.length} item${rows.length===1?'':'s'}`;
  grand.textContent=`${fmt2(rows.reduce((a,b)=>a+b.amt,0))} CHF`;
  empty.style.display=rows.length?'none':'block';
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
      <td class="right"><button class="ghost small" data-del-income="${esc(r.id)}">Delete</button></td>
    </tr>`).join('');
  total.textContent = `${fmt2(incomeSum)} CHF`;
  empty.style.display = incomeRows.length ? 'none' : 'block';
}

/* ---------- Global event delegation for delete/goal actions ---------- */
document.addEventListener('click', e => {
  // Delete expense
  const del = e.target.dataset.del;
  if (del) {
    const mk = currentKey();
    state.expenses[mk] = (state.expenses[mk]||[]).filter(r => r.id !== del);
    save(); renderAll(); return;
  }
  // Delete income
  const delIncome = e.target.dataset.delIncome;
  if (delIncome) {
    const mk = currentKey();
    state.incomeRows[mk] = (state.incomeRows[mk]||[]).filter(r => r.id !== delIncome);
    save(); renderAll(); return;
  }
  // Set wishlist goal
  const goal = e.target.dataset.goal;
  if (goal) { W.setActive(goal); }
});

/* ---------- Totals & Chart ---------- */
function renderTotalsAndChart(){
  const mk=currentKey();
  const { byCat, totalExp, incomeSum } = getMonthData(mk);
  const leftover = incomeSum + totalExp; // savings now in expenses, no double-subtract

  const entries = Object.entries(byCat).filter(([_,v])=>v!==0).sort((a,b)=>a[0].localeCompare(b[0]));
  const totals = $('#totals');
  const maxAbs = entries.reduce((mx,[,v])=>Math.max(mx,Math.abs(v)), 1);
  const sumAll = entries.reduce((a,[,v])=>a+v, 0);

  totals.innerHTML = entries.concat([['Total', sumAll]]).map(([k,v])=>{
    const isTotal = k === 'Total';
    const dot = `<span class="cat-dot" style="background:${isTotal ? 'transparent' : catColor(k)};flex-shrink:0"></span>`;
    const amtColor = k === 'Savings'     ? '#16a34a'
                   : k === 'Investments' ? '#6366f1'
                   : k === 'Total'       ? 'var(--text)'
                   : '#b91c1c';
    return `<div class="line${isTotal?' total':''}">
      <div class="name">${dot}${esc(k)}</div>
      <div class="amt" style="color:${amtColor}">${fmt2(v)} CHF</div>
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
    data: {
      labels: chartLabels,
      datasets: [{ data: chartValues, backgroundColor: chartLabels.map(catColor), borderWidth: 0 }]
    },
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

/* ---------- Limits ---------- */
function usedCategoriesThisMonth(mk){
  const { byCat }=getMonthData(mk);
  return Object.keys(byCat).filter(k => (byCat[k]||0) !== 0).sort();
}

$('#open-limits-modal')?.addEventListener('click', () => {
  const mk=currentKey();
  const cats=usedCategoriesThisMonth(mk);
  const limits=state.limits[mk]||{};
  $('#limits-subtitle').textContent=`Set target share per category for ${mk}. Leave empty for no limit.`;

  const list=$('#limits-form-list');
  list.innerHTML=cats.length ? cats.map(c=>{
    const val=limits[c]??'';
    return `<div class="cat">${esc(c)}</div>
            <div><input type="number" class="limit-input" data-cat="${esc(c)}" min="0" max="100" step="1" placeholder="%" value="${val!==''?esc(val):''}"></div>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1;">No expenses this month.</div>`;

  $('#limits-modal').classList.remove('hidden');
  $('#limits-modal').setAttribute('aria-hidden','false');
});

$('#limits-cancel')?.addEventListener('click', () => {
  $('#limits-modal').classList.add('hidden');
  $('#limits-modal').setAttribute('aria-hidden','true');
});

$('#limits-save')?.addEventListener('click', () => {
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

/* ---------- Toggle expenses visibility ---------- */
(function(){
  const btn=$('#toggle-expenses'), wrap=$('#expense-table-wrap'); if(!btn||!wrap) return;
  btn.addEventListener('click',()=>{ const h=wrap.classList.toggle('bt-hidden'); btn.textContent=h?'Show':'Hide'; });
})();

/* ---------- Wishlist ---------- */
const W={
  addItem(t,u,target,note){
    (state.wishlist.items).push({
      id: (crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
      title:t, url:u, target:parseFloat(target)||0, note:note||'', created:Date.now()
    });
    save(); renderWishlist();
  },
  clear(){
    if(confirm('Clear all wishlist items?')){
      state.wishlist.items=[]; state.wishlist.activeGoalId=null;
      save(); renderWishlist(); renderSavings();
    }
  },
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
        <button class="ghost small" data-goal="${esc(it.id)}">${isActive?'★ Active goal':'☆ Set as goal'}</button>
      </div>
    </div>`;
  }).join('');
}

/* ---------- Motivational text ---------- */
function getMotivation(pct) {
  if (pct === 0)  return 'Start saving today! 🌱';
  if (pct < 25)   return 'Great start! Keep it up 💪';
  if (pct < 50)   return 'Building momentum! 🔥';
  if (pct < 75)   return 'Halfway there! 🚀';
  if (pct < 100)  return 'Almost there! 🏆';
  return 'Goal reached! 🎉';
}

/* ---------- Coin animation ---------- */
function spawnCoins() {
  const jarEl = document.getElementById('savings-jar');
  if (!jarEl) return;
  const rect = jarEl.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const coin = document.createElement('span');
      coin.className = 'coin-anim';
      coin.textContent = '🪙';
      const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 50;
      const y = rect.bottom - 10;
      coin.style.left = x + 'px';
      coin.style.top  = y + 'px';
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 750);
    }, i * 120);
  }
}

/* ---------- Savings ---------- */
function renderSavings(){
  const mk = currentKey();
  const { incomeSum, totalExp, byCat } = getMonthData(mk);

  const jarTotal = Math.abs(byCat['Savings'] || 0);
  const targetObj = W.getActiveGoal();
  const target = targetObj?.target ? Number(targetObj.target) : 0;

  // visual fill %
  let pct = 0;
  if (target > 0) {
    pct = Math.min(100, (jarTotal / target) * 100);
  } else if (jarTotal > 0) {
    pct = Math.min(100, (jarTotal / 1000) * 100);
  }
  const level = (pct / 100) * 82;

  // jar fill
  const jarEl = $('#savings-jar');
  if (jarEl) jarEl.style.setProperty('--fill', level.toFixed(2) + '%');

  // amount label inside jar
  const lbl = $('#jar-amount-label');
  if (lbl) lbl.textContent = jarTotal > 0 ? `${fmt2(jarTotal)} CHF` : '';

  // stat cards
  $('#savings-total').textContent = `${fmt2(jarTotal)} CHF`;
  $('#s-target').textContent = target ? `${fmt2(target)} CHF` : '—';

  const over = target > 0 ? Math.max(0, jarTotal - target) : 0;
  $('#s-progress').textContent = target
    ? `${Math.floor(pct)}%${over > 0 ? ` (+${fmt2(over)} CHF)` : ''}`
    : jarTotal > 0 ? `${Math.floor(pct)}%` : '0%';

  // progress bar
  const bar = $('#s-progress-bar');
  if (bar) bar.style.width = Math.min(100, pct).toFixed(1) + '%';

  // motivation
  const mot = $('#jar-motivation');
  if (mot) mot.textContent = getMotivation(Math.floor(pct));

  // leftover
  const leftover = (incomeSum || 0) + (totalExp || 0);
  const lo = $('#s-leftover');
  if (lo) {
    lo.textContent = `${fmt2(leftover)} CHF`;
    lo.style.color = leftover < 0 ? '#b91c1c' : 'inherit';
  }
}

$('#jar-plus')?.addEventListener('click', () => {
  const mk = currentKey();
  (state.expenses[mk] ||= []).push({
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    date: today(), cat: 'Savings', note: 'Jar', amt: -10
  });
  spawnCoins();
  save(); renderAll();
});

$('#jar-minus')?.addEventListener('click', () => {
  const mk = currentKey();
  const exps = state.expenses[mk] || [];
  // remove the most recent Savings jar entry
  const idx = [...exps].reverse().findIndex(e => e.cat === 'Savings' && e.note === 'Jar');
  if (idx !== -1) {
    state.expenses[mk].splice(exps.length - 1 - idx, 1);
    save(); renderAll();
  }
});

/* ---------- Render all ---------- */
function renderAll(){
  renderExpenses();
  renderIncomes();
  renderTotalsAndChart();
  renderWishlist();
  renderSavings();
  refreshLimitsBrief();
  renderEntrySummary();
}

/* ---------- Init ---------- */
renderAll();