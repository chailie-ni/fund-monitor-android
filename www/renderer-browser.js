<<<<<<< HEAD
﻿// ==============================
=======
// ==============================
>>>>>>> 35976c2 (﻿fix: BOM清理 + 网络安全配置 + 乱码修复)
// 基金监控 - Android版 (API直连)
// ==============================

const State = {
  data: { funds: [], settings: { refreshInterval: 15 } },
  timer: null, countdown: 0, editingIndex: -1,
  fundSearchCache: {},
  prevFundData: {},
  isRefreshing: false,
  lastUpdateTime: null,
  marketOK: false,
  fundOK: {},
};

function init() {
  loadFromStorage();
  renderAll();
  doRefresh();
  startAutoRefresh();
  setupEvents();
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('fund-monitor-data');
    if (saved) State.data = JSON.parse(saved);
    if (!State.data.funds) State.data.funds = [];
    if (!State.data.settings) State.data.settings = { refreshInterval: 15 };
  } catch (e) {}
}
function persist() {
  try { localStorage.setItem('fund-monitor-data', JSON.stringify(State.data)); } catch (e) {}
}

function renderAll() {
  renderFundsInternal();
  updateSummaryBar();
}

// ==============================
// API 直连 (WebView 无CORS限制)
// ==============================
async function apiCall(path) {
  let url = path;
  // 本地代理路径 → 直连API
  if (path.startsWith('/api/market-indices')) {
    const codes = new URLSearchParams(path.split('?')[1]).get('codes') || '1.000001,0.399001,0.399006,0.000688';
    url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=' + codes;
  } else if (path.startsWith('/api/fund-realtime')) {
    const code = new URLSearchParams(path.split('?')[1]).get('code');
    url = 'https://fundgz.1234567.com.cn/js/' + code + '.js';
  } else if (path.startsWith('/api/fund-search')) {
    url = 'https://fund.eastmoney.com/js/fundcode_search.js';
  }
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return await resp.text();
  } catch (e) {
    console.warn('API fail:', e.message);
    return null;
  }
}

