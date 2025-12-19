const ORDERS_KEY = 'orders';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(ORDERS_KEY, (result) => {
    if (result[ORDERS_KEY] === undefined) {
      chrome.storage.local.set({ [ORDERS_KEY]: [] });
    }
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return;

  const iconUrl = 'https://app.lighter.xyz/assets/fartcoin-CAgd0qdd.png';

  // === Market order filled notification ===
  if (message.type === 'MARKET_NOTIFICATION_FILLED') {
    const { symbol, side, price, size, bestBid, bestAsk, bookAvgPrice, bookBestPrice, latency } = message.payload;

    // Calculate spread using book average price (size-adjusted) or fall back to simple bid-ask
    let spread, bestPrice, slippage, slipRatio;
    const spreadText = `${bestBid?.toFixed(4) || '-'}/${bestAsk?.toFixed(4) || '-'}`;

    // Base bid-ask spread (half, since we only pay our side)
    const bidAskSpread = (bestAsk && bestBid) ? (bestAsk - bestBid) / ((bestAsk + bestBid) / 2) : 0;
    const halfBidAskSpread = bidAskSpread / 2;

    if (bookAvgPrice && bookBestPrice) {
      // Depth impact: how much worse than best price due to order book depth
      const depthImpact = Math.abs(bookAvgPrice - bookBestPrice) / bookBestPrice;

      // Total spread = half bid-ask + depth impact
      spread = halfBidAskSpread + depthImpact;
      bestPrice = bookBestPrice;

      // Slippage: difference between actual execution and book avg price
      if (side === 'LONG') {
        slippage = price - bookAvgPrice;
        slipRatio = bookAvgPrice ? slippage / bookAvgPrice : 0;
      } else {
        slippage = bookAvgPrice - price;
        slipRatio = bookAvgPrice ? slippage / bookAvgPrice : 0;
      }
    } else {
      // Fallback to simple half bid-ask spread
      spread = halfBidAskSpread;

      if (side === 'LONG') {
        bestPrice = bestAsk;
        slippage = bestPrice ? price - bestPrice : 0;
        slipRatio = bestPrice ? slippage / bestPrice : 0;
      } else {
        bestPrice = bestBid;
        slippage = bestPrice ? bestPrice - price : 0;
        slipRatio = bestPrice ? slippage / bestPrice : 0;
      }
    }

    // Cost = size * price * (spread + slippage)
    // Slippage can be negative (better execution) or positive (worse execution)
    const cost = size * price * (spread + slipRatio);

    chrome.storage.local.get(ORDERS_KEY, ({ orders = [] }) => {
      orders.push({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        symbol,
        side,
        price,
        size,
        bestPrice,
        spread,
        slipRatio,
        cost,
        latency
      });
      chrome.storage.local.set({ [ORDERS_KEY]: orders });
    });

    chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title: 'Trade Filled',
      message:
        `${symbol} - ${side}\n` +
        `Bid/Ask: ${spreadText}\n` +
        `Price: ${price?.toFixed(4) || '-'}\n` +
        `Spread: ${(spread * 100).toFixed(4)}%\n` +
        `Slippage: ${slippage?.toFixed(4) || '-'} (${(slipRatio * 100).toFixed(4)}%)\n` +
        `Size: ${size}\n` +
        `Cost: $${cost.toFixed(4)}` +
        (latency ? `\nLatency: ${latency}ms` : '')
    });
  }
});
