// Minimal msgpack decoder
function decodeMsgpack(buffer) {
  const view = new DataView(buffer);
  let offset = 0;

  function read() {
    const byte = view.getUint8(offset++);

    // Positive fixint (0x00 - 0x7f)
    if (byte <= 0x7f) return byte;

    // Fixmap (0x80 - 0x8f)
    if (byte >= 0x80 && byte <= 0x8f) {
      const len = byte & 0x0f;
      const obj = {};
      for (let i = 0; i < len; i++) {
        const key = read();
        obj[key] = read();
      }
      return obj;
    }

    // Fixarray (0x90 - 0x9f)
    if (byte >= 0x90 && byte <= 0x9f) {
      const len = byte & 0x0f;
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(read());
      return arr;
    }

    // Fixstr (0xa0 - 0xbf)
    if (byte >= 0xa0 && byte <= 0xbf) {
      const len = byte & 0x1f;
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, len));
      offset += len;
      return str;
    }

    // nil
    if (byte === 0xc0) return null;
    // false
    if (byte === 0xc2) return false;
    // true
    if (byte === 0xc3) return true;

    // bin 8
    if (byte === 0xc4) {
      const len = view.getUint8(offset++);
      const bin = new Uint8Array(buffer, offset, len);
      offset += len;
      return bin;
    }

    // bin 16
    if (byte === 0xc5) {
      const len = view.getUint16(offset);
      offset += 2;
      const bin = new Uint8Array(buffer, offset, len);
      offset += len;
      return bin;
    }

    // float 32
    if (byte === 0xca) {
      const val = view.getFloat32(offset);
      offset += 4;
      return val;
    }

    // float 64
    if (byte === 0xcb) {
      const val = view.getFloat64(offset);
      offset += 8;
      return val;
    }

    // uint 8
    if (byte === 0xcc) return view.getUint8(offset++);

    // uint 16
    if (byte === 0xcd) {
      const val = view.getUint16(offset);
      offset += 2;
      return val;
    }

    // uint 32
    if (byte === 0xce) {
      const val = view.getUint32(offset);
      offset += 4;
      return val;
    }

    // uint 64
    if (byte === 0xcf) {
      const val = view.getBigUint64(offset);
      offset += 8;
      return Number(val);
    }

    // int 8
    if (byte === 0xd0) return view.getInt8(offset++);

    // int 16
    if (byte === 0xd1) {
      const val = view.getInt16(offset);
      offset += 2;
      return val;
    }

    // int 32
    if (byte === 0xd2) {
      const val = view.getInt32(offset);
      offset += 4;
      return val;
    }

    // int 64
    if (byte === 0xd3) {
      const val = view.getBigInt64(offset);
      offset += 8;
      return Number(val);
    }

    // str 8
    if (byte === 0xd9) {
      const len = view.getUint8(offset++);
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, len));
      offset += len;
      return str;
    }

    // str 16
    if (byte === 0xda) {
      const len = view.getUint16(offset);
      offset += 2;
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, len));
      offset += len;
      return str;
    }

    // str 32
    if (byte === 0xdb) {
      const len = view.getUint32(offset);
      offset += 4;
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, len));
      offset += len;
      return str;
    }

    // array 16
    if (byte === 0xdc) {
      const len = view.getUint16(offset);
      offset += 2;
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(read());
      return arr;
    }

    // array 32
    if (byte === 0xdd) {
      const len = view.getUint32(offset);
      offset += 4;
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(read());
      return arr;
    }

    // map 16
    if (byte === 0xde) {
      const len = view.getUint16(offset);
      offset += 2;
      const obj = {};
      for (let i = 0; i < len; i++) {
        const key = read();
        obj[key] = read();
      }
      return obj;
    }

    // map 32
    if (byte === 0xdf) {
      const len = view.getUint32(offset);
      offset += 4;
      const obj = {};
      for (let i = 0; i < len; i++) {
        const key = read();
        obj[key] = read();
      }
      return obj;
    }

    // Negative fixint (0xe0 - 0xff)
    if (byte >= 0xe0) return byte - 256;

    return undefined;
  }

  return read();
}

