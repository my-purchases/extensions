# Chrome Web Store Listing

## Name
My Purchases Collector

## Short Description (132 chars max)
Automatically collect and export your AliExpress & Temu orders to CSV, JSON, HTML, or clipboard. Privacy-first — data stays local.

## Detailed Description

My Purchases Collector automatically captures your order data from AliExpress and Temu as you browse — no manual copy-pasting, no scraping.

SUPPORTED PLATFORMS
• AliExpress
• Temu

HOW IT WORKS
1. Install the extension and go to your order history on AliExpress or Temu
2. Orders are captured automatically from API responses
3. Click "Collect All" to load your entire order history with one click
4. Export to CSV, JSON, HTML, or copy to clipboard for Google Sheets

FEATURES
• Automatic API interception — order data captured in real-time as pages load
• Supports AliExpress and Temu — filter by platform in the popup
• One-click "Collect All" button to load all orders automatically
• Export to CSV, JSON, HTML, or clipboard
• Compatible with the My Resources web app (https://my-purchases.mobulum.com/)
• Filter orders by status (e.g. "Awaiting delivery")
• Clean popup UI with order cards showing images, prices, and status

PRIVACY
• All data stored locally in your browser — nothing leaves your device
• No analytics, no tracking, no telemetry
• No accounts required
• Open source under MIT license

PERMISSIONS EXPLAINED
• Storage: Saves collected orders and collection status locally in your browser using chrome.storage.local. This is the extension's primary data store — orders persist between browser sessions without any external server.
• Unlimited Storage: Removes the default 10 MB quota on local storage. The "Collect All" feature can capture your entire AliExpress order history, which for power users with thousands of orders may exceed the standard limit.
• Tabs: Required for the auto-collect feature — the extension needs to find your open order page (chrome.tabs.query) and send start/stop commands to the content script (chrome.tabs.sendMessage). Also used to open the orders page from the popup.
• Host access (aliexpress.com, temu.com): Allows content scripts to run on supported e-commerce pages and intercept API responses containing order data.

SOURCE CODE
https://github.com/my-purchases/extensions/tree/master/chrome

## Category
Shopping

## Language
English

## Privacy Policy URL
https://my-purchases.mobulum.com/privacy

## Website URL
https://my-purchases.mobulum.com/extension

## Screenshots Guide
Take screenshots at 1280x800 or 640x400:
1. Popup showing collected orders with images and status badges
2. Export panel with CSV/JSON/HTML/Clipboard options
3. "Collect All" in progress on AliExpress or Temu order page
4. Filter bar showing status and platform filters
5. Empty state / first install view
