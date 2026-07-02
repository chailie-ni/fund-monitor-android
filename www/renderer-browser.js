// 基金监控 - Android WebView版
const PORTFOLIO_KEY = "fund_portfolio_v2";
var portfolio = [];
var indicesData = {};
var refreshInterval = null;
var searchTimeout = null;

function init() {
    loadPortfolio();
    loadIndices();
    startRefresh();
    renderFunds();
}

function loadPortfolio() {
    try {
        var stored = localStorage.getItem(PORTFOLIO_KEY);
        if (stored) portfolio = JSON.parse(stored);
    } catch(e) { portfolio = []; }
}

function savePortfolio() {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
}

async function loadIndices() {
    try {
        var resp = await fetch("https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f2,f3,f4,f12,f14&secids=1.000001,0.399001,0.399006,0.000688&fltt=2&invt=2&ut=b2884a393a59ad64002292a3e90d46a5");
        var json = await resp.json();
        if (json.data && json.data.diff) {
            indicesData = {};
            json.data.diff.forEach(function(item) { indicesData[item.f12] = item; });
            renderIndices();
        }
    } catch(e) { console.error("指数加载失败:", e); }
}

function renderIndices() {
    var container = document.getElementById("indices-container");
    if (!container) return;
    var idxMap = { "000001": "上证指数", "399001": "深证成指", "399006": "创业板指", "000688": "科创50" };
    container.innerHTML = "";
    Object.keys(idxMap).forEach(function(code) {
        var d = indicesData[code];
        if (!d) return;
        var dir = d.f3 > 0 ? "up" : d.f3 < 0 ? "down" : "flat";
        var sign = d.f3 > 0 ? "+" : "";
        var el = document.createElement("div");
        el.className = "index-card";
        el.innerHTML = '<div class="name">' + idxMap[code] + '</div><div class="code">' + code + '</div><div class="value flash-value">' + d.f2 + '</div><div class="change ' + dir + '">' + sign + d.f3 + '% ' + sign + d.f4 + '</div>';
        container.appendChild(el);
    });
}

async function fetchFundGV(code) {
    try {
        var resp = await fetch("https://fundgz.1234567.com.cn/js/" + code + ".js?rt=" + Date.now());
        var text = await resp.text();
        var match = text.match(/jsonpgz\((\{.*\})\)/);
        if (match) return JSON.parse(match[1]);
    } catch(e) {}
    return null;
}

function escHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

async function renderFunds() {
    var container = document.getElementById("funds-container");
    if (!container || portfolio.length === 0) {
        if (container) container.innerHTML = '<div style="color:#666;font-size:14px;padding:16px">暂无持仓，点击右上角添加</div>';
        return;
    }
    var totalGain = 0, totalCost = 0;
    container.innerHTML = '<div class="funds-grid">';
    for (var i = 0; i < portfolio.length; i++) {
        var fund = portfolio[i];
        var gv = await fetchFundGV(fund.code);
        if (gv && gv.dwjz) {
            var currentValue = (fund.holdAmount / fund.navAmount) * parseFloat(gv.dwjz);
            var gain = currentValue - fund.holdAmount;
            var gainRate = ((currentValue / fund.holdAmount) - 1) * 100;
            totalGain += gain; totalCost += fund.holdAmount;
            var dir = gain >= 0 ? "up" : "down";
            var sign = gain >= 0 ? "+" : "";
            var fundName = fund.name || fund.code;
            var rmCode = fund.code;
            var card = document.createElement("div");
            card.className = "fund-card";
            card.innerHTML = '<div class="fund-header"><div><div class="fund-name">' + escHtml(fundName) + '</div><div class="fund-code">' + rmCode + '</div></div><div class="fund-gvz"><div class="fund-gv flash-value">' + gv.dwjz + '</div><div class="fund-zd ' + dir + '">' + sign + gv.gszzl + '%</div></div></div><div class="fund-details"><div class="detail-item"><span class="detail-label">持有金额</span><span class="detail-value">¥' + fund.holdAmount.toFixed(2) + '</span></div><div class="detail-item"><span class="detail-label">成本价</span><span class="detail-value">' + fund.navAmount + '</span></div><div class="detail-item"><span class="detail-label">当前估值</span><span class="detail-value">¥' + currentValue.toFixed(2) + '</span></div><div class="detail-item"><span class="detail-label">盈亏</span><span class="detail-value ' + dir + '">' + sign + '¥' + gain.toFixed(2) + ' (' + sign + gainRate.toFixed(2) + '%)</span></div></div><div class="fund-actions"><button class="btn danger" onclick="removeFund(\'' + rmCode + '\')">删除</button></div>';
            container.appendChild(card);
        } else {
            var card2 = document.createElement("div");
            card2.className = "fund-card";
            card2.innerHTML = '<div class="fund-name">' + escHtml(fund.name || fund.code) + ' (' + fund.code + ')</div><div style="color:#888;margin-top:8px">估值加载失败</div><div class="fund-actions"><button class="btn danger" onclick="removeFund(\'' + fund.code + '\')">删除</button></div>';
            container.appendChild(card2);
        }
    }
    container.innerHTML += '</div>';
    var totalEl = document.getElementById("total-gain");
    if (totalEl && totalCost > 0) {
        var totalDir = totalGain >= 0 ? "up" : "down";
        var totalSign = totalGain >= 0 ? "+" : "";
        totalEl.className = "total-gain " + totalDir;
        totalEl.textContent = totalSign + "¥" + totalGain.toFixed(2) + " (" + totalSign + ((totalGain/totalCost)*100).toFixed(2) + "%)";
    }
}

function startRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    var seconds = 15;
    function updateTimer() {
        var el = document.getElementById("refresh-timer");
        if (el) el.textContent = seconds + "s后刷新";
    }
    updateTimer();
    refreshInterval = setInterval(function() {
        seconds--;
        if (seconds <= 0) { seconds = 15; loadIndices(); renderFunds(); }
        updateTimer();
    }, 1000);
}

function showAddPanel() {
    document.getElementById("add-panel").classList.remove("hidden");
    document.getElementById("search-input").value = "";
    document.getElementById("fund-code").value = "";
    document.getElementById("hold-amount").value = "";
    document.getElementById("nav-amount").value = "1.0000";
    document.getElementById("search-results").innerHTML = "";
}

function hideAddPanel() {
    document.getElementById("add-panel").classList.add("hidden");
}

async function searchFund() {
    var q = document.getElementById("search-input").value.trim();
    var results = document.getElementById("search-results");
    if (!q) { results.innerHTML = ""; return; }
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async function() {
        try {
            var resp = await fetch("https://fund.eastmoney.com/js/fundcode_search.js");
            var text = await resp.text();
            var json = JSON.parse(text.replace(/var searchDatas=\[/, "[").replace(/\]$/, "]"));
            var matches = json.filter(function(f) { return f[0].indexOf(q) !== -1 || f[1].indexOf(q) !== -1; }).slice(0, 10);
            results.innerHTML = matches.map(function(f) {
                return '<div class="search-item" onclick="selectFund(\'' + f[0] + '\', \'' + f[1].replace(/'/g, "\\'") + '\')"><div class="fund-name-search">' + escHtml(f[1]) + '</div><div class="fund-code-search">' + f[0] + '</div></div>';
            }).join("");
        } catch(e) { results.innerHTML = '<div style="padding:10px;color:#888">搜索失败</div>'; }
    }, 300);
}

function selectFund(code, name) {
    document.getElementById("fund-code").value = code;
    document.getElementById("search-input").value = name + " (" + code + ")";
    document.getElementById("search-results").innerHTML = "";
}

function addFund() {
    var code = document.getElementById("fund-code").value.trim();
    var holdAmount = parseFloat(document.getElementById("hold-amount").value);
    var navAmount = parseFloat(document.getElementById("nav-amount").value);
    var nameInput = document.getElementById("search-input").value.trim().replace(/\s*\(\d+\)$/, "");
    if (!code || !holdAmount || !navAmount) { showToast("请填写完整信息"); return; }
    if (portfolio.filter(function(f) { return f.code === code; }).length > 0) { showToast("该基金已添加"); return; }
    portfolio.push({ code: code, name: nameInput, holdAmount: holdAmount, navAmount: navAmount });
    savePortfolio();
    renderFunds();
    hideAddPanel();
    showToast("添加成功");
}

function removeFund(code) {
    portfolio = portfolio.filter(function(f) { return f.code !== code; });
    savePortfolio();
    renderFunds();
}

function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function() { t.classList.remove("show"); }, 2500);
}

document.addEventListener("DOMContentLoaded", init);
