// ===== Selectors =====
const BUTTON_SELECTOR = '[data-testid="place-order-button"]';

// ===== State =====
let lastOrderButtonTimestamp = null;

// ===== Helpers =====
function safeSendMessage(message) {
  try {
    if (chrome?.runtime?.id) chrome.runtime.sendMessage(message);
  } catch (e) {}
}

// ===== Track Button Clicks =====
const buttonObserver = new MutationObserver(() => {
  const button = document.querySelector(BUTTON_SELECTOR);
  if (!button) return;

  if (!button.dataset.clickTimestamp) {
    lastOrderButtonTimestamp = Date.now();
    button.dataset.clickTimestamp = 'true';

    button.addEventListener(
      'click',
      () => {
        lastOrderButtonTimestamp = Date.now();
      },
      { once: true }
    );
  }
});

buttonObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['disabled']
});

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
        const priceEl = children[filledIndex + 2];
        const price = priceEl ? priceEl.innerText.trim() : null;

        // Extraemos symbol y positionType de la notificación principal
        const notif = node.closest('[data-testid^="notification-market-"]');
        const symbolEl = notif?.querySelector('span.text-gray-0');
        const typeEl = notif?.querySelector('div.inline-flex span');

        const symbol = symbolEl ? symbolEl.innerText.trim() : 'UNKNOWN';
        const positionType = typeEl ? typeEl.innerText.trim() : 'UNKNOWN';

        const filledTimestamp = Date.now();
        const elapsedMs = lastOrderButtonTimestamp ? filledTimestamp - lastOrderButtonTimestamp : null;

        safeSendMessage({
          type: 'MARKET_NOTIFICATION_FILLED',
          payload: {
            symbol,
            positionType,
            status: 'Filled',
            price,
            timestamp: filledTimestamp,
            elapsedMs
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

