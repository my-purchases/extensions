# My Purchases Collector — Chrome Extension

A Chrome extension that automatically collects your AliExpress order data by intercepting API responses, and exports them to CSV, JSON, HTML, or clipboard. Fully compatible with the [My Resources](https://my-purchases.mobulum.com/) web app import format.

## Features

- **Automatic API interception** — captures order data from AliExpress API responses as you browse (no scraping, no manual work)
- **One-click "Collect All"** — automatically clicks "View orders" to load your entire order history
- **Export formats** — CSV, JSON, HTML, or copy to clipboard (Google Sheets compatible)
- **Web app compatible** — exported data matches the `AliexpressShopperInventoryItem` type used by the web app importer
- **Privacy-first** — all data stored locally in your browser, zero tracking or analytics
- **Filter & search** — filter orders by status (e.g. "Awaiting delivery") in the popup

## How It Works

1. Install the extension and navigate to your [AliExpress order history](https://www.aliexpress.com/p/order/index.html)
2. The extension intercepts AliExpress API responses (`batman.js` / BizPlugin format) and extracts order data
3. Click the extension icon to see collected orders, or use "Collect All" to load all pages automatically
4. Export your data in your preferred format

### Architecture

```
src/
├── background/         # Service worker — message routing
│   └── service-worker.ts
├── content/
│   ├── main-world.ts   # MAIN world — intercepts fetch/XHR/JSONP
│   └── isolated-world.ts  # ISOLATED world — bridge + auto-collect UI clicks
├── providers/
│   └── aliexpress/
│       ├── parser.ts       # BizPlugin response parser
│       ├── interceptor.ts  # URL matching + detection
│       └── index.ts
├── shared/
│   ├── constants.ts    # API patterns, storage keys
│   └── messages.ts     # Message type definitions
├── types/
│   └── order.ts        # OrderItem interface
├── storage/
│   └── orders.ts       # CRUD for chrome.storage.local
├── export/
│   ├── csv.ts
│   ├── json.ts
│   ├── html.ts
│   ├── clipboard.ts
│   └── index.ts
└── popup/
    ├── App.tsx          # Main popup UI
    ├── main.tsx
    ├── index.html
    ├── index.css
    └── components/
        ├── OrderList.tsx
        ├── OrderCard.tsx
        ├── ExportPanel.tsx
        ├── FilterBar.tsx
        └── StatusBadge.tsx
```

## Development

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
cd chrome
npm install
```

### Dev mode

```bash
npm run dev
```

Then load the extension in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory

### Build

```bash
npm run build
```

### Tests

```bash
npm test
```

## Permissions

| Permission | Reason |
|-----------|--------|
| `storage` | Store collected order data locally |
| `unlimitedStorage` | Support large order histories |
| `tabs` | Communicate between popup and content scripts |
| `*://*.aliexpress.com/*` | Intercept order API responses on AliExpress |

## Tech Stack

- TypeScript 5.8
- React 19
- Vite 6 + CRXJS plugin
- Tailwind CSS 4
- Chrome Manifest V3

## Privacy

All data is stored locally in your browser using `chrome.storage.local`. No data is transmitted to any server. No analytics or tracking of any kind. See the full [privacy policy](https://my-purchases.mobulum.com/privacy).

## License

MIT — Copyright (c) 2026 mobulum.com. See [LICENSE](LICENSE).
