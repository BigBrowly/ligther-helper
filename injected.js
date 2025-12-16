// Nonce cache
let cachedNonce = null;
let cachedAccountIndex = null;

const originalFetch = window.fetch;

window.fetch = async function(...args) {
  const [url, options] = args;
  const urlStr = typeof url === 'string' ? url : url.toString();

  // Intercept nextNonce requests
  if (urlStr.includes('/api/v1/nextNonce')) {
    const urlObj = new URL(urlStr);
    const accountIndex = urlObj.searchParams.get('account_index');

    // If we have a cached nonce for this account, return it immediately
    if (cachedNonce !== null && cachedAccountIndex === accountIndex) {
      const nonceToReturn = cachedNonce;
      cachedNonce++; // Increment for next time

      console.log('[Lighter Cost] Returning cached nonce:', nonceToReturn, '(next:', cachedNonce + ')');

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
      cachedNonce = data.nonce + 1; // Cache the NEXT nonce
      cachedAccountIndex = accountIndex;
      console.log('[Lighter Cost] First request, returning:', data.nonce, '(cached next:', cachedNonce + ')');
    } catch (e) {}

    return response;
  }

  // Intercept sendTx responses to detect nonce errors
  if (urlStr.includes('/api/v1/sendTx')) {
    const response = await originalFetch.apply(this, args);
    const cloned = response.clone();

    try {
      const data = await cloned.json();
      // code 21104 = invalid nonce
      if (data.code === 21104) {
        console.log('[Lighter Cost] Invalid nonce detected, resetting cache');
        cachedNonce = null;
        cachedAccountIndex = null;
      }
    } catch (e) {}

    return response;
  }

  // All other requests pass through normally
  return originalFetch.apply(this, args);
};

console.log('[Lighter Cost] Nonce prefetch injected');
