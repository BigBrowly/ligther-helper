const ORDERS_KEY = 'orders';

const tbody = document.getElementById('orders');
const statsEl = document.getElementById('stats');
const clearBtn = document.getElementById('clear');

chrome.storage.local.get(ORDERS_KEY, ({ orders = [] }) => {
  renderOrders(orders);
  renderStats(orders);
});

clearBtn.onclick = () => {
  chrome.storage.local.set({ [ORDERS_KEY]: [] }, () => {
    tbody.innerHTML = '';
    statsEl.textContent = '';
  });
};

function renderOrders(orders) {
  tbody.innerHTML = '';

  orders
    .slice()
    .reverse()
    .forEach(order => {
      const tr = document.createElement('tr');

      const slipPercent =
        order.slipRatio != null
          ? order.slipRatio * 100
          : null;

      const spreadPercent =
        order.spread != null
          ? order.spread * 100
          : null;

      if (slipPercent != null) {
        tr.className = slipPercent >= 0 ? 'negative' : 'positive';
      }

      tr.innerHTML = `
        <td>${new Date(order.timestamp).toLocaleTimeString()}</td>
        <td class="symbol">${order.symbol}</td>
        <td>${order.side}</td>
        <td>${order.size}</td>
        <td>${order.bestPrice ?? '-'}</td>
        <td>${order.price ?? '-'}</td>
        <td>${spreadPercent != null ? spreadPercent.toFixed(4) : '-'}</td>
        <td>${slipPercent != null ? slipPercent.toFixed(4) : '-'}</td>
        <td>${order.cost?.toFixed(2) ?? '-'}</td>
        <td>${order.latency != null ? order.latency + ' ms' : '-'}</td>
      `;

      tbody.appendChild(tr);
    });
}

function renderStats(orders) {
  if (!orders.length) {
    statsEl.textContent = 'No orders';
    return;
  }

  // Filter valid values
  const validLatencies = orders.map(o => o.latency).filter(l => typeof l === 'number');
  const validSlips = orders.map(o => o.slipRatio).filter(s => typeof s === 'number');
  const validSpreads = orders.map(o => o.spread).filter(s => typeof s === 'number');

  const avgLatency = validLatencies.length
    ? validLatencies.reduce((a, l) => a + l, 0) / validLatencies.length
    : 0;

  const avgSlip = validSlips.length
    ? validSlips.reduce((a, s) => a + s, 0) / validSlips.length
    : 0;

  const avgSpread = validSpreads.length
    ? validSpreads.reduce((a, s) => a + s, 0) / validSpreads.length
    : 0;

  const totalCost = orders
    .map(o => o.cost ?? 0)
    .reduce((a, c) => a + c, 0);

  statsEl.innerHTML =
    `Orders: ${orders.length} | Total Cost: $${totalCost.toFixed(2)}<br>` +
    `Avg Latency: ${avgLatency.toFixed(1)} ms | Avg Spread: ${(avgSpread * 100).toFixed(4)}% | Avg Slip: ${(avgSlip * 100).toFixed(4)}%`;
}
