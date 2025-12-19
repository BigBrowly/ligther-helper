// ===== Listen for trade messages from injected.js =====
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'LIGHTER_HELPER_TRADE') return;

  chrome.runtime.sendMessage({
    type: 'MARKET_NOTIFICATION_FILLED',
    payload: event.data.payload
  });
});

// ===== Volume Filter =====
const MIN_VOLUME_KEY = 'minVolume';
const VOLUME_FILTER_ENABLED_KEY = 'volumeFilterEnabled';
let currentMinVolume = 50000000; // 50M default
let volumeFilterEnabled = false;

function parseVolume(text) {
  if (!text) return 0;
  const clean = text.replace(/[$,]/g, '').trim().toUpperCase();
  const match = clean.match(/^([\d.]+)([KMB])?$/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'K': return num * 1000;
    case 'M': return num * 1000000;
    case 'B': return num * 1000000000;
    default: return num;
  }
}

function applyVolumeFilter() {
  const rows = document.querySelectorAll('tr[data-testid^="row-"]');
  rows.forEach(row => {
    const volumeCell = row.querySelector('td[data-testid$="_dailyQuoteVolume"] p');
    if (!volumeCell) return;

    if (!volumeFilterEnabled) {
      row.style.display = '';
      return;
    }

    const volume = parseVolume(volumeCell.textContent);
    row.style.display = volume >= currentMinVolume ? '' : 'none';
  });
}

// Load saved settings
chrome.storage.local.get([MIN_VOLUME_KEY, VOLUME_FILTER_ENABLED_KEY], (result) => {
  const saved = result[MIN_VOLUME_KEY] || '50M';
  currentMinVolume = parseVolume(saved);
  volumeFilterEnabled = result[VOLUME_FILTER_ENABLED_KEY] ?? false;
  applyVolumeFilter();
});

// Listen for changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes[MIN_VOLUME_KEY]) {
    currentMinVolume = parseVolume(changes[MIN_VOLUME_KEY].newValue || '50M');
  }
  if (changes[VOLUME_FILTER_ENABLED_KEY]) {
    volumeFilterEnabled = changes[VOLUME_FILTER_ENABLED_KEY].newValue ?? false;
  }
  applyVolumeFilter();
});

// Observe for new rows
const volumeFilterObserver = new MutationObserver(() => {
  applyVolumeFilter();
});

volumeFilterObserver.observe(document.documentElement, { childList: true, subtree: true });

// Cleanup
window.addEventListener('beforeunload', () => {
  volumeFilterObserver.disconnect();
});
