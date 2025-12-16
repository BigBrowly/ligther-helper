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

function safeSendMessage(message) {
  try {
    if (chrome?.runtime?.id) chrome.runtime.sendMessage(message);
  } catch (e) {}
}

// Función para añadir listener a un botón si no lo tiene
function addClickListener(button, callback) {
  if (!button || button.dataset.listenerAdded) return;
  button.dataset.listenerAdded = 'true';
  button.addEventListener('click', callback);
}

// Callback común (puedes diferenciar según el botón)
function handleButtonClick(event) {
  const prices = getBestPrices();
  lastOrderButtonTimestamp = Date.now();
  lastOrderBestPrice = prices;
}

// Observador para capturar botones que aparecen dinámicamente
const buttonObserver = new MutationObserver(() => {
  BUTTON_SELECTORS.forEach(selector => {
    const button = document.querySelector(selector);
    addClickListener(button, handleButtonClick);
  });
});

// Iniciar observador
buttonObserver.observe(document.documentElement, { childList: true, subtree: true });

// ===== Observe DOM for Filled =====
const filledObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      // Buscamos nodos que contengan "Filled"
      if (node.innerText?.includes('Filled') && !node.dataset.filledDetected) {
        node.dataset.filledDetected = 'true';

        const children = Array.from(node.parentElement.children);
        const filledIndex = children.findIndex(el => el === node);

        // Extraemos price 2 hermanos después (status -> size -> price)
        const sizeEl = node.parentElement.nextElementSibling.querySelectorAll('span')[1];
        const size = sizeEl ? sizeEl.innerText.trim().replace(/,/g, '') : null;

        const priceEl = node.parentElement.nextElementSibling.nextElementSibling.querySelectorAll('span')[1];
        const price = priceEl ? priceEl.innerText.trim().replace(/,/g, '') : null;

        // Extraemos symbol y positionType de la notificación principal
        const notif = node.parentElement.parentElement.previousElementSibling;
        const symbolEl = notif?.querySelector('span.text-gray-0');
        const typeEl = notif?.querySelector('div.inline-flex span');

        const symbol = symbolEl ? symbolEl.innerText.trim() : 'UNKNOWN';
        const side = typeEl ? typeEl.innerText.trim() : 'UNKNOWN';

        const latency = lastOrderButtonTimestamp ? Date.now() - lastOrderButtonTimestamp : null;

        safeSendMessage({
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
