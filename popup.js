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
    renderStats([]);
  });
};

function renderOrders(orders) {
  tbody.innerHTML = '';

  if (!orders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div>No orders recorded yet</div>
        </td>
      </tr>
    `;
    return;
  }

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

      const slipClass = slipPercent != null
        ? (slipPercent >= 0 ? 'slip-negative' : 'slip-positive')
        : '';

      const sideClass = order.side === 'LONG' ? 'badge-long' : 'badge-short';

      tr.innerHTML = `
        <td>${new Date(order.timestamp).toLocaleTimeString()}</td>
        <td class="symbol">${order.symbol}</td>
        <td><span class="badge ${sideClass}">${order.side}</span></td>
        <td>${formatNumber(order.size)}</td>
        <td>${formatPrice(order.bestPrice)}</td>
        <td>${formatPrice(order.price)}</td>
        <td>${spreadPercent != null ? spreadPercent.toFixed(3) + '%' : '-'}</td>
        <td class="${slipClass}">${slipPercent != null ? slipPercent.toFixed(3) + '%' : '-'}</td>
        <td class="cost">$${order.cost?.toFixed(2) ?? '-'}</td>
        <td class="latency">${order.latency != null ? order.latency + 'ms' : '-'}</td>
      `;

      tbody.appendChild(tr);
    });
}

function renderStats(orders) {
  if (!orders.length) {
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="label">Orders</div>
        <div class="value">0</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Cost</div>
        <div class="value">$0.00</div>
      </div>
      <div class="stat-card">
        <div class="label">Avg Latency</div>
        <div class="value">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Avg Spread</div>
        <div class="value">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Avg Slippage</div>
        <div class="value">-</div>
      </div>
    `;
    return;
  }

  const validLatencies = orders.map(o => o.latency).filter(l => typeof l === 'number');
  const validSlips = orders.map(o => o.slipRatio).filter(s => typeof s === 'number');
  const validSpreads = orders.map(o => o.spread).filter(s => typeof s === 'number');

  const avgLatency = validLatencies.length
    ? validLatencies.reduce((a, l) => a + l, 0) / validLatencies.length
    : null;

  const avgSlip = validSlips.length
    ? validSlips.reduce((a, s) => a + s, 0) / validSlips.length
    : null;

  const avgSpread = validSpreads.length
    ? validSpreads.reduce((a, s) => a + s, 0) / validSpreads.length
    : null;

  const totalCost = orders
    .map(o => o.cost ?? 0)
    .reduce((a, c) => a + c, 0);

  const slipClass = avgSlip != null ? (avgSlip >= 0 ? 'negative' : 'positive') : '';

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="label">Orders</div>
      <div class="value">${orders.length}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Cost</div>
      <div class="value negative">$${totalCost.toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Avg Latency</div>
      <div class="value">${avgLatency != null ? avgLatency.toFixed(0) + 'ms' : '-'}</div>
    </div>
    <div class="stat-card">
      <div class="label">Avg Spread</div>
      <div class="value">${avgSpread != null ? (avgSpread * 100).toFixed(3) + '%' : '-'}</div>
    </div>
    <div class="stat-card">
      <div class="label">Avg Slippage</div>
      <div class="value ${slipClass}">${avgSlip != null ? (avgSlip * 100).toFixed(3) + '%' : '-'}</div>
    </div>
  `;
}

function formatNumber(num) {
  if (num == null) return '-';
  return Number(num).toLocaleString();
}

function formatPrice(price) {
  if (price == null) return '-';
  return Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}
