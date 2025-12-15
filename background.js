chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return;

  const iconUrl = 'https://app.lighter.xyz/assets/fartcoin-CAgd0qdd.png';

  // === Button enabled notification ===
  if (message.type === 'ORDER_BUTTON_ENABLED') {
    const { bestBid, bestAsk, text, timestamp } = message.payload;

    chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title: 'Order Button Enabled',
      message:
        `${text}\n` +
        `Best Bid: ${bestBid || '-'}\n` +
        `Best Ask: ${bestAsk || '-'}\n` +
        `Time: ${new Date(timestamp).toLocaleTimeString()}`
    });
  }

  // === Market order filled notification ===
  if (message.type === 'MARKET_NOTIFICATION_FILLED') {
    const { symbol, positionType, status, price, elapsedMs } = message.payload;

    const latencyText = elapsedMs !== null ? `${elapsedMs} ms` : 'N/A';

    chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title: 'Market Order Filled',
      message:
        `${symbol} - ${positionType}\n` +
        `Status: ${status}\n` +
        `Price: ${price ?? '-'}\n` +
        `Latency: ${latencyText}`
    });
  }
});

