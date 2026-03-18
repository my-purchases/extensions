#!/usr/bin/env node

/**
 * Chrome Web Store Screenshot Generator
 *
 * Takes 1280x800 screenshots of the extension popup centered on a dark gradient background.
 * Uses a temporary Chrome profile with mock order data injected via chrome.storage.local.
 * All screenshots are in English (en).
 *
 * No need to close Chrome - this uses a temporary profile.
 *
 * Usage:
 *   npm run screenshots
 *   node screenshots/take-screenshots.mjs
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIST = path.resolve(__dirname, '..', 'dist');
const SCREENSHOTS_DIR = path.resolve(__dirname);

const WIDTH = 1280;
const HEIGHT = 800;

// ─── Mock Order Data ─────────────────────────────────────────

/**
 * Mock order data based on production-like fixtures from
 * web/src/providers/{aliexpress,temu,amazon,allegro}/__fixtures__/
 *
 * Each order follows the OrderItem interface from shared/src/types/order.ts.
 */
function createMockOrders() {
  return [
    // ── AliExpress (from aliexpress/__fixtures__/sample-orders.json) ──
    {
      id: '3069099405669913-1005008226693966-12000044304276428',
      orderId: '3069099405659913',
      orderLineId: '3069099405669913',
      productId: '1005008226693966',
      skuId: '12000044304276428',
      title: 'SucceBuy Ultrasonic Cleaner 6L',
      price: 'US $120.95',
      priceInfo: 'US $120.95|120|95',
      currency: 'USD',
      quantity: 1,
      orderDate: 'Feb 21, 2026',
      orderDateIso: '2026-02-20',
      status: 'Completed',
      storeName: 'SucceBuy Appliance Overseas Global Store',
      storePageUrl: 'https://www.aliexpress.com/store/1103582642',
      productUrl: 'https://www.aliexpress.com/item/1005008226693966.html',
      imageUrl: 'https://ae01.alicdn.com/kf/Sf1c71403d13f4438a6dffaac1c1b2021r.jpg_220x220.jpg',
      attributes: 'Color: 6L, Ships From: GERMANY',
      timestamp: 1772199808254,
      ignoreExport: false,
      tags: [],
      providerId: 'aliexpress',
    },
    {
      id: '3065094845469913-1005008097084586-12000043716686349',
      orderId: '3065094845459913',
      orderLineId: '3065094845469913',
      productId: '1005008097084586',
      skuId: '12000043716686349',
      title: 'Your Taste Set-5x Salted Pistachios 500g',
      price: '129,46zł',
      priceInfo: '129,46zł|129|46',
      currency: 'PLN',
      quantity: 1,
      orderDate: 'Nov 30, 2025',
      orderDateIso: '2025-11-29',
      status: 'Completed',
      storeName: 'Your Taste Store',
      storePageUrl: 'https://www.aliexpress.com/store/1104298480',
      productUrl: 'https://www.aliexpress.com/item/1005008097084586.html',
      imageUrl: 'https://ae01.alicdn.com/kf/Se492885ba1e04750850f84508375321e7.png_220x220.png',
      attributes: 'Ships From: Poland',
      timestamp: 1772199813335,
      ignoreExport: false,
      tags: [],
      providerId: 'aliexpress',
    },
    {
      id: '3064617543739913-1005009819050713-12000050269793404',
      orderId: '3064617543729913',
      orderLineId: '3064617543739913',
      productId: '1005009819050713',
      skuId: '12000050269793404',
      title: 'Filament Storage Dryer Box 3D Printer',
      price: 'US $2.04',
      priceInfo: 'US $2.04|2|04',
      currency: 'USD',
      quantity: 2,
      orderDate: 'Nov 25, 2025',
      orderDateIso: '2025-11-24',
      status: 'Completed',
      storeName: 'InnoPioneer 3D Parts Store',
      storePageUrl: 'https://www.aliexpress.com/store/1104490681',
      productUrl: 'https://www.aliexpress.com/item/1005009819050713.html',
      imageUrl: 'https://ae01.alicdn.com/kf/Sc7483cb689da43629f5aa6e3bc7ba32dR.jpg_220x220.jpg',
      attributes: 'Color: Black Rectangle, Size: For 3d Printer',
      timestamp: 1772199813335,
      ignoreExport: false,
      tags: [],
      providerId: 'aliexpress',
    },

    // ── Temu (from temu/__fixtures__/sample-orders.csv) ──
    {
      id: 'PO-162-41938739064775856-temu-1',
      orderId: 'PO-162-41938739064775856',
      orderLineId: 'PO-162-41938739064775856',
      productId: 'temu-41938739064775856',
      skuId: 'temu-41938739064775856-sku',
      title: 'USB C Hub 7 in 1 Adapter With 4K HDMI, 100W PD Charging',
      price: '$12.99',
      priceInfo: '$12.99|12|99',
      currency: 'USD',
      quantity: 1,
      orderDate: 'Jun 10, 2024',
      orderDateIso: '2024-06-10',
      status: 'Completed',
      storeName: 'Temu',
      storePageUrl: 'https://www.temu.com',
      productUrl: 'https://www.temu.com/bgt_order_detail.html?parent_order_sn=PO-162-41938739064775856',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2024-06-10').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'temu',
    },
    {
      id: 'PO-162-31827628953664745-temu-2',
      orderId: 'PO-162-31827628953664745',
      orderLineId: 'PO-162-31827628953664745',
      productId: 'temu-31827628953664745',
      skuId: 'temu-31827628953664745-sku',
      title: 'Wireless Bluetooth 5.3 Headphones with Noise Cancelling',
      price: '45,99 zł',
      priceInfo: '45,99 zł|45|99',
      currency: 'PLN',
      quantity: 1,
      orderDate: 'Mar 22, 2024',
      orderDateIso: '2024-03-22',
      status: 'Completed',
      storeName: 'Temu',
      storePageUrl: 'https://www.temu.com',
      productUrl: 'https://www.temu.com/bgt_order_detail.html?parent_order_sn=PO-162-31827628953664745',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2024-03-22').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'temu',
    },
    {
      id: 'PO-162-63150951286997078-temu-3',
      orderId: 'PO-162-63150951286997078',
      orderLineId: 'PO-162-63150951286997078',
      productId: 'temu-63150951286997078',
      skuId: 'temu-63150951286997078-sku',
      title: 'LED Strip Lights 10m RGB Color Changing With Remote Control',
      price: '€9.99',
      priceInfo: '€9.99|9|99',
      currency: 'EUR',
      quantity: 1,
      orderDate: 'Dec 1, 2024',
      orderDateIso: '2024-12-01',
      status: 'Completed',
      storeName: 'Temu',
      storePageUrl: 'https://www.temu.com',
      productUrl: 'https://www.temu.com/bgt_order_detail.html?parent_order_sn=PO-162-63150951286997078',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2024-12-01').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'temu',
    },

    // ── Amazon (from amazon/__fixtures__/amazon-sample.csv) ──
    {
      id: '404-9369579-4557113-B00ARPM4XY-sku',
      orderId: '404-9369579-4557113',
      orderLineId: '404-9369579-4557113',
      productId: 'B00ARPM4XY',
      skuId: 'B00ARPM4XY-sku',
      title: 'Stadler Form O-009E Ventilador, 45 W, 220 V, Negro, Madera, 350',
      price: '€81.33',
      priceInfo: '€81.33|81|33',
      currency: 'EUR',
      quantity: 1,
      orderDate: 'Mar 7, 2020',
      orderDateIso: '2020-03-07',
      status: 'Completed',
      storeName: 'Amazon.es',
      storePageUrl: 'https://www.amazon.es',
      productUrl: 'https://www.amazon.es/dp/B00ARPM4XY',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2020-03-07').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'amazon',
    },
    {
      id: '407-5290159-8741121-B0D41YCLW8-sku',
      orderId: '407-5290159-8741121',
      orderLineId: '407-5290159-8741121',
      productId: 'B0D41YCLW8',
      skuId: 'B0D41YCLW8-sku',
      title: 'WiiM Ultra Streamer Muzyczny Multiroom',
      price: '1 382,11 zł',
      priceInfo: '1 382,11 zł|1382|11',
      currency: 'PLN',
      quantity: 1,
      orderDate: 'Aug 6, 2024',
      orderDateIso: '2024-08-06',
      status: 'Completed',
      storeName: 'Amazon.pl',
      storePageUrl: 'https://www.amazon.pl',
      productUrl: 'https://www.amazon.pl/dp/B0D41YCLW8',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2024-08-06').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'amazon',
    },
    {
      id: '113-4333969-0641019-B001F0MNRM-sku',
      orderId: '113-4333969-0641019',
      orderLineId: '113-4333969-0641019',
      productId: 'B001F0MNRM',
      skuId: 'B001F0MNRM-sku',
      title: 'Kaito KA500 5-way Powered Emergency AM/FM/SW NOAA Weather Alert Radio',
      price: '$49.98',
      priceInfo: '$49.98|49|98',
      currency: 'USD',
      quantity: 1,
      orderDate: 'May 31, 2022',
      orderDateIso: '2022-05-31',
      status: 'Completed',
      storeName: 'Amazon.com',
      storePageUrl: 'https://www.amazon.com',
      productUrl: 'https://www.amazon.com/dp/B001F0MNRM',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2022-05-31').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'amazon',
    },

    // ── Allegro (from allegro/__fixtures__/allegro-sample.csv) ──
    {
      id: '17461178942-allegro-pl-sku',
      orderId: '17461178942',
      orderLineId: '17461178942',
      productId: '17461178942',
      skuId: '17461178942-sku',
      title: 'IBUVIT D3 4000 IU+K2 MK-7+OMEGA X30 Capsules',
      price: '27,77 zł',
      priceInfo: '27,77 zł|27|77',
      currency: 'PLN',
      quantity: 2,
      orderDate: 'Feb 5, 2026',
      orderDateIso: '2026-02-05',
      status: 'Completed',
      storeName: 'Zdrowa_Dolinka',
      storePageUrl: 'https://allegro.pl/uzytkownik/Zdrowa_Dolinka',
      productUrl: 'https://allegro.pl/oferta/17461178942',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2026-02-05').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'allegro-pl',
    },
    {
      id: '15530592799-allegro-pl-sku',
      orderId: '15530592799',
      orderLineId: '15530592799',
      productId: '15530592799',
      skuId: '15530592799-sku',
      title: 'OUTLET Minecraft Smelting Flame GKT34',
      price: '4,99 zł',
      priceInfo: '4,99 zł|4|99',
      currency: 'PLN',
      quantity: 1,
      orderDate: 'Mar 12, 2025',
      orderDateIso: '2025-03-12',
      status: 'Completed',
      storeName: 'Allegro_Outlet',
      storePageUrl: 'https://allegro.pl/uzytkownik/Allegro_Outlet',
      productUrl: 'https://allegro.pl/oferta/15530592799',
      imageUrl: '',
      attributes: '',
      timestamp: new Date('2025-03-12').getTime(),
      ignoreExport: false,
      tags: [],
      providerId: 'allegro-pl',
    },
  ];
}