// Calculate average fill price by walking through the order book
function calculateBookAvgPrice(book, side, size) {
  if (!book || size <= 0) return null;

  // For BUY (LONG), we consume asks from lowest to highest
  // For SELL (SHORT), we consume bids from highest to lowest
  const isBuy = side === 'LONG';
  const levels = isBuy ? book.asks : book.bids;

  // Keep original string keys paired with numeric prices for sorting
  const entries = Object.entries(levels).map(([priceStr, sz]) => ({
    priceStr,
    price: parseFloat(priceStr),
    size: sz
  }));

  if (!entries.length) return null;

  // Sort: asks ascending, bids descending
  entries.sort((a, b) => isBuy ? a.price - b.price : b.price - a.price);

  let remainingSize = size;
  let totalCost = 0;
  let filledSize = 0;

  for (const { price, size: availableSize } of entries) {
    const fillSize = Math.min(remainingSize, availableSize);

    totalCost += fillSize * price;
    filledSize += fillSize;
    remainingSize -= fillSize;

    if (remainingSize <= 0) break;
  }

  if (filledSize === 0) return null;

  const bestPrice = entries[0].price;
  const avgPrice = totalCost / filledSize;

  return {
    avgPrice,
    bestPrice,
    filledSize,
    fullyFilled: remainingSize <= 0
  };
}

// Order book storage per market
window._lighterOrderBooks = window._lighterOrderBooks || {};

// Clear order books when changing token/market
window._clearOrderBooks = () => {
  for (const marketId in window._lighterOrderBooks) {
    window._lighterOrderBooks[marketId] = { bids: {}, asks: {} };
  }
  console.log('[Lighter Helper] Order books cleared');
};

// Auto-clear on URL change (token switch)
let _lastPathname = window.location.pathname;
setInterval(() => {
  if (window.location.pathname !== _lastPathname) {
    _lastPathname = window.location.pathname;
    window._clearOrderBooks();
  }
}, 500);

// Track order submission for latency and order book snapshot
window._lighterClickTimestamp = null;
window._lighterBookSnapshot = null;

document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-testid="place-order-button"], [data-testid="order-panel-close-position-button"]');
  if (button) {
    const text = button.innerText?.trim();
    if (text?.includes('Place Market Order') || text?.includes('Close Position')) {
      window._lighterClickTimestamp = Date.now();
      window._lighterBookSnapshot = JSON.parse(JSON.stringify(window._lighterOrderBooks));
    }
  }
}, true);

