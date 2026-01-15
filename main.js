const API_BASE = "https://api.coingecko.com/api/v3";

const form = document.getElementById("search-form");
const queryInput = document.getElementById("coin-query");
const statusEl = document.getElementById("status");
const coinNameEl = document.getElementById("coin-name");
const coinMetaEl = document.getElementById("coin-meta");
const chartCanvas = document.getElementById("price-chart");
const upbitChartCanvas = document.getElementById("upbit-chart");
const historyListEl = document.getElementById("history-list");

let priceChart = null;
let upbitChart = null;
let recentCoins = [];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const setStatus = (message, type = "info") => {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
};

const KOREAN_ALIASES = {
  비트코인: "bitcoin",
  이더리움: "ethereum",
  이더: "ethereum",
  리플: "ripple",
  솔라나: "solana",
  도지: "dogecoin",
  도지코인: "dogecoin",
  폴카닷: "polkadot",
  에이다: "cardano",
  카르다노: "cardano",
  트론: "tron",
  체인링크: "chainlink",
  라이트코인: "litecoin",
  유니스왑: "uniswap",
  아발란체: "avalanche-2",
};

const resolveAlias = (query) => {
  const trimmed = query.trim();
  return KOREAN_ALIASES[trimmed] || trimmed;
};

const pickBestMatch = (coins, query) => {
  const needle = query.toLowerCase();
  return (
    coins.find(
      (coin) =>
        coin.name.toLowerCase() === needle ||
        coin.symbol.toLowerCase() === needle
    ) || coins[0]
  );
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`요청 실패 (${response.status})`);
  }
  return response.json();
};

const buildChart = (labels, prices, label) => {
  if (priceChart) {
    priceChart.destroy();
  }

  priceChart = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: prices,
          borderColor: "#f5b63a",
          backgroundColor: "rgba(245, 182, 58, 0.2)",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: "#f4f1ea",
            font: {
              family: "Space Grotesk",
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${usdFormatter.format(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#9aa4b2",
            maxTicksLimit: 8,
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
          },
        },
        y: {
          ticks: {
            color: "#9aa4b2",
            callback: (value) => usdFormatter.format(value),
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
          },
        },
      },
    },
  });
};

const buildUpbitChart = (labels, values) => {
  if (upbitChart) {
    upbitChart.destroy();
  }

  const minHeight = 360;
  const rowHeight = 26;
  upbitChartCanvas.height = Math.max(minHeight, labels.length * rowHeight);

  upbitChart = new Chart(upbitChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "24시간 누적 거래대금 (KRW)",
          data: values,
          backgroundColor: "rgba(59, 130, 246, 0.35)",
          borderColor: "rgba(59, 130, 246, 0.8)",
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: {
          labels: {
            color: "#f4f1ea",
            font: {
              family: "Space Grotesk",
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${compactFormatter.format(context.parsed.y)} KRW`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#9aa4b2",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
          },
        },
        y: {
          ticks: {
            color: "#9aa4b2",
            autoSkip: false,
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
          },
        },
      },
    },
  });
};

const updateCoinMeta = (coin, latestPrice, previousPrice) => {
  const change =
    previousPrice && latestPrice
      ? ((latestPrice - previousPrice) / previousPrice) * 100
      : 0;
  const changeLabel = Number.isFinite(change)
    ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
    : "N/A";

  const rank = coin.market_cap_rank
    ? `시가총액 순위 ${coin.market_cap_rank}위`
    : "시가총액 순위 정보 없음";

  coinNameEl.textContent = `${coin.name} (${coin.symbol.toUpperCase()})`;
  coinMetaEl.textContent = `${rank} · 최근 가격 ${usdFormatter.format(
    latestPrice
  )} · 연간 변동 ${changeLabel}`;
};

const renderHistory = () => {
  historyListEl.innerHTML = "";

  if (recentCoins.length === 0) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.textContent = "아직 검색한 코인이 없습니다.";
    historyListEl.appendChild(empty);
    return;
  }

  recentCoins.forEach((coin) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-chip";
    button.textContent = `${coin.name} (${coin.symbol.toUpperCase()})`;
    button.addEventListener("click", () => {
      queryInput.value = coin.name;
      form.requestSubmit();
    });
    historyListEl.appendChild(button);
  });
};

const addToHistory = (coin) => {
  recentCoins = recentCoins.filter((item) => item.id !== coin.id);
  recentCoins.unshift(coin);
  recentCoins = recentCoins.slice(0, 6);
  renderHistory();
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query) {
    setStatus("검색어를 입력해 주세요.", "error");
    return;
  }

  const resolvedQuery = resolveAlias(query);
  const submitButton = form.querySelector("button");
  submitButton.disabled = true;
  submitButton.textContent = "불러오는 중...";
  setStatus("CoinGecko에서 데이터를 가져오는 중입니다.", "loading");

  try {
    const searchData = await fetchJson(
      `${API_BASE}/search?query=${encodeURIComponent(resolvedQuery)}`
    );

    if (!searchData.coins || searchData.coins.length === 0) {
      throw new Error("검색 결과가 없습니다.");
    }

    const coin = pickBestMatch(searchData.coins, resolvedQuery);
    const chartData = await fetchJson(
      `${API_BASE}/coins/${coin.id}/market_chart?vs_currency=usd&days=365`
    );

    if (!chartData.prices || chartData.prices.length === 0) {
      throw new Error("시세 데이터가 비어 있습니다.");
    }

    const labels = chartData.prices.map(([timestamp]) =>
      new Date(timestamp).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      })
    );

    const prices = chartData.prices.map(([, price]) => price);
    const latestPrice = prices[prices.length - 1];
    const previousPrice = prices[0];

    buildChart(labels, prices, `${coin.name} 1년 시세 (USD)`);
    updateCoinMeta(coin, latestPrice, previousPrice);
    addToHistory(coin);

    setStatus(
      `${coin.name} 데이터를 불러왔습니다. 1년 평균 가격: ${compactFormatter.format(
        prices.reduce((sum, value) => sum + value, 0) / prices.length
      )} USD`,
      "success"
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "검색";
  }
});

renderHistory();

const loadUpbitChart = async () => {
  try {
    const markets = await fetchJson(
      "https://api.upbit.com/v1/market/all?isDetails=false"
    );
    const krwMarkets = markets
      .filter((market) => market.market.startsWith("KRW-"))
      .map((market) => market.market);

    const chunkSize = 100;
    const allTickers = [];
    for (let i = 0; i < krwMarkets.length; i += chunkSize) {
      const chunk = krwMarkets.slice(i, i + chunkSize);
      const tickers = await fetchJson(
        `https://api.upbit.com/v1/ticker?markets=${chunk.join(",")}`
      );
      allTickers.push(...tickers);
    }

    const topTickers = allTickers
      .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
      .slice(0, 12);

    const labels = topTickers.map((ticker) => ticker.market.replace("KRW-", ""));
    const values = topTickers.map((ticker) => ticker.acc_trade_price_24h);

    buildUpbitChart(labels, values);
  } catch (error) {
    if (upbitChartCanvas) {
      upbitChartCanvas.parentElement.innerHTML =
        '<p class="muted">업비트 데이터를 불러오지 못했습니다.</p>';
    }
  }
};

loadUpbitChart();
