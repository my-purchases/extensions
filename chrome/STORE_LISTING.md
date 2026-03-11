# Chrome Web Store Listing

## Name
My Purchases Collector

## Short Description (132 chars max)
Collect & export AliExpress, Temu & Allegro orders to CSV/JSON/HTML. 15 languages, auto browser detection. Privacy-first — all local.

## Detailed Description

My Purchases Collector automatically captures your order data from AliExpress, Temu, and Allegro as you browse — no manual copy-pasting, no scraping.

SUPPORTED PLATFORMS
• AliExpress
• Temu
• Allegro (allegro.pl and allegro.cz)

HOW IT WORKS
1. Install the extension and go to your order history on AliExpress, Temu, or Allegro
2. Orders are captured automatically from API responses
3. Click "Collect All" to load your entire order history with one click
4. Export to CSV, JSON, HTML, or copy to clipboard for Google Sheets

FEATURES
• Automatic API interception — order data captured in real-time as pages load
• Supports AliExpress, Temu, and Allegro — filter by platform in the popup
• One-click "Collect All" button to load all orders automatically
• Export to CSV, JSON, HTML, or clipboard
• Compatible with the My Resources web app (https://my-purchases.mobulum.com/)
• Filter orders by status (e.g. "Awaiting delivery")
• Clean popup UI with order cards showing images, prices, and status

15 LANGUAGES
The interface automatically adapts to your browser language. You can also switch manually using the globe icon in the header. Supported languages:
• English
• 中文 (Chinese)
• Español (Spanish)
• हिन्दी (Hindi)
• العربية (Arabic)
• Português (Portuguese)
• Français (French)
• Русский (Russian)
• 日本語 (Japanese)
• Deutsch (German)
• 한국어 (Korean)
• Bahasa Indonesia (Indonesian)
• Türkçe (Turkish)
• Italiano (Italian)
• Polski (Polish)

PRIVACY
• All data stored locally in your browser — nothing leaves your device
• No analytics, no tracking, no telemetry
• No accounts required
• Open source under MIT license

PERMISSIONS EXPLAINED
• Storage: Saves collected orders and collection status locally in your browser using chrome.storage.local. This is the extension's primary data store — orders persist between browser sessions without any external server.
• Unlimited Storage: Removes the default 10 MB quota on local storage. The "Collect All" feature can capture your entire order history, which for power users with thousands of orders may exceed the standard limit.
• Tabs: Required for the auto-collect feature — the extension needs to find your open order page (chrome.tabs.query) and send start/stop commands to the content script (chrome.tabs.sendMessage). Also used to open the orders page from the popup.
• Host access (aliexpress.com, temu.com, allegro.pl, allegro.cz): Allows content scripts to run on supported e-commerce pages and intercept API responses containing order data.

SOURCE CODE
https://github.com/my-purchases/extensions/tree/master/chrome

## Category
Shopping

## Language
All (auto-detected from browser settings)

## Supported Languages
English, Chinese (Simplified), Spanish, Hindi, Arabic, Portuguese, French, Russian, Japanese, German, Korean, Indonesian, Turkish, Italian, Polish

## Privacy Policy URL
https://my-purchases.mobulum.com/privacy

## Website URL
https://my-purchases.mobulum.com/extension

## Screenshots Guide
Take screenshots at 1280x800 or 640x400:
1. Popup showing collected orders with images and status badges
2. Export panel with CSV/JSON/HTML/Clipboard options
3. "Collect All" in progress on AliExpress, Temu, or Allegro order page
4. Filter bar showing status and platform filters
5. Empty state / first install view
6. Language selector dropdown showing available languages
