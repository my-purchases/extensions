# Chrome Web Store Listing

## Name
My Purchases Collector

## Short Description (132 chars max)
Collect & export AliExpress, Temu, Allegro & Amazon orders to CSV/JSON/HTML. 15 languages, auto detection. Privacy-first — all local.

## Detailed Description

My Purchases Collector automatically captures your order data from AliExpress, Temu, Allegro, and Amazon as you browse — no manual copy-pasting, no scraping.

SUPPORTED PLATFORMS
• AliExpress
• Temu
• Allegro (allegro.pl and allegro.cz)
• Amazon (21 marketplaces: amazon.com, amazon.de, amazon.co.uk, amazon.pl, amazon.fr, amazon.it, amazon.es, amazon.nl, amazon.se, amazon.ca, amazon.com.mx, amazon.com.br, amazon.co.jp, amazon.in, amazon.com.au, amazon.sg, amazon.ae, amazon.sa, amazon.eg, amazon.com.be, amazon.com.tr)

HOW IT WORKS
1. Install the extension and go to your order history on AliExpress, Temu, Allegro, or Amazon
2. Orders are captured automatically — from API responses (AliExpress, Temu, Allegro) or by parsing the page (Amazon)
3. Click "Collect All" to load your entire order history with one click
4. Export to CSV, JSON, HTML, or copy to clipboard for Google Sheets

FEATURES
• Automatic data capture — order data collected in real-time as pages load
• Supports AliExpress, Temu, Allegro, and Amazon — filter by platform in the popup
• Amazon: supports all 21 marketplaces, auto-collects across all years with pagination
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
• Host access (aliexpress.com, temu.com, allegro.pl, allegro.cz, amazon.com + 20 regional domains): Allows content scripts to run on supported e-commerce pages. For AliExpress, Temu, and Allegro this enables API response interception. For Amazon this enables order page parsing across all 21 marketplace domains.

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
3. "Collect All" in progress on AliExpress, Temu, Allegro, or Amazon order page
4. Filter bar showing status and platform filters
5. Empty state / first install view
6. Language selector dropdown showing available languages
