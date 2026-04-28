// reports.js — PennyWay

(function () {
  const STORE_KEY = 'penny.v3';

  function loadState() {
    if (window.state) return window.state;
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch { return { expenses: {}, incomeRows: {}, limits: {} }; }
  }

  function getMonthsFromState(st) {
    const set = new Set();
    Object.keys(st.expenses  || {}).forEach(mk => set.add(mk));
    Object.keys(st.incomeRows|| {}).forEach(mk => set.add(mk));
    return Array.from(set).sort();
  }

  function buildMonthly(st) {
    const months = getMonthsFromState(st);
    const byMonth = {};
    months.forEach(mk => {
      byMonth[mk] = { inc: 0, exp: 0, sav: 0, inv: 0 };
      const incRows   = (st.incomeRows && st.incomeRows[mk]) || [];
      const incLegacy = (st.income && st.income[mk]) || 0;
      byMonth[mk].inc = incRows.length
        ? incRows.reduce((a,r) => a + (Number(r.amt)||0), 0)
        : Number(incLegacy)||0;
      const exps = (st.expenses && st.expenses[mk]) || [];
      exps.forEach(e => {
        const amt = Math.abs(Number(e.amt)||0);
        byMonth[mk].exp += amt;
        const cat = (e.cat||'').toLowerCase();
        if (cat === 'savings') byMonth[mk].sav += amt;
        else if (cat === 'investments' || cat === 'investing') byMonth[mk].inv += amt;
      });
    });
    return { months, byMonth };
  }

  function buildKpi(months, byMonth) {
    if (!months.length) return { month: '—', net: 0, savings: 0, overspend: 0, savingsPct: 0, inc: 0, exp: 0 };
    const last = months[months.length - 1];
    const row  = byMonth[last];
    const net  = (row.inc||0) - (row.exp||0);
    const savingsPct = row.inc > 0 ? Math.round((row.sav / row.inc) * 100) : 0;
    return { month: last, net, savings: row.sav||0, overspend: net < 0 ? Math.abs(net) : 0, savingsPct, inc: row.inc||0, exp: row.exp||0 };
  }

  function buildLimitsData(st, month) {
    const limits   = (st.limits && st.limits[month]) || {};
    const expenses = (st.expenses && st.expenses[month]) || [];
    const byCat = {};
    expenses.forEach(e => {
      const cat = e.cat || 'Other';
      byCat[cat] = (byCat[cat]||0) + Math.abs(Number(e.amt)||0);
    });
    const labels   = Object.keys(limits);
    const totalExp = Object.values(byCat).reduce((a,v)=>a+v, 0);
    const actual   = labels.map(c => byCat[c] || 0);
    const limitAmt = labels.map(c => totalExp > 0 ? (Number(limits[c])/100) * totalExp : 0);
    const overLimit = labels.map((c, i) => actual[i] > limitAmt[i]);
    return { labels, actual, limitAmt, overLimit };
  }

  function chf(v) { return (v||0).toFixed(2) + ' CHF'; }

  function buildInsight(kpi, months) {
    if (!months.length) return null;
    const month = new Date(kpi.month + '-01').toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const spentPct = kpi.inc > 0 ? Math.round((kpi.exp / kpi.inc) * 100) : 0;
    if (kpi.overspend > 0)
      return `In ${month} you overspent by <strong>${chf(kpi.overspend)}</strong> ⚠️ — time to review your limits!`;
    if (kpi.savings > 0 && kpi.savingsPct >= 20)
      return `In ${month} you saved <strong>${chf(kpi.savings)}</strong> — that's ${kpi.savingsPct}% of your income. Excellent! 🏆`;
    if (kpi.savings > 0)
      return `In ${month} you spent <strong>${spentPct}%</strong> of income and put away <strong>${chf(kpi.savings)}</strong> 💰`;
    return `In ${month} you spent <strong>${chf(kpi.exp)}</strong> of <strong>${chf(kpi.inc)}</strong>. Set a savings goal to track progress! 🎯`;
  }

  const SCALES = {
    y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.15)' }, ticks: { font: { size: 11 } } },
    x: { grid: { display: false }, ticks: { font: { size: 11 } } }
  };
  const LEGEND = { position: 'top', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } };

  function renderReports() {
    const host = document.getElementById('rep-cards');
    if (!host) return;

    const st = loadState();
    const { months, byMonth } = buildMonthly(st);
    const kpi     = buildKpi(months, byMonth);
    const limData = buildLimitsData(st, kpi.month);
    const insight = buildInsight(kpi, months);
    const netColor = kpi.net >= 0 ? '#2563eb' : '#b91c1c';
    const netArrow = kpi.net >= 0 ? '↑' : '↓';
    const noLimits = limData.labels.length === 0;

    host.innerHTML = `
      ${insight ? `<div class="rep-insight"><span class="rep-insight-icon">💡</span><span>${insight}</span></div>` : ''}

      <div class="kpi-grid">
        <div class="kpi-card kpi-card--net">
          <div class="kpi-icon">📊</div>
          <div class="kpi-l">Net this month</div>
          <div class="kpi-v" style="color:${netColor}">${netArrow} ${chf(kpi.net)}</div>
        </div>
        <div class="kpi-card kpi-card--sav">
          <div class="kpi-icon">🪙</div>
          <div class="kpi-l">Saved this month</div>
          <div class="kpi-v">${chf(kpi.savings)}</div>
          ${kpi.savingsPct > 0 ? `<div class="kpi-sub">${kpi.savingsPct}% of income</div>` : ''}
        </div>
        <div class="kpi-card kpi-card--over">
          <div class="kpi-icon">${kpi.overspend > 0 ? '🔴' : '✅'}</div>
          <div class="kpi-l">Overspending</div>
          <div class="kpi-v">${kpi.overspend > 0 ? chf(kpi.overspend) : 'On track!'}</div>
        </div>
      </div>

      <div class="rep-grid" style="margin-bottom:18px">
        <div class="rep-card tall rep-card--blue">
          <h4>Income vs Expenses</h4>
          <div class="bt-chart-box"><canvas id="rep-inc-exp"></canvas></div>
          <div class="card-note">Latest: ${kpi.month}</div>
        </div>
        <div class="rep-card tall rep-card--orange">
          <h4>Limits vs Actual</h4>
          <div class="bt-chart-box"><canvas id="rep-limits"></canvas></div>
          <div class="card-note">${noLimits ? 'Set limits on the Home tab to see data here' : 'Green = within limit · Red = over limit'}</div>
        </div>
      </div>

      <div class="rep-grid">
        <div class="rep-card rep-card--green">
          <h4>Savings per month</h4>
          <div class="bt-chart-box"><canvas id="rep-savings"></canvas></div>
          <div class="card-note">Total: ${months.reduce((s,m)=>s+(byMonth[m].sav||0),0).toFixed(2)} CHF</div>
        </div>
        <div class="rep-card rep-card--purple">
          <h4>Investing per month</h4>
          <div class="bt-chart-box"><canvas id="rep-invest"></canvas></div>
          <div class="card-note">Total: ${months.reduce((s,m)=>s+(byMonth[m].inv||0),0).toFixed(2)} CHF</div>
        </div>
      </div>
    `;

    const R = 8; // bar border radius

    // 1) Income vs Expenses
    const c1 = document.getElementById('rep-inc-exp');
    if (c1) new Chart(c1, {
      type: 'bar',
      data: { labels: months, datasets: [
        { label:'Income',   data:months.map(m=>byMonth[m].inc||0), backgroundColor:'rgba(37,99,235,.75)',  borderRadius:R, borderSkipped:false },
        { label:'Expenses', data:months.map(m=>byMonth[m].exp||0), backgroundColor:'rgba(239,68,68,.75)',  borderRadius:R, borderSkipped:false },
        { type:'line', label:'Net', data:months.map(m=>(byMonth[m].inc||0)-(byMonth[m].exp||0)),
          borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,.12)',
          tension:0.4, pointRadius:4, pointBackgroundColor:'#22c55e', fill:true }
      ]},
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:LEGEND}, scales:SCALES }
    });

    // 2) Limits vs Actual
    const c2 = document.getElementById('rep-limits');
    if (c2) {
      if (noLimits) {
        const ctx = c2.getContext('2d');
        c2.style.opacity = '0.4';
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('No limits configured yet', c2.offsetWidth/2 || 200, 100);
      } else {
        new Chart(c2, {
          type:'bar',
          data:{ labels:limData.labels, datasets:[
            { label:'Actual (CHF)', data:limData.actual,
              backgroundColor:limData.overLimit.map(o=>o?'rgba(239,68,68,.8)':'rgba(34,197,94,.75)'), borderRadius:R, borderSkipped:false },
            { label:'Limit (CHF)',  data:limData.limitAmt,
              backgroundColor:'rgba(148,163,184,.35)', borderRadius:R, borderSkipped:false }
          ]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:LEGEND},
            indexAxis:'y',
            scales:{
              x:{ beginAtZero:true, grid:{color:'rgba(148,163,184,.15)'}, ticks:{font:{size:11}} },
              y:{ grid:{display:false}, ticks:{font:{size:11}} }
            }
          }
        });
      }
    }

    // 3) Savings
    const c3 = document.getElementById('rep-savings');
    if (c3) new Chart(c3, {
      type:'bar',
      data:{ labels:months, datasets:[{ label:'Savings', data:months.map(m=>byMonth[m].sav||0),
        backgroundColor:'rgba(5,150,105,.8)', borderRadius:R, borderSkipped:false }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:LEGEND}, scales:SCALES }
    });

    // 4) Investing
    const c4 = document.getElementById('rep-invest');
    if (c4) new Chart(c4, {
      type:'bar',
      data:{ labels:months, datasets:[{ label:'Investing', data:months.map(m=>byMonth[m].inv||0),
        backgroundColor:'rgba(99,102,241,.8)', borderRadius:R, borderSkipped:false }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:LEGEND}, scales:SCALES }
    });
  }

  window.renderPennyReports = renderReports;
})();