function createMockStatus() {
  return {
    providerId: 'aliexpress',
    isCollecting: false,
    ordersCollected: 11,
    lastCollectedAt: new Date().toISOString(),
    error: null,
  };
}

// ─── Gradient Background CSS ─────────────────────────────────

const BACKGROUND_CSS = `
  html {
    width: ${WIDTH}px !important;
    height: ${HEIGHT}px !important;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
  }
  body {
    width: 420px !important;
    min-height: auto !important;
    max-height: 560px !important;
    border-radius: 16px !important;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.08),
      0 25px 60px rgba(0,0,0,0.5),
      0 10px 20px rgba(0,0,0,0.3) !important;
    overflow: hidden !important;
    margin: 0 !important;
  }
`;

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findExtensionId(browser) {
  // Try multiple times with increasing wait
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(2000);
    const targets = await browser.targets();

    if (attempt === 0) {
      console.log(`  Found ${targets.length} targets:`);
      for (const t of targets) {
        console.log(`    [${t.type()}] ${t.url()}`);
      }
    }

    // Look for service worker
    const swTarget = targets.find(
      (t) =>
        t.type() === 'service_worker' &&
        t.url().includes('chrome-extension://')
    );
    if (swTarget) {
      const match = swTarget.url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (match) return match[1];
    }

    // Look for any extension page
    const extTarget = targets.find(
      (t) =>
        t.url().startsWith('chrome-extension://') &&
        !t.url().includes('newtab')
    );
    if (extTarget) {
      const match = extTarget.url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (match) return match[1];
    }

    if (attempt < 9) {
      console.log(`  Waiting for extension to load... (attempt ${attempt + 1}/10)`);
    }
  }

  throw new Error(
    'Could not find extension ID after 10 attempts. Make sure the extension is built (npm run build) ' +
      'and the dist/ directory exists.'
  );
}

