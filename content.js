// ===== Inject nonce prefetch script =====
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
document.documentElement.appendChild(script);

// ===== Selectors =====
const BUTTON_SELECTORS = [
  '[data-testid="place-order-button"]',
  '[data-testid="order-panel-close-position-button"]'
];

const BEST_BID_SELECTOR = 'div[data-testid="ob-bid"] span[data-testid="price"]';
const BEST_ASK_SELECTOR = 'div[data-testid="ob-ask"] span[data-testid="price"]';

// ===== State =====
let lastOrderButtonTimestamp = null;
let lastOrderBestPrice = null;

// ===== Helpers =====
function getBestPrices() {
  const bestBidEl = document.querySelector(BEST_BID_SELECTOR);
  const bestAskEl = document.querySelector(BEST_ASK_SELECTOR);

  return {
    bestBid: bestBidEl ? bestBidEl.innerText.trim().replace(/,/g, '') : null,
    bestAsk: bestAskEl ? bestAskEl.innerText.trim().replace(/,/g, '') : null
  };
}

// Add click listener to button if not already added
function addClickListener(button, callback) {
  if (!button || button.dataset.listenerAdded) return;
  button.dataset.listenerAdded = 'true';
  button.addEventListener('click', callback);
}

// Valid button texts for market orders
const MARKET_ORDER_TEXTS = ['Place Market Order', 'Close Position'];

// Button click handler - only acts for market orders
function handleButtonClick(event) {
  const buttonText = event.currentTarget.innerText?.trim();

  // Only process if it's a market order
  if (!MARKET_ORDER_TEXTS.some(text => buttonText?.includes(text))) {
    return;
  }

  const prices = getBestPrices();
  lastOrderButtonTimestamp = Date.now();
  lastOrderBestPrice = prices;
}

// Observer to capture dynamically added buttons
const buttonObserver = new MutationObserver(() => {
  BUTTON_SELECTORS.forEach(selector => {
    const button = document.querySelector(selector);
    addClickListener(button, handleButtonClick);
  });
});

// Start observer
buttonObserver.observe(document.documentElement, { childList: true, subtree: true });

// ===== Observe DOM for Filled =====
const filledObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      // Look for nodes containing "Filled"
      if (node.innerText?.includes('Filled') && !node.dataset.filledDetected) {
        node.dataset.filledDetected = 'true';

        // Only process if there's a pending market order click
        if (!lastOrderButtonTimestamp || !lastOrderBestPrice) {
          return;
        }

        const children = Array.from(node.parentElement.children);
        const filledIndex = children.findIndex(el => el === node);

        // Extract price 2 siblings after (status -> size -> price)
        const sizeEl = node.parentElement.nextElementSibling.querySelectorAll('span')[1];
        const size = sizeEl ? sizeEl.innerText.trim().replace(/,/g, '') : null;

        const priceEl = node.parentElement.nextElementSibling.nextElementSibling.querySelectorAll('span')[1];
        const price = priceEl ? priceEl.innerText.trim().replace(/,/g, '') : null;

        // Extract symbol and position type from main notification
        const notif = node.parentElement.parentElement.previousElementSibling;
        const symbolEl = notif?.querySelector('span.text-gray-0');
        const typeEl = notif?.querySelector('div.inline-flex span');

        const symbol = symbolEl ? symbolEl.innerText.trim() : 'UNKNOWN';
        const side = typeEl ? typeEl.innerText.trim() : 'UNKNOWN';

        const latency = Date.now() - lastOrderButtonTimestamp;

        chrome.runtime.sendMessage({
          type: 'MARKET_NOTIFICATION_FILLED',
          payload: {
            symbol,
            side,
            status: 'Filled',
            bestprice: lastOrderBestPrice,
            price,
            size,
            latency
          }
        });

        // Clear state after processing
        lastOrderButtonTimestamp = null;
        lastOrderBestPrice = null;
      }
    });
  });
});

filledObserver.observe(document.documentElement, { childList: true, subtree: true });

// ===== Cleanup =====
window.addEventListener('beforeunload', () => {
  buttonObserver.disconnect();
  filledObserver.disconnect();
});
