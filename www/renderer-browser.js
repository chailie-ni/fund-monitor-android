// 基金监控 - Android WebView版 (v3 - 修复搜索和直接添加)
(function() {
    var PORTFOLIO_KEY = "fund_portfolio_v3";
    var portfolio = [];
    var indicesData = {};
    var refreshInterval = null;
    var searchTimeout = null;
    var allFundCache = null; // 缓存全部基金数据

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
        try {
            localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
        } catch(e) {}
    }

    // ===== 加载大盘指数 =====
    async function loadIndices() {
        try {
            var resp = await fetchWithTimeout(
                "https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f2,f3,f4,f12,f14&secids=1.000001,0.399001,0.399006,0.000688&fltt=2&invt=2&ut=b2884a393a59ad64002292a3e90d46a5",
                8000
            );
            var json = await resp.json();
            if (json.data && json.data.diff) {
                indicesData = {};
                json.data.diff.forEach(function(item) { indicesData[item.f12] = item; });
                renderIndices();
            }
        } catch(e) {
            console.error("指数加载失败:", e);
        }
    }

    function renderIndices() {
        var container = document.getElementById("indices-container");
        if (!container) return;
        var idxMap = {
            "000001": "上证指数",
            "399001": "深证成指",
            "399006": "创业板指",
            "000688": "科创50"
        };
        container.innerHTML = "";
        Object.keys(idxMap).forEach(function(code) {
            var d = indicesData[code];
            if (!d) return;
            var dir = d.f3 > 0 ? "up" : d.f3 < 0 ? "down" : "flat";
            var sign = d.f3 > 0 ? "+" : "";
            var el = document.createElement("div");
            el.className = "index-card";
            el.innerHTML = '<div class="name">' + idxMap[code] + '</div>' +
                '<div class="code">' + code + '</div>' +
                '<div class="value flash-value">' + d.f2 + '</div>' +
                '<div class="change ' + dir + '">' + sign + d.f3 + '% ' + sign + d.f4 + '</div>';
            container.appendChild(el);
        });
    }

    // ===== 加载基金实时估值 =====
    async function fetchFundGV(code) {
        try {
            var resp = await fetchWithTimeout(
                "https://fundgz.1234567.com.cn/js/" + code + ".js?rt=" + Date.now(),
                8000
            );
            var text = await resp.text();
            var match = text.match(/jsonpgz\((\{.*\})\)/);
            if (match) return JSON.parse(match[1]);
        } catch(e) {}
        return null;
    }

    // ===== 渲染自选基金 =====
    async function renderFunds() {
        var container = document.getElementById("funds-container");
        if (!container || portfolio.length === 0) {
            if (container) {
                container.innerHTML = '<div style="color:#888;font-size:14px;padding:16px;text-align:center">' +
                    '<div style="font-size:32px;margin-bottom:8px">📊</div>' +
                    '暂无持仓<br>点击右上角「添加基金」开始</div>';
            }
            updateTotalGain(0, 0);
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
                var card = document.createElement("div");
                card.className = "fund-card";
                var fundName = (fund.name && fund.name !== fund.code) ? fund.name : (gv.name || fund.code);
                var gvName = escHtml(gv.name || fund.code);
                var fundNameEsc = escHtml(fundName);
                card.innerHTML =
                    '<div class="fund-header">' +
                        '<div><div class="fund-name">' + fundNameEsc + '</div><div class="fund-code">' + fund.code + '</div></div>' +
                        '<div class="fund-gvz"><div class="fund-gv flash-value">' + gv.dwjz + '</div>' +
                        '<div class="fund-zd ' + dir + '">' + sign + gv.gszzl + '%</div></div>' +
                    '</div>' +
                    '<div class="fund-details">' +
                        '<div class="detail-item"><span class="detail-label">持有金额</span><span class="detail-value">¥' + fund.holdAmount.toFixed(2) + '</span></div>' +
                        '<div class="detail-item"><span class="detail-label">成本价</span><span class="detail-value">' + fund.navAmount + '</span></div>' +
                        '<div class="detail-item"><span class="detail-label">当前估值</span><span class="detail-value">¥' + currentValue.toFixed(2) + '</span></div>' +
                        '<div class="detail-item"><span class="detail-label">盈亏</span><span class="detail-value ' + dir + '">' + sign + '¥' + gain.toFixed(2) + ' (' + sign + gainRate.toFixed(2) + '%)</span></div>' +
                    '</div>' +
                    '<div class="fund-actions">' +
                        '<button class="btn danger" onclick="FundMonitor.removeFund(\'' + fund.code + '\')">删除</button>' +
                    '</div>';
                container.appendChild(card);
            } else {
                var card2 = document.createElement("div");
                card2.className = "fund-card";
                var failName = (fund.name && fund.name !== fund.code) ? fund.name : fund.code;
                card2.innerHTML =
                    '<div class="fund-header"><div><div class="fund-name">' + escHtml(failName) + '</div><div class="fund-code">' + fund.code + '</div></div></div>' +
                    '<div style="color:#f39c12;margin:8px 0;font-size:13px">⚠️ 估值加载失败（交易时间外或代码错误）</div>' +
                    '<div class="fund-details">' +
                        '<div class="detail-item"><span class="detail-label">持有金额</span><span class="detail-value">¥' + fund.holdAmount.toFixed(2) + '</span></div>' +
                        '<div class="detail-item"><span class="detail-label">成本价</span><span class="detail-value">' + fund.navAmount + '</span></div>' +
                    '</div>' +
                    '<div class="fund-actions">' +
                        '<button class="btn danger" onclick="FundMonitor.removeFund(\'' + fund.code + '\')">删除</button>' +
                    '</div>';
                container.appendChild(card2);
            }
        }
        container.innerHTML += '</div>';
        updateTotalGain(totalGain, totalCost);
    }

    function updateTotalGain(gain, cost) {
        var el = document.getElementById("total-gain");
        if (!el) return;
        if (cost <= 0) { el.textContent = ""; el.className = "total-gain"; return; }
        var dir = gain >= 0 ? "up" : "down";
        var sign = gain >= 0 ? "+" : "";
        el.className = "total-gain " + dir;
        el.textContent = sign + "¥" + gain.toFixed(2) + " (" + sign + ((gain/cost)*100).toFixed(2) + "%)";
    }

    // ===== 自动刷新 =====
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

    // ===== 辅助函数 =====
    function escHtml(str) {
        if (!str) return "";
        var d = document.createElement("div");
        d.textContent = str;
        return d.innerHTML;
    }

    function fetchWithTimeout(url, ms) {
        return new Promise(function(resolve, reject) {
            var timeout = setTimeout(function() { reject(new Error("timeout")); }, ms);
            fetch(url).then(function(r) {
                clearTimeout(timeout);
                resolve(r);
            }).catch(function(e) {
                clearTimeout(timeout);
                reject(e);
            });
        });
    }

    // ===== 添加基金面板 =====
    function showAddPanel() {
        document.getElementById("add-panel").classList.remove("hidden");
        document.getElementById("search-input").value = "";
        document.getElementById("fund-code").value = "";
        document.getElementById("hold-amount").value = "";
        document.getElementById("nav-amount").value = "1.0000";
        document.getElementById("search-results").innerHTML = "";
        document.getElementById("search-input").focus();
    }

    function hideAddPanel() {
        document.getElementById("add-panel").classList.add("hidden");
    }

    // ===== 基金搜索（带本地缓存）=====
    async function loadAllFunds() {
        if (allFundCache) return allFundCache;
        try {
            var resp = await fetchWithTimeout("https://fund.eastmoney.com/js/fundcode_search.js", 8000);
            var text = await resp.text();
            var json = JSON.parse(text.replace(/var searchDatas=/, "[").replace(/\]$/, "]"));
            allFundCache = json;
            return json;
        } catch(e) {
            // 网络失败时返回空数组
            return [];
        }
    }

    async function searchFund() {
        var q = document.getElementById("search-input").value.trim();
        var results = document.getElementById("search-results");
        if (!q) { results.innerHTML = ""; return; }

        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async function() {
            results.innerHTML = '<div style="padding:10px;color:#888;font-size:12px">🔍 搜索中...</div>';

            var all = await loadAllFunds();
            if (!all || all.length === 0) {
                // 网络失败，显示提示
                results.innerHTML =
                    '<div style="padding:10px;color:#f39c12;font-size:12px">网络搜索不可用</div>' +
                    '<div style="padding:8px 10px;font-size:12px;color:#888">直接输入6位基金代码即可添加</div>';
                return;
            }

            var matches = all.filter(function(f) {
                return f[0].indexOf(q) !== -1 || (f[1] && f[1].indexOf(q) !== -1);
            }).slice(0, 15);

            if (matches.length === 0) {
                results.innerHTML = '<div style="padding:10px;color:#888;font-size:12px">未找到相关基金</div>';
                return;
            }

            results.innerHTML = matches.map(function(f) {
                var code = f[0];
                var name = f[1] || code;
                var safeName = name.replace(/'/g, "\\'");
                return '<div class="search-item" onclick="FundMonitor.selectFund(\'' + code + '\',\'' + safeName + '\')">' +
                    '<div class="fund-name-search">' + escHtml(name) + '</div>' +
                    '<div class="fund-code-search">' + code + '</div>' +
                '</div>';
            }).join("");
        }, 350);
    }

    function selectFund(code, name) {
        document.getElementById("fund-code").value = code;
        document.getElementById("search-input").value = name + " (" + code + ")";
        document.getElementById("search-results").innerHTML = "";
        document.getElementById("hold-amount").focus();
    }

    // ===== 添加基金（支持直接输代码）=====
    function addFund() {
        var codeInput = document.getElementById("fund-code").value.trim();
        var searchInput = document.getElementById("search-input").value.trim();
        var holdAmount = parseFloat(document.getElementById("hold-amount").value);
        var navAmount = parseFloat(document.getElementById("nav-amount").value);

        // 从搜索框自动提取基金代码（处理"名称 (代码)"格式）
        var codeFromSearch = searchInput.match(/\((\d{6})\)$/);
        var code = codeInput || (codeFromSearch ? codeFromSearch[1] : "");

        if (!code) {
            showToast("请输入基金代码");
            return;
        }
        if (!/^\d{6}$/.test(code)) {
            showToast("基金代码应为6位数字");
            return;
        }
        if (!holdAmount || holdAmount <= 0) {
            showToast("请输入持有金额");
            return;
        }
        if (!navAmount || navAmount <= 0) {
            showToast("请输入成本净值");
            return;
        }

        // 提取名称（去掉末尾的代码部分）
        var name = searchInput.replace(/\s*\(\d{6}\)$/, "").trim();
        if (!name || name === code) name = code;

        if (portfolio.filter(function(f) { return f.code === code; }).length > 0) {
            showToast("该基金已在持仓中");
            return;
        }

        portfolio.push({ code: code, name: name, holdAmount: holdAmount, navAmount: navAmount });
        savePortfolio();
        renderFunds();
        hideAddPanel();
        showToast("✅ 添加成功！");
    }

    // ===== 删除基金 =====
    function removeFund(code) {
        if (!confirm("确定删除该基金吗？")) return;
        portfolio = portfolio.filter(function(f) { return f.code !== code; });
        savePortfolio();
        renderFunds();
        showToast("已删除");
    }

    // ===== Toast提示 =====
    function showToast(msg) {
        var t = document.getElementById("toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        setTimeout(function() { t.classList.remove("show"); }, 2500);
    }

    // 暴露给 onclick 使用
    window.FundMonitor = {
        showAddPanel: showAddPanel,
        hideAddPanel: hideAddPanel,
        searchFund: searchFund,
        selectFund: selectFund,
        addFund: addFund,
        removeFund: removeFund,
        showToast: showToast
    };

    document.addEventListener("DOMContentLoaded", init);
})();