/**
 * Inject mock data into chrome.storage.local via the service worker.
 */
async function injectMockData(browser) {
  const targets = await browser.targets();
  const swTarget = targets.find(
    (t) =>
      t.type() === 'service_worker' &&
      t.url().includes('chrome-extension://')
  );

  if (!swTarget) {
    throw new Error('Service worker not found. Cannot inject data.');
  }

  const worker = await swTarget.worker();
  const orders = createMockOrders();
  const status = createMockStatus();

  await worker.evaluate(
    async (data) => {
      await chrome.storage.local.set({
        mpc_orders: data.orders,
        mpc_status: data.status,
      });
    },
    { orders, status }
  );

  console.log(`Injected ${orders.length} mock orders into storage.`);
}

/**
 * Open the popup page, force English, and apply screenshot styling.
 */
async function openPopup(browser, extensionId) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;

  // Force English language BEFORE the page loads React
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('mpc-language', 'en');
  });

  await page.goto(popupUrl, { waitUntil: 'networkidle0', timeout: 15000 });

  // Inject the gradient background CSS
  await page.addStyleTag({ content: BACKGROUND_CSS });

  // Wait for React to render and data to load
  await sleep(2500);

  return page;
}

async function takeScreenshot(page, filename) {
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({
    path: filepath,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    type: 'png',
  });
  console.log(`  -> ${filename}`);
}