async function fetchMarketIndices() {
  const text = await apiCall('/api/market-indices?codes=1.000001,0.399001,0.399006,0.000688');
  const container = document.getElementById('marketIndices');
  if (!text) {
    container.innerHTML = '<div class="loading err">⚠ 网络异常</div>';
    State.marketOK = false;
    return;
  }
  try {
    const json = JSON.parse(text);
    if (json.data && json.data.diff) {
      State.marketOK = true;
      const prevHTML = container.innerHTML;
      const newHTML = json.data.diff.map(item => {
        const price = (item.f2 / 100 || 0).toFixed(2);
        const changePct = (item.f3 || 0).toFixed(2);
        const cls = changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat';
        const arrow = changePct > 0 ? '▲' : changePct < 0 ? '▼' : '—';
        return '<div class="index-item ' + cls + '">' +
          '<div class="index-name">' + (item.f14 || item.f12) + '</div>' +
          '<div class="index-value">' + price + '</div>' +
          '<div class="index-change">' + arrow + ' ' + changePct + '%</div></div>';
      }).join('');
      container.innerHTML = newHTML;
      if (prevHTML && prevHTML !== newHTML) container.classList.add('flash');
      setTimeout(() => container.classList.remove('flash'), 600);
    } else {
      container.innerHTML = '<div class="loading">指数数据暂不可用</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="loading err">解析失败</div>';
  }
}

async function fetchFundRealtime(code) {
  const text = await apiCall('/api/fund-realtime?code=' + code);
  if (!text) return null;
  try {
    return JSON.parse(text.match(/\\{[\\s\\S]*\\}/)[0]);
  } catch (e) { return null; }
}

async function getFundSearchData() {
  if (Object.keys(State.fundSearchCache).length) return State.fundSearchCache;
  const text = await apiCall('/api/fund-search');
  if (!text) return State.fundSearchCache;
  try {
    const match = text.match(/var r = (\\[.*?\\]);/);
    if (match) {
      JSON.parse(match[1]).forEach(item => { State.fundSearchCache[item[0]] = { name: item[2] }; });
    }
  } catch (e) {}
  return State.fundSearchCache;
}

async function fetchFundName() {
  const code = document.getElementById('inputCode').value.trim();
  const st = document.getElementById('fetchStatus');
  const ni = document.getElementById('inputName');
  if (code.length < 6) { st.textContent = '请输入6位基金代码'; return; }
  const btn = document.getElementById('btnFetchName');
  btn.disabled = true; st.textContent = '🔍 查询中……';
  const cache = await getFundSearchData();
  if (cache[code]) { ni.value = cache[code].name; st.textContent = '✅ 已获取'; btn.disabled = false; return; }
  const rt = await fetchFundRealtime(code);
  if (rt && rt.name) { ni.value = rt.name; st.textContent = '✅ 已获取'; }
  else { st.textContent = '⚠ 未找到，请检查代码'; ni.value = ''; }
  btn.disabled = false;
}
function onCodeInput() {
  document.getElementById('btnFetchName').disabled = document.getElementById('inputCode').value.trim().length < 6;
}

function openModal(idx) {
  document.getElementById('modalOverlay').style.display = 'flex';
  ['inputCode','inputName','inputShares','inputCost','inputNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fetchStatus').textContent = '';
  document.getElementById('btnFetchName').disabled = true;
  if (idx != null) {
    State.editingIndex = idx;
    const f = State.data.funds[idx];
    document.getElementById('modalTitle').textContent = '✎ 编辑基金';
    document.getElementById('inputCode').value = f.code; document.getElementById('inputCode').readOnly = true;
    document.getElementById('inputName').value = f.name;
    document.getElementById('inputShares').value = f.shares;
    document.getElementById('inputCost').value = f.cost;
    document.getElementById('inputNote').value = f.note || '';
  } else {
    State.editingIndex = -1;
    document.getElementById('modalTitle').textContent = '＋ 添加基金';
    document.getElementById('inputCode').readOnly = false;
  }
}
function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; State.editingIndex = -1; }

async function confirmAddFund() {
  const code = document.getElementById('inputCode').value.trim();
  const name = document.getElementById('inputName').value.trim();
  const shares = parseFloat(document.getElementById('inputShares').value);
  const cost = parseFloat(document.getElementById('inputCost').value);
  const note = document.getElementById('inputNote').value.trim();
  if (code.length !== 6) { alert('请输入6位基金代码'); return; }
  if (!name) { alert('请先查询基金名称'); return; }
  if (isNaN(shares) || shares <= 0) { alert('请输入有效份额'); return; }
  if (isNaN(cost) || cost <= 0) { alert('请输入有效成本价'); return; }
  if (State.editingIndex >= 0) {
    State.data.funds[State.editingIndex] = { code, name, shares, cost, note };
  } else {
    if (State.data.funds.some(f => f.code === code)) { alert('该基金已在自选！'); return; }
    State.data.funds.push({ code, name, shares, cost, note });
  }
  persist(); closeModal(); await doRefresh();
}

async function deleteFund(idx) {
  if (!confirm('确认移除「' + State.data.funds[idx].name + '」？')) return;
  State.data.funds.splice(idx, 1);
  delete State.prevFundData[State.data.funds[idx]?.code];
  persist(); await doRefresh();
}

