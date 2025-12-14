// Background service worker
// Safely creates notifications only when required fields exist

chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) {
    return;
  }

  let title = '';
  let notificationMessage = '';

  if (message.type === 'ORDER_BUTTON_ENABLED') {
    title = 'Order Button Enabled';
    notificationMessage = 'Place Market Order button is now enabled';
  }

  if (message.type === 'ORDER_BUTTON_CLICKED') {
    title = 'Order Button Clicked';
    notificationMessage = 'Place Market Order button was clicked';
  }

  // Do NOT create a notification if required fields are missing
  if (!title || !notificationMessage) {
    return;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'https://app.lighter.xyz/assets/fartcoin-CAgd0qdd.png',
    title: title,
    message: notificationMessage
  });
});