// ─── Screenshot Scenarios ────────────────────────────────────

async function screenshot01_OrdersList(browser, extensionId) {
  console.log('\n[1/5] Orders list with images and status badges');
  const page = await openPopup(browser, extensionId);
  await takeScreenshot(page, '01-orders-list.png');
  await page.close();
}

async function screenshot02_ExportPanel(browser, extensionId) {
  console.log('\n[2/5] Export panel (CSV / JSON / HTML / Clipboard)');
  const page = await openPopup(browser, extensionId);

  // Click the green Export button
  const clicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const cl = btn.className || '';
      if (cl.includes('bg-green-50') && cl.includes('text-green-700') && !btn.disabled) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (!clicked) {
    console.log('  Warning: Export button not found or disabled.');
  }

  await sleep(500);
  await takeScreenshot(page, '02-export-panel.png');
  await page.close();
}

async function screenshot03_FilterBar(browser, extensionId) {
  console.log('\n[3/5] Filter bar with active status filter');
  const page = await openPopup(browser, extensionId);

  // Click the "Completed" status filter pill
  const clicked = await page.evaluate(() => {
    const pills = document.querySelectorAll('button.rounded-full');
    for (const pill of pills) {
      const cl = pill.className || '';
      if (cl.includes('bg-gray-100') && cl.includes('text-gray-500')) {
        pill.click();
        return true;
      }
    }
    return false;
  });

  if (!clicked) {
    console.log('  Warning: Status filter pill not found.');
  }

  await sleep(800);
  await takeScreenshot(page, '03-filter-bar.png');
  await page.close();
}