// WebSocket interceptor
const OriginalWebSocket = window.WebSocket;
window.WebSocket = function(url, protocols) {
  const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
  const orderBooks = window._lighterOrderBooks;

  if (url.includes('zklighter') && url.includes('stream')) {
    console.log('[Lighter Helper] Intercepting WebSocket:', url);

    ws.addEventListener('message', (event) => {
      const handleDecoded = (decoded) => {
        const type = decoded?.type;

        // Capture order book updates (including initial snapshot on subscribe)
        if (type === 'subscribed/order_book' || type === 'update/order_book') {
          const channel = decoded?.channel;
          const marketId = channel?.split(':')[1];
          if (!marketId) return;

          const ob = decoded?.order_book;
          if (!ob) return;

          const bids = ob.bids || [];
          const asks = ob.asks || [];

          // For snapshot (subscribed), reset the order book first
          if (type === 'subscribed/order_book') {
            orderBooks[marketId] = { bids: {}, asks: {} };
            console.log(`[Lighter Helper] Received orderbook snapshot for market ${marketId}: ${bids.length} bids, ${asks.length} asks`);
          }

          // Store order book data
          if (!orderBooks[marketId]) {
            orderBooks[marketId] = { bids: {}, asks: {} };
          }

          // Update bids
          bids.forEach(({ price, size }) => {
            if (parseFloat(size) === 0) {
              delete orderBooks[marketId].bids[price];
            } else {
              orderBooks[marketId].bids[price] = parseFloat(size);
            }
          });

          // Update asks
          asks.forEach(({ price, size }) => {
            if (parseFloat(size) === 0) {
              delete orderBooks[marketId].asks[price];
            } else {
              orderBooks[marketId].asks[price] = parseFloat(size);
            }
          });
          return;
        }

        // Handle trades - update order book by consuming liquidity
        if (type === 'update/trade') {
          const trades = decoded?.trades || [];

          trades.forEach(trade => {
            const marketId = String(trade.market_id);
            const price = String(trade.price);
            const size = parseFloat(trade.size);

            if (orderBooks[marketId]) {
              // Trade consumes from both sides at this price
              if (orderBooks[marketId].asks[price] !== undefined) {
                orderBooks[marketId].asks[price] -= size;
                if (orderBooks[marketId].asks[price] <= 0) {
                  delete orderBooks[marketId].asks[price];
                }
              }
              if (orderBooks[marketId].bids[price] !== undefined) {
                orderBooks[marketId].bids[price] -= size;
                if (orderBooks[marketId].bids[price] <= 0) {
                  delete orderBooks[marketId].bids[price];
                }
              }
            }
          });
        }

        // Handle my trades for notifications
        if (type !== 'update/trade') return;

        const myAccount = localStorage.getItem(ACCOUNT_INDEX_KEY);
        const trades = decoded?.trades || [];

        const myTrades = trades.filter(t =>
          String(t.ask_account_id) === myAccount ||
          String(t.bid_account_id) === myAccount
        );

        if (myTrades.length > 0) {
          console.log('[Lighter Helper] My trades:', JSON.stringify(myTrades, null, 2));

          // Group trades by order ID (ask_id if selling, bid_id if buying)
          const orderGroups = {};
          myTrades.forEach(trade => {
            const isBuy = String(trade.bid_account_id) === myAccount;
            const orderId = isBuy ? trade.bid_id : trade.ask_id;

            if (!orderGroups[orderId]) {
              orderGroups[orderId] = {
                trades: [],
                isBuy,
                marketId: String(trade.market_id)
              };
            }
            orderGroups[orderId].trades.push(trade);
          });

          // Process each aggregated order
          Object.values(orderGroups).forEach(group => {
            const { trades, isBuy, marketId } = group;
            const side = isBuy ? 'LONG' : 'SHORT';

            // Use snapshot if available (captured at click time), otherwise use live book
            const snapshotBook = window._lighterBookSnapshot?.[marketId];
            const book = snapshotBook || orderBooks[marketId];
            console.log('[Lighter Helper] Using', snapshotBook ? 'SNAPSHOT' : 'LIVE', 'order book');

            // Aggregate: total size and volume-weighted price
            let totalSize = 0;
            let totalValue = 0;
            trades.forEach(t => {
              const s = parseFloat(t.size);
              const p = parseFloat(t.price);
              totalSize += s;
              totalValue += s * p;
            });
            const avgPrice = totalValue / totalSize;

            console.log('[Lighter Helper] Aggregated order:', { side, totalSize, avgPrice, fills: trades.length });

            // Calculate book average price for the TOTAL size
            const bookResult = calculateBookAvgPrice(book, side, totalSize);

            // Get best bid/ask from the same book (snapshot or live)
            let bestBid = null, bestAsk = null;
            if (book) {
              const bidPrices = Object.keys(book.bids || {}).map(Number);
              const askPrices = Object.keys(book.asks || {}).map(Number);
              if (bidPrices.length) bestBid = Math.max(...bidPrices);
              if (askPrices.length) bestAsk = Math.min(...askPrices);
            }

            // Calculate latency from click to trade confirmation
            let latency = null;
            if (window._lighterClickTimestamp) {
              latency = Date.now() - window._lighterClickTimestamp;
              window._lighterClickTimestamp = null;
              window._lighterBookSnapshot = null;
            }

            // Send to content.js via postMessage
            window.postMessage({
              type: 'LIGHTER_HELPER_TRADE',
              payload: {
                symbol: `Market ${marketId}`,
                side,
                price: avgPrice,
                size: totalSize,
                bestBid,
                bestAsk,
                // Book average price for size-adjusted spread calculation
                bookAvgPrice: bookResult?.avgPrice,
                bookBestPrice: bookResult?.bestPrice,
                latency
              }
            }, '*');
          });
        }
      };

      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buffer => {
          try {
            handleDecoded(decodeMsgpack(buffer));
          } catch (e) {}
        });
      } else if (event.data instanceof ArrayBuffer) {
        try {
          handleDecoded(decodeMsgpack(event.data));
        } catch (e) {}
      }
    });
  }

  return ws;
};
window.WebSocket.prototype = OriginalWebSocket.prototype;