async function doRefresh() {
  if (State.isRefreshing) return;
  State.isRefreshing = true;
  const rBtn = document.getElementById('btnRefresh');
  rBtn.classList.add('spinning');

  const [_, fundResults] = await Promise.allSettled([
    fetchMarketIndices(),
    Promise.allSettled(State.data.funds.map(f => fetchFundRealtime(f.code)))
  ]);

  const results = fundResults.status === 'fulfilled' ? fundResults.value : [];
  let totalCost = 0, totalValue = 0;

  State.data.funds.forEach((fund, i) => {
    const prev = State.prevFundData[fund.code] || {};
    const r = results[i]?.status === 'fulfilled' ? results[i].value : null;

    if (r) {
      fund._estNav = parseFloat(r.gsz);
      fund._changePct = parseFloat(r.gszzl);
      fund._navDate = r.jzrq;
      fund._actualNav = parseFloat(r.dwjz);
      fund._curValue = fund._estNav * fund.shares;
      fund._profit = fund._curValue - fund.cost * fund.shares;
      fund._profitRate = fund.cost > 0 ? (fund._profit / (fund.cost * fund.shares)) * 100 : 0;
      fund._navChanged = prev.nav !== undefined && prev.nav !== fund._estNav;
      fund._pctChanged = prev.pct !== undefined && prev.pct !== fund._changePct;
      State.prevFundData[fund.code] = { nav: fund._estNav, pct: fund._changePct };
      State.fundOK[fund.code] = true;
      totalCost += fund.cost * fund.shares;
      totalValue += fund._curValue;
    } else {
      fund._estNav = null; fund._changePct = null; fund._curValue = null;
      fund._profit = null; fund._profitRate = null; fund._navChanged = false; fund._pctChanged = false;
      State.fundOK[fund.code] = false;
    }
  });

  State.lastUpdateTime = new Date();
  renderFundsInternal();
  updateSummaryBar(totalCost, totalValue);
  updateLastUpdateTime();
  rBtn.classList.remove('spinning');
  State.isRefreshing = false;
}

function renderFundsInternal() {
  const cards = document.getElementById('fundCards');
  const funds = State.data.funds;
  if (funds.length === 0) {
    cards.innerHTML = '<div class="empty-state">📭 暂无基金，点击右上角「<strong>+ 添加</strong>」开始监控<br><span style="font-size:12px;color:#888;margin-top:6px;display:block">提示：大盘指数实时显示中，添加基金后即可查看持仓收益</span></div>';
    document.getElementById('fundList').style.display = 'block';
    return;
  }
  cards.innerHTML = funds.map((f, i) => {
    const ok = f._estNav != null;
    const cls = ok ? (f._changePct > 0 ? 'up' : f._changePct < 0 ? 'down' : 'flat') : 'flat';
    const flashNav = f._navChanged ? ' flash-value' : '';
    const flashPct = f._pctChanged ? ' flash-value' : '';

    if (!ok) {
      return '<div class="fund-card flat err">' +
        '<div class="fund-top">' +
          '<div class="fund-info">' +
            '<div class="fund-name">' + esc(f.name) + ' <span class="fund-code">' + f.code + '</span></div>' +
          '</div>' +
          '<div class="fund-change-area"><div class="fund-change-pct err-txt">⚠ 数据获取失败</div></div>' +
        '</div>' +
        '<div class="fund-actions">' + actBtns(i) + '</div></div>';
    }

    const arrow = f._changePct > 0 ? '▲' : f._changePct < 0 ? '▼' : '—';
    const sign = f._changePct > 0 ? '+' : '';

    return '<div class="fund-card ' + cls + '" data-code="' + f.code + '">' +
      '<div class="fund-top">' +
        '<div class="fund-info">' +
          '<div class="fund-name">' + esc(f.name) + ' <span class="fund-code">' + f.code + '</span>' +
          (f.note ? '<span class="fund-note">' + esc(f.note) + '</span>' : '') + '</div>' +
          '<div class="fund-sub">最新净值：<span class="' + cls + '">¥' + (f._actualNav || 0).toFixed(4) + '</span> · 净值日：' + (f._navDate || '--') + '</div>' +
        '</div>' +
        '<div class="fund-change-area">' +
          '<div class="fund-change-pct ' + cls + flashPct + '">' + arrow + ' ' + sign + f._changePct.toFixed(2) + '%</div>' +
          '<div class="fund-est-nav ' + cls + flashNav + '">¥' + f._estNav.toFixed(4) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="fund-detail">' +
        '<div class="item"><div class="label">持有份额</div><div class="value">' + f.shares.toFixed(2) + '</div></div>' +
        '<div class="item"><div class="label">成本单价</div><div class="value">¥' + f.cost.toFixed(4) + '</div></div>' +
        '<div class="item"><div class="label">估算收益</div><div class="value" style="color:' + ((f._profit||0) >= 0 ? 'var(--red)' : 'var(--green)') + '">' + ((f._profit||0) >= 0 ? '+' : '') + '¥' + (f._profit||0).toFixed(2) + '</div></div>' +
        '<div class="item"><div class="label">收益率</div><div class="value" style="color:' + ((f._profitRate||0) >= 0 ? 'var(--red)' : 'var(--green)') + '">' + ((f._profitRate||0) >= 0 ? '+' : '') + (f._profitRate||0).toFixed(2) + '%</div></div>' +
      '</div>' +
      '<div class="fund-actions">' + actBtns(i) + '</div></div>';
  }).join('');
}