async function screenshot04_EmptyState(browser, extensionId) {
  console.log('\n[4/5] Empty state view');
  const page = await openPopup(browser, extensionId);

  // Clear all orders to show empty state
  const targets = await browser.targets();
  const swTarget = targets.find(
    (t) =>
      t.type() === 'service_worker' &&
      t.url().includes('chrome-extension://')
  );
  if (swTarget) {
    const worker = await swTarget.worker();
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ mpc_orders: [] });
    });
  }

  // Reload the popup to reflect cleared data
  await page.reload({ waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: BACKGROUND_CSS });
  await sleep(2000);

  await takeScreenshot(page, '04-empty-state.png');
  await page.close();

  // Restore mock data for remaining screenshots
  await injectMockData(browser);
  await sleep(500);
}

async function screenshot05_LanguageSelector(browser, extensionId) {
  console.log('\n[5/5] Language selector dropdown (expanded)');
  const page = await openPopup(browser, extensionId);

  // Click the language/globe button in the header
  const clicked = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return false;
    const buttons = header.querySelectorAll('button');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      const text = btn.textContent?.trim();
      // The language button has a small text (e.g. "EN") and a globe SVG
      if (svg && text && text.length <= 3) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (!clicked) {
    console.log('  Warning: Language button not found in header.');
  }

  await sleep(600);

  // Ensure the dropdown is visible (not clipped by overflow)
  await page.addStyleTag({
    content: `
      body { overflow: visible !important; }
      header { overflow: visible !important; }
      .relative { overflow: visible !important; }
      /* Make dropdown visible with nice shadow */
      .absolute.right-0.top-full {
        max-height: 400px !important;
        overflow-y: auto !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
      }
    `,
  });

  await sleep(300);
  await takeScreenshot(page, '05-language-selector.png');
  await page.close();
}

// ─── Promotional Images ──────────────────────────────────────

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#3B82F6"/><stop offset="100%" style="stop-color:#2563EB"/>
  </linearGradient></defs>
  <rect x="4" y="4" width="120" height="120" rx="24" ry="24" fill="url(#bg)"/>
  <path d="M36 50 L36 96 C36 100.4 39.6 104 44 104 L84 104 C88.4 104 92 100.4 92 96 L92 50 Z" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 50 L50 38 C50 30.3 55.4 24 64 24 C72.6 24 78 30.3 78 38 L78 50" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M64 62 L64 86" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <path d="M54 78 L64 88 L74 78" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function buildSmallPromoHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  body {
    width: 440px; height: 280px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: white; overflow: hidden;
    position: relative;
  }
  /* Subtle grid pattern overlay */
  body::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
      radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);
    background-size: 24px 24px;
  }
  .icon { width: 56px; height: 56px; margin-bottom: 12px; position: relative; }
  .title {
    font-size: 22px; font-weight: 700;
    letter-spacing: -0.3px; margin-bottom: 6px;
    position: relative;
  }
  .tagline {
    font-size: 13px; font-weight: 400;
    color: rgba(255,255,255,0.7); margin-bottom: 20px;
    position: relative;
  }
  .platforms {
    display: flex; gap: 8px; position: relative;
  }
  .platform-pill {
    font-size: 11px; font-weight: 500;
    padding: 4px 12px; border-radius: 20px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.85);
  }
  .formats {
    display: flex; gap: 12px; margin-top: 12px;
    position: relative;
  }
  .format {
    font-size: 10px; font-weight: 600;
    color: rgba(255,255,255,0.45);
    letter-spacing: 1px; text-transform: uppercase;
  }
  .dot { color: rgba(255,255,255,0.2); }
