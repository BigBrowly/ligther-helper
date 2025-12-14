// Runs inside app.lighter.xyz
// Safely detects enable and click events for the Place Market Order button

const TARGET_BUTTON_SELECTOR = '[data-testid="place-order-button"]';
let observer = null;

// Safe wrapper to avoid "Extension context invalidated" crashes
function safeSendMessage(message) {
  try {
    if (chrome?.runtime?.id) {
      chrome.runtime.sendMessage(message);
    }
  } catch (error) {
    // Silently ignore invalidated context errors
  }
}

// Find the order button
function getOrderButton() {
  return document.querySelector(TARGET_BUTTON_SELECTOR);
}

// Observe DOM mutations (SPA-safe)
observer = new MutationObserver(() => {
  const button = getOrderButton();
  if (!button) return;

  // Detect enabled state
  if (!button.disabled && !button.dataset.enabledNotified) {
    button.dataset.enabledNotified = 'true';

    safeSendMessage({
      type: 'ORDER_BUTTON_ENABLED',
      payload: {
        text: button.innerText.trim(),
        url: location.href
      }
    });
  }

  // Attach click listener once
  if (!button.dataset.clickListenerAttached) {
    button.dataset.clickListenerAttached = 'true';

    button.addEventListener('click', () => {
      safeSendMessage({
        type: 'ORDER_BUTTON_CLICKED',
        payload: {
          text: button.innerText.trim(),
          url: location.href
        }
      });
    });
  }
});

// Start observing
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['disabled']
});

// Cleanup when the page is unloaded or replaced
window.addEventListener('beforeunload', () => {
  if (observer) observer.disconnect();
});

