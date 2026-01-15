const API_BASE = "https://api.coingecko.com/api/v3";

const form = document.getElementById("search-form");
const queryInput = document.getElementById("coin-query");
const statusEl = document.getElementById("status");
const coinNameEl = document.getElementById("coin-name");
const coinMetaEl = document.getElementById("coin-meta");
const chartCanvas = document.getElementById("price-chart");

let priceChart = null;

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query) {
    setStatus("검색어를 입력해 주세요.", "error");
    return;
  }

  const submitButton = form.querySelector("button");
  submitButton.disabled = true;
  submitButton.textContent = "불러오는 중...";
  setStatus("CoinGecko에서 데이터를 가져오는 중입니다.", "loading");

  try {
    const searchData = await fetchJson(
      `${API_BASE}/search?query=${encodeURIComponent(query)}`
    );

    if (!searchData.coins || searchData.coins.length === 0) {
      throw new Error("검색 결과가 없습니다.");
    }

    const coin = pickBestMatch(searchData.coins, query);
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