</style></head><body>
  <div class="icon">${ICON_SVG.replace('width="128" height="128"', 'width="56" height="56"')}</div>
  <div class="title">My Purchases Collector</div>
  <div class="tagline">Collect &amp; Export Your Online Orders</div>
  <div class="platforms">
    <span class="platform-pill">AliExpress</span>
    <span class="platform-pill">Temu</span>
    <span class="platform-pill">Allegro</span>
    <span class="platform-pill">Amazon</span>
  </div>
  <div class="formats">
    <span class="format">CSV</span>
    <span class="format dot">&middot;</span>
    <span class="format">JSON</span>
    <span class="format dot">&middot;</span>
    <span class="format">HTML</span>
    <span class="format dot">&middot;</span>
    <span class="format">Clipboard</span>
  </div>
</body></html>`;
}

function buildBannerHTML(popupScreenshotPath) {
  // Encode the popup screenshot as base64 data URI for embedding
  let popupImgSrc = '';
  if (fs.existsSync(popupScreenshotPath)) {
    const data = fs.readFileSync(popupScreenshotPath);
    popupImgSrc = `data:image/png;base64,${data.toString('base64')}`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  body {
    width: 1400px; height: 560px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex; align-items: center;
    color: white; overflow: hidden;
    position: relative;
  }
  body::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
      radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);
    background-size: 24px 24px;
  }
  /* Decorative glow */
  body::after {
    content: '';
    position: absolute;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
    top: -100px; right: 200px;
    pointer-events: none;
  }

  .left {
    flex: 1; padding: 60px 60px 60px 80px;
    display: flex; flex-direction: column;
    justify-content: center;
    position: relative; z-index: 1;
  }
  .icon-row {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 20px;
  }
  .icon { width: 52px; height: 52px; }
  .brand-name {
    font-size: 16px; font-weight: 600;
    color: rgba(255,255,255,0.6);
    letter-spacing: 0.5px;
  }
  .headline {
    font-size: 38px; font-weight: 800;
    line-height: 1.15; letter-spacing: -0.5px;
    margin-bottom: 16px;
    max-width: 520px;
  }
  .headline .highlight {
    background: linear-gradient(90deg, #3B82F6, #60A5FA);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .subtitle {
    font-size: 16px; font-weight: 400;
    color: rgba(255,255,255,0.6);
    line-height: 1.5;
    max-width: 440px;
    margin-bottom: 28px;
  }
  .platforms {
    display: flex; gap: 8px; margin-bottom: 20px;
  }
  .platform-pill {
    font-size: 12px; font-weight: 500;
    padding: 6px 14px; border-radius: 20px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.85);
  }
  .features {
    display: flex; gap: 20px;
  }
  .feature {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 500;
    color: rgba(255,255,255,0.5);
  }
  .feature-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #3B82F6;
  }

  .right {
    width: 540px; height: 100%;
    display: flex; align-items: center; justify-content: center;
    position: relative; z-index: 1;
    padding-right: 40px;
  }
  .popup-mockup {
    width: 320px;
    border-radius: 12px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.08),
      0 20px 50px rgba(0,0,0,0.5),
      0 8px 16px rgba(0,0,0,0.3);
    overflow: hidden;
  }
  .popup-mockup img {
    display: block; width: 100%;
    /* Crop: show only the popup card from the full 1280x800 screenshot */
    /* The popup is centered, so we crop to show just the card */
  }
</style></head><body>
  <div class="left">
    <div class="icon-row">
      <div class="icon">${ICON_SVG.replace('width="128" height="128"', 'width="52" height="52"')}</div>
      <span class="brand-name">My Purchases Collector</span>
    </div>
    <div class="headline">
      Collect &amp; Export<br>
      <span class="highlight">Online Orders</span><br>
      with One Click
    </div>
    <div class="subtitle">
      Automatically capture orders from 4 platforms and export to CSV, JSON, HTML, or clipboard.
    </div>
    <div class="platforms">
      <span class="platform-pill">AliExpress</span>
      <span class="platform-pill">Temu</span>
      <span class="platform-pill">Allegro</span>
      <span class="platform-pill">Amazon</span>
    </div>
    <div class="features">
      <div class="feature"><span class="feature-dot"></span> 15 Languages</div>
      <div class="feature"><span class="feature-dot"></span> Privacy-First</div>
      <div class="feature"><span class="feature-dot"></span> Open Source</div>
    </div>
  </div>
  <div class="right">
    ${popupImgSrc ? `<img class="popup-mockup" src="${popupImgSrc}" />` : ''}
  </div>
</body></html>`;
}

