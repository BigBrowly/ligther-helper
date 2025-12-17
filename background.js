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
    console.log(message.payload);
    const { symbol, side, bestprice, price, size, latency } = message.payload;

    const spread = (bestprice['bestAsk'] - bestprice['bestBid']) / bestprice['bestAsk'];
    const spread_text = bestprice['bestBid'] + '/' + bestprice['bestAsk'];

    let bestPrice;
    let slippage;
    let slipRatio;

    if(side == 'LONG') {
      bestPrice = bestprice['bestAsk']; 
      slippage = price - bestPrice;
      slipRatio = (price - bestPrice) / bestPrice
    }
    else
    {
      bestPrice = bestprice['bestBid']; 
      slippage = bestPrice - price;
      slipRatio = (bestPrice - price) / bestPrice
    }

    const cost = size * price * (spread + slipRatio)

    chrome.storage.local.get(ORDERS_KEY, ({ orders = [] }) => {
      orders.push({id:crypto.randomUUID(), timestamp: Date.now(), symbol, side, price, size, bestPrice, spread, slipRatio, cost, latency});
      chrome.storage.local.set({ [ORDERS_KEY]: orders });
    });

      
    chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title: 'Market Order Filled',
      message:
        `${symbol} - ${side}\n` +
        `Bid/Ask: ${spread_text}\n` +
        `Price: ${price ?? '-'}\n` +
        `Spread: ${(spread * 100).toFixed(4)}%\n` +
        `Slippage: ${slippage.toLocaleString()} Ratio: ${(slipRatio * 100).toFixed(4)}%\n` +
        `Size: ${size}\n` +
        `Cost: ${cost.toFixed(4)}$\n` +
        `Latency: ${latency}`
    });
  }
});