// ===== Spread Monitor: Print spread every 10 seconds =====
// Toggle with: window._spreadMonitor = true/false
window._spreadMonitor = false;

setInterval(() => {
  if (!window._spreadMonitor) return;

  const usdSizes = [1000, 5000, 25000, 50000, 100000, 250000, 500000];
  const orderBooks = window._lighterOrderBooks;

  Object.entries(orderBooks).forEach(([marketId, book]) => {
    const bidPrices = Object.keys(book.bids || {}).map(Number);
    const askPrices = Object.keys(book.asks || {}).map(Number);

    if (!bidPrices.length || !askPrices.length) return;

    const bestBid = Math.max(...bidPrices);
    const bestAsk = Math.min(...askPrices);
    const midPrice = (bestBid + bestAsk) / 2;
    const bidAskSpread = (bestAsk - bestBid) / midPrice;
    const halfBidAskSpread = bidAskSpread / 2;

    // Total liquidity (no filtering)
    const totalBidLiquidity = Object.values(book.bids || {}).reduce((a, b) => a + b, 0);
    const totalAskLiquidity = Object.values(book.asks || {}).reduce((a, b) => a + b, 0);
    const bidLevels = Object.keys(book.bids || {}).length;
    const askLevels = Object.keys(book.asks || {}).length;

    // Liquidity in USD
    const bidLiquidityUSD = totalBidLiquidity * midPrice;
    const askLiquidityUSD = totalAskLiquidity * midPrice;

    const formatUSD = (v) => v >= 1000000 ? `${(v/1000000).toFixed(2)}M` : `${(v/1000).toFixed(0)}k`;

    console.log(`\n[Spread Monitor] Market ${marketId} | Bid: ${bestBid.toFixed(4)} | Ask: ${bestAsk.toFixed(4)}`);
    console.log(`Levels: ${bidLevels} bids / ${askLevels} asks | Liquidity: $${formatUSD(bidLiquidityUSD)} bid / $${formatUSD(askLiquidityUSD)} ask`);
    console.log('─'.repeat(70));

    console.log('   USD $ | AvgBuy       | AvgSell      | Spread   | Cost $');

    usdSizes.forEach(usd => {
      // Convert USD to size using mid price
      const size = usd / midPrice;

      // Calculate for BUY side (consuming asks)
      const buyResult = calculateBookAvgPrice(book, 'LONG', size);
      // Calculate for SELL side (consuming bids)
      const sellResult = calculateBookAvgPrice(book, 'SHORT', size);

      const avgBuy = buyResult?.fullyFilled ? buyResult.avgPrice : null;
      const avgSell = sellResult?.fullyFilled ? sellResult.avgPrice : null;

      // Spread = (avgBuy - avgSell) / midPrice
      const spread = (avgBuy !== null && avgSell !== null)
        ? (avgBuy - avgSell) / midPrice
        : null;

      // Cost in USD = spread * position size
      const costUsd = spread !== null ? spread * usd : null;

      const usdStr = usd >= 1000 ? `${(usd / 1000).toFixed(0)}k` : usd.toString();
      const avgBuyStr = avgBuy !== null ? avgBuy.toFixed(4) : 'N/A';
      const avgSellStr = avgSell !== null ? avgSell.toFixed(4) : 'N/A';
      const spreadStr = spread !== null ? `${(spread * 100).toFixed(4)}%` : 'N/A';
      const costStr = costUsd !== null ? `$${costUsd.toFixed(2)}` : 'N/A';

      console.log(
        `${usdStr.padStart(8)} | ` +
        `${avgBuyStr.padStart(12)} | ` +
        `${avgSellStr.padStart(12)} | ` +
        `${spreadStr.padStart(8)} | ` +
        `${costStr.padStart(8)}`
      );
    });
  });
}, 10000);