async function generatePromoSmall(browser) {
  console.log('\n[Promo] Small promotional tile (440x280)');
  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  await page.setContent(buildSmallPromoHTML(), { waitUntil: 'networkidle0' });
  await sleep(1000);

  const filepath = path.join(SCREENSHOTS_DIR, 'promo-small-440x280.png');
  await page.screenshot({
    path: filepath,
    clip: { x: 0, y: 0, width: 440, height: 280 },
    type: 'png',
  });
  console.log(`  -> promo-small-440x280.png`);
  await page.close();
}

async function generatePromoBanner(browser) {
  console.log('\n[Promo] Large promotional banner (1400x560)');

  // Use the orders-list screenshot as popup mockup
  const popupScreenshotPath = path.join(SCREENSHOTS_DIR, '01-orders-list.png');

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
  await page.setContent(buildBannerHTML(popupScreenshotPath), { waitUntil: 'networkidle0' });
  await sleep(1000);

  const filepath = path.join(SCREENSHOTS_DIR, 'promo-banner-1400x560.png');
  await page.screenshot({
    path: filepath,
    clip: { x: 0, y: 0, width: 1400, height: 560 },
    type: 'png',
  });
  console.log(`  -> promo-banner-1400x560.png`);
  await page.close();
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('Chrome Web Store Screenshot Generator');
  console.log('=====================================');
  console.log(`Resolution:  ${WIDTH}x${HEIGHT}`);
  console.log(`Language:    English (en)`);
  console.log(`Output:      ${SCREENSHOTS_DIR}/`);

  // Check that dist/ exists
  if (!fs.existsSync(path.join(EXTENSION_DIST, 'manifest.json'))) {
    console.error('\nError: Extension not built. Run `npm run build` first.');
    process.exit(1);
  }

  // Create a temporary user data directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpc-screenshots-'));
  console.log(`Temp profile: ${tmpDir}`);
  console.log('\nLaunching Chrome...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIST}`,
      `--load-extension=${EXTENSION_DIST}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      '--no-first-run',
    ],
    userDataDir: tmpDir,
    defaultViewport: null,
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  try {
    const extensionId = await findExtensionId(browser);
    console.log(`Extension ID: ${extensionId}`);

    // Inject mock data before taking screenshots
    await injectMockData(browser);

    await screenshot01_OrdersList(browser, extensionId);
    await screenshot02_ExportPanel(browser, extensionId);
    await screenshot03_FilterBar(browser, extensionId);
    await screenshot04_EmptyState(browser, extensionId);
    await screenshot05_LanguageSelector(browser, extensionId);

    // Promotional images (rendered from HTML templates, no extension needed)
    await generatePromoSmall(browser);
    await generatePromoBanner(browser);

    console.log('\n=====================================');
    console.log('Done! Screenshots saved:');
    const files = fs
      .readdirSync(SCREENSHOTS_DIR)
      .filter((f) => f.endsWith('.png'));
    files.forEach((f) => {
      const stats = fs.statSync(path.join(SCREENSHOTS_DIR, f));
      const kb = (stats.size / 1024).toFixed(0);
      console.log(`  ${f} (${kb} KB)`);
    });
  } finally {
    await browser.close();
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('\nTemp profile cleaned up.');
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
