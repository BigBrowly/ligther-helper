chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return;

  const iconUrl = 'https://app.lighter.xyz/assets/fartcoin-CAgd0qdd.png';

  // === Market order filled notification ===
  if (message.type === 'MARKET_NOTIFICATION_FILLED') {
    console.log(message.payload);
    const { symbol, positionType, bestprice, price, size, elapsedMs } = message.payload;

    const latencyText = elapsedMs !== null ? `${elapsedMs} ms` : 'N/A';

    const spread = (bestprice['bestAsk'] - bestprice['bestBid']) / bestprice['bestAsk'];
    const spread_text = bestprice['bestBid'] + '/' + bestprice['bestAsk'];

    let original_price;
    let slippage;
    let slip_ratio;

    if(positionType == 'LONG') {
      original_price = bestprice['bestAsk']; 
      slippage = price - original_price;
      slip_ratio = (price - original_price) / original_price
    }
    else
    {
      original_price = bestprice['bestBid']; 
      slippage = original_price - price;
      slip_ratio = (original_price - price) / original_price
    }

    const cost = size * price * (spread + slippage)
      
    chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title: 'Market Order Filled',
      message:
        `${symbol} - ${positionType}\n` +
        `Bid/Ask: ${spread_text}\n` +
        `Price: ${price ?? '-'}\n` +
        `Spread: ${(spread * 100).toFixed(4)}%\n` +
        `Slippage: ${slippage.toLocaleString()} Ratio: ${(slip_ratio * 100).toFixed(4)}%\n` +
        `Size: ${size}\n` +
        `Cost: ${cost.toFixed(4)}$\n` +
        `Latency: ${latencyText}`
    });
  }
});