// Nonce cache per account_index
const nonceCache = {};  // { accountIndex: nonce }

const ACCOUNT_INDEX_KEY = 'lighter_helper_account_index';

const originalFetch = window.fetch;

// Prefetch nonce on load if we have a saved account_index
async function prefetchNonce() {
  const savedAccountIndex = localStorage.getItem(ACCOUNT_INDEX_KEY);
  if (!savedAccountIndex) {
    return;
  }

  try {
    const response = await originalFetch(`https://mainnet.zklighter.elliot.ai/api/v1/nextNonce?account_index=${savedAccountIndex}&api_key_index=0`);
    const data = await response.json();

    if (data.code === 200 && data.nonce != null) {
      nonceCache[savedAccountIndex] = data.nonce;
      console.log('[Lighter Helper] Prefetched nonce for', savedAccountIndex, ':', data.nonce);
    }
  } catch (e) {}
}

prefetchNonce();

window.fetch = async function(...args) {
  const [url, options] = args;
  const urlStr = typeof url === 'string' ? url : url.toString();

  // Intercept nextNonce requests
  if (urlStr.includes('/api/v1/nextNonce')) {
    const urlObj = new URL(urlStr);
    const accountIndex = urlObj.searchParams.get('account_index');

    // Save account_index for trade tracking
    if (accountIndex) {
      localStorage.setItem(ACCOUNT_INDEX_KEY, accountIndex);
    }

    // If we have a cached nonce for THIS account, return it
    if (accountIndex && nonceCache[accountIndex] != null) {
      const nonceToReturn = nonceCache[accountIndex];
      nonceCache[accountIndex]++;

      console.log('[Lighter Helper] Cached nonce for', accountIndex, ':', nonceToReturn);

      return new Response(JSON.stringify({ code: 200, nonce: nonceToReturn }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // No cache for this account, make real request and cache result
    const response = await originalFetch.apply(this, args);
    const cloned = response.clone();

    try {
      const data = await cloned.json();
      if (data.code === 200 && data.nonce != null) {
        // App will use this nonce, cache the next one
        nonceCache[accountIndex] = data.nonce + 1;
        console.log('[Lighter Helper] Real nonce for', accountIndex, ':', data.nonce, '(cached next:', nonceCache[accountIndex], ')');
      }
    } catch (e) {}

    return response;
  }

  // Intercept sendTx to detect nonce errors
  if (urlStr.includes('/api/v1/sendTx')) {
    const response = await originalFetch.apply(this, args);
    const cloned = response.clone();

    try {
      const data = await cloned.json();
      if (data.code === 21104) {
        // Invalid nonce - clear ALL caches to resync
        console.log('[Lighter Helper] Invalid nonce, clearing cache');
        Object.keys(nonceCache).forEach(k => delete nonceCache[k]);
      }
    } catch (e) {}

    return response;
  }

  return originalFetch.apply(this, args);
};
