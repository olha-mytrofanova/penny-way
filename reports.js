(function () {
  const STORE_KEY = 'penny.v3';

  function loadState() {
    if (window.state) return window.state; // з твого script.js
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch {
      return { expenses: {}, incomeRows: {}, limits: {} };
    }
  }

  function getMonthsFromState(st) {
    const set = new Set();
    Object.keys(st.expenses || {}).forEach(mk => set.add(mk));
    Object.keys(st.incomeRows || {}).forEach(mk => set.add(mk));
    return Array.from(set).sort();
  }

  function buildMonthly(st) {
    const months = getMonthsFromState(st);
    const byMonth = {}; // {mk: {inc, exp, sav, inv}}

    months.forEach(mk => {
      byMonth[mk] = { inc: 0, exp: 0, sav: 0, inv: 0 };
      // income
      const incRows = (st.incomeRows && st.incomeRows[mk]) || [];
      const incLegacy = (st.income && st.income[mk]) || 0;
      const incSum = incRows.length
        ? incRows.reduce((a, r) => a + (Number(r.amt) || 0), 0)
        : Number(incLegacy) || 0;
      byMonth[mk].inc = incSum;

      // expenses
      const exps = (st.expenses && st.expenses[mk]) || [];
      exps.forEach(e => {
        const amt = Math.abs(Number(e.amt) || 0); // у тебе amt негативний
        byMonth[mk].exp += amt;
        const cat = (e.cat || '').toLowerCase();
        if (cat === 'savings') {
          byMonth[mk].sav += amt;
        } else if (cat === 'investments' || cat === 'investing') {
          byMonth[mk].inv += amt;
        }
      });
    });

    return { months, byMonth };
  }

  // KPI
  function buildKpi(months, byMonth) {
    if (!months.length) {
      return { month: '—', net: 0, savings: 0, overspend: 0 };
    }
    const last = months[months.length - 1];
    const row = byMonth[last];
    const net = (row.inc || 0) - (row.exp || 0);
    return {
      month: last,
      net,
      savings: row.sav || 0,
      overspend: net < 0 ? Math.abs(net) : 0
    };
  }

  function buildLimitsData(st, month) {
    const limits = (st.limits && st.limits[month]) || {};
    const expenses = (st.expenses && st.expenses[month]) || [];
    const byCat = {};
    expenses.forEach(e => {
      const cat = e.cat || 'Other';
      const amt = Math.abs(Number(e.amt) || 0);
      byCat[cat] = (byCat[cat] || 0) + amt;
    });
    const labels = Object.keys(byCat);
    const actual = labels.map(c => byCat[c]);
    const limitPct = labels.map(c => (limits[c] ? Number(limits[c]) : 0));
    return { labels, actual, limitPct };
  }

  function chf(v) {
    return (v || 0).toFixed(2) + ' CHF';
  }

  function renderReports() {
    const host = document.getElementById('rep-cards');
    if (!host) return;

    const st = loadState();
    const { months, byMonth } = buildMonthly(st);
    const kpi = buildKpi(months, byMonth);
    const limData = buildLimitsData(st, kpi.month);

    host.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-l">Net (this month)</div>
          <div class="kpi-v">${chf(kpi.net)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-l">Savings (this month)</div>
          <div class="kpi-v" style="color:#059669">${chf(kpi.savings)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-l">Overspending</div>
          <div class="kpi-v" style="color:#b91c1c">${chf(kpi.overspend)}</div>
        </div>
      </div>

      <div class="rep-grid" style="margin-bottom:20px">
        <div class="rep-card tall">
          <h4>Income vs Expenses (by month)</h4>
          <div class="bt-chart-box"><canvas id="rep-inc-exp"></canvas></div>
          <div class="card-note">Current month: ${kpi.month}</div>
        </div>
        <div class="rep-card tall">
          <h4>Limits vs Actual — Overrun frequency</h4>
          <div class="bt-chart-box"><canvas id="rep-limits"></canvas></div>
          <div class="card-note">Limits tab</div>
        </div>
      </div>

      <div class="rep-grid">
        <div class="rep-card">
          <h4>Savings per month</h4>
          <div class="bt-chart-box"><canvas id="rep-savings"></canvas></div>
          <div class="card-note">Total: ${
            months.reduce((s, m) => s + (byMonth[m].sav || 0), 0).toFixed(2)
          } CHF</div>
        </div>
        <div class="rep-card">
          <h4>Investing per month</h4>
          <div class="bt-chart-box"><canvas id="rep-invest"></canvas></div>
          <div class="card-note">Total: ${
            months.reduce((s, m) => s + (byMonth[m].inv || 0), 0).toFixed(2)
          } CHF</div>
        </div>
      </div>
    `;

    // 1) Income vs Expenses
    const c1 = document.getElementById('rep-inc-exp');
    if (c1) {
      new Chart(c1, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Income',
              data: months.map(m => byMonth[m].inc || 0),
              backgroundColor: 'rgba(37, 99, 235, 0.75)'
            },
            {
              label: 'Expenses',
              data: months.map(m => byMonth[m].exp || 0),
              backgroundColor: 'rgba(239, 68, 68, 0.75)'
            },
            {
              type: 'line',
              label: 'Net',
              data: months.map(m => (byMonth[m].inc || 0) - (byMonth[m].exp || 0)),
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34,197,94,.2)',
              tension: 0.3,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }

    // 2) Limits vs Actual
    const c2 = document.getElementById('rep-limits');
    if (c2) {
      new Chart(c2, {
        type: 'bar',
        data: {
          labels: limData.labels,
          datasets: [
            {
              label: 'Actual (CHF)',
              data: limData.actual,
              backgroundColor: 'rgba(248, 113, 113, .8)'
            },
            {
              label: 'Limit (%)',
              data: limData.limitPct,
              backgroundColor: 'rgba(59, 130, 246, .6)'
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { x: { beginAtZero: true } }
        }
      });
    }

    // 3) Savings per month
    const c3 = document.getElementById('rep-savings');
    if (c3) {
      new Chart(c3, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Savings',
              data: months.map(m => byMonth[m].sav || 0),
              backgroundColor: 'rgba(5, 150, 105, 0.8)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
    }

    // 4) Investing per month
    const c4 = document.getElementById('rep-invest');
    if (c4) {
      new Chart(c4, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Investing',
              data: months.map(m => byMonth[m].inv || 0),
              backgroundColor: 'rgba(99, 102, 241, 0.8)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  }

  window.renderPennyReports = renderReports;
})();
