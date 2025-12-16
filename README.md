# Lighter Cost Tracker

Chrome extension to monitor and analyze market order execution costs on [app.lighter.xyz](https://app.lighter.xyz).

## Privacy

This extension does not require any special permissions or wallet access. It simply reads data from the DOM to track your orders locally.

## What it does

- Detects when you execute market orders (Place Order / Close Position)
- Captures the best bid/ask from the order book at the moment of the click
- **Nonce prefetching**: Caches the nonce locally to skip the network request on subsequent orders, reducing latency
- Automatically calculates:
  - **Spread**: difference between bid and ask
  - **Slippage**: difference between expected price and execution price
  - **Cost**: total cost of the operation (spread + slippage)
  - **Latency**: time between click and confirmation
- Shows notifications with order details
- Saves a history with aggregated statistics

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right corner)
4. Click **Load unpacked**
5. Select the project folder

## Usage

1. Go to [app.lighter.xyz](https://app.lighter.xyz)
2. Trade normally
3. Every time an order is executed, you'll see a notification with the details
4. Click on the extension icon to view history and statistics

## Files

- `manifest.json` - Extension configuration
- `content.js` - Script that detects clicks and orders on the page
- `injected.js` - Script that intercepts nonce requests for prefetching
- `background.js` - Service worker that processes data and shows notifications
- `popup.html` / `popup.js` - Popup interface with history and statistics
