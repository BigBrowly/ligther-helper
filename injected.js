// Nonce cache
let cachedNonce = null;
let cachedAccountIndex = null;

const ACCOUNT_INDEX_KEY = 'lighter_helper_account_index';

const originalFetch = window.fetch;

// Prefetch nonce on load if we have a saved account_index
async function prefetchNonce() {
  const savedAccountIndex = localStorage.getItem(ACCOUNT_INDEX_KEY);
  if (!savedAccountIndex) {
    console.log('[Lighter Helper] No saved account_index, skipping prefetch');
    return;
  }

  try {
    console.log('[Lighter Helper] Prefetching nonce for account:', savedAccountIndex);
    const response = await originalFetch(`https://mainnet.zklighter.elliot.ai/api/v1/nextNonce?account_index=${savedAccountIndex}&api_key_index=0`);
    const data = await response.json();
    console.log('[Lighter Helper] Prefetch response:', data);

    if (data.code === 200 && data.nonce != null) {
      cachedNonce = data.nonce;
      cachedAccountIndex = savedAccountIndex;
      console.log('[Lighter Helper] Prefetched nonce:', cachedNonce);
    }
  } catch (e) {
    console.log('[Lighter Helper] Prefetch failed:', e);
  }
}

prefetchNonce();

window.fetch = async function(...args) {
  const [url, options] = args;
  const urlStr = typeof url === 'string' ? url : url.toString();

  // Intercept nextNonce requests
  if (urlStr.includes('/api/v1/nextNonce')) {
    const urlObj = new URL(urlStr);
    const accountIndex = urlObj.searchParams.get('account_index');

    // Save account_index for future prefetch
    if (accountIndex) {
      localStorage.setItem(ACCOUNT_INDEX_KEY, accountIndex);
    }

    // If we have a cached nonce for this account, return it immediately
    if (cachedNonce !== null && cachedAccountIndex === accountIndex) {
      const nonceToReturn = cachedNonce;
      cachedNonce++;

      console.log('[Lighter Helper] Returning cached nonce:', nonceToReturn, '(next:', cachedNonce, ')');

      return new Response(JSON.stringify({ code: 200, nonce: nonceToReturn }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // No cache, make the real request and cache the result
    const response = await originalFetch.apply(this, args);
    const cloned = response.clone();

    try {
      const data = await cloned.json();
      // La app va a usar este nonce, así que cacheamos el siguiente
      cachedNonce = data.nonce + 1;
      cachedAccountIndex = accountIndex;
      console.log('[Lighter Helper] Real request, app uses:', data.nonce, '(cached next:', cachedNonce, ')');
    } catch (e) {}

    return response;
  }

  // Intercept sendTx responses to detect nonce errors
  if (urlStr.includes('/api/v1/sendTx')) {
    const response = await originalFetch.apply(this, args);
    const cloned = response.clone();

    try {
      const data = await cloned.json();
      if (data.code === 21104) {
        console.log('[Lighter Helper] Invalid nonce detected, resetting cache');
        cachedNonce = null;
        cachedAccountIndex = null;
      }
    } catch (e) {}

    return response;
  }

  // All other requests pass through normally
  return originalFetch.apply(this, args);
};