function actBtns(i) {
  return '<button class="btn-edit" onclick="openModal(' + i + ')" title="编辑">✎</button>' +
          '<button class="btn-del" onclick="deleteFund(' + i + ')" title="删除">✕</button>';
}

function updateLastUpdateTime() {
  const el = document.getElementById('lastUpdateLabel');
  if (el && State.lastUpdateTime) {
    const s = State.lastUpdateTime;
    el.textContent = s.toTimeString().substring(0, 8);
    el.classList.add('flash-small');
    setTimeout(() => el.classList.remove('flash-small'), 400);
  }
}

function updateSummaryBar(tc, tv) {
  const bar = document.getElementById('summaryBar');
  const funds = State.data.funds;
  if (funds.length === 0 || tc === undefined) {
    if (funds.length === 0) { bar.style.display = 'none'; return; }
    let tc2 = 0, tv2 = 0;
    funds.forEach(f => { if (f._curValue != null) { tc2 += f.cost * f.shares; tv2 += f._curValue; } });
    tc = tc2; tv = tv2;
  }
  bar.style.display = 'block';
  const tp = tv - tc;
  const tpr = tc > 0 ? (tp / tc) * 100 : 0;
  const c = tp >= 0 ? 'var(--red)' : 'var(--green)';
  const s = tp >= 0 ? '+' : '';
  document.getElementById('totalCost').textContent = '¥' + tc.toFixed(2);
  document.getElementById('totalValue').textContent = '¥' + tv.toFixed(2);
  const pe = document.getElementById('totalProfit');
  pe.textContent = s + '¥' + tp.toFixed(2); pe.style.color = c;
  const re = document.getElementById('totalProfitRate');
  re.textContent = s + tpr.toFixed(2) + '%'; re.style.color = c;
}

function startAutoRefresh() {
  const interval = State.data.settings.refreshInterval || 15;
  State.countdown = interval;
  if (State.timer) clearInterval(State.timer);
  State.timer = setInterval(() => {
    State.countdown--;
    if (State.countdown <= 0) { State.countdown = interval; doRefresh(); }
    updateTimerDisplay();
  }, 1000);
}
function updateTimerDisplay() {
  const el = document.getElementById('refreshTimer');
  const total = State.data.settings.refreshInterval || 15;
  const pct = State.countdown / total;
  el.textContent = State.countdown + 's';
  el.style.opacity = 0.4 + 0.6 * pct;
  el.style.transform = 'scale(' + (0.85 + 0.15 * pct) + ')';
}

function setupEvents() {
  document.getElementById('btnRefresh').addEventListener('click', async () => {
    State.countdown = State.data.settings.refreshInterval || 15;
    await doRefresh();
  });
  document.getElementById('btnAddFund').addEventListener('click', () => openModal());
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && document.getElementById('modalOverlay').style.display === 'flex') confirmAddFund();
    if ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doRefresh(); }
  });
}

function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

<<<<<<< HEAD
document.addEventListener('DOMContentLoaded', init);
=======
document.addEventListener('DOMContentLoaded', init);
>>>>>>> 35976c2 (﻿fix: BOM清理 + 网络安全配置 + 乱码修复)
