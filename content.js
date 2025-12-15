// ===== Selectors =====
const BUTTON_SELECTORS = [
  '[data-testid="place-order-button"]',
  '[data-testid="order-panel-close-position-button"]'
];

// ===== State =====
let lastOrderButtonTimestamp = null;

// ===== Helpers =====
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
  const buttonId = event.currentTarget.dataset.testid;
  console.log(`Click en botón: ${buttonId}`);
  lastOrderButtonTimestamp = Date.now();
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
        const priceEl = node.parentElement.nextElementSibling.nextElementSibling.querySelectorAll('span')[1];
        const price = priceEl ? priceEl.innerText.trim() : null;

        // Extraemos symbol y positionType de la notificación principal
        const notif = node.parentElement.parentElement.previousElementSibling;
        console.log(notif)
        const symbolEl = notif?.querySelector('span.text-gray-0');
        console.log(symbolEl)
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
