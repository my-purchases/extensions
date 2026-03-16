/**
 * Safari extension multi-stage build script.
 *
 * Runs 4 sequential Vite builds to produce the final dist/ folder:
 *   1. Popup — standard HTML entry (ES modules, code splitting OK)
 *   2. Service worker — single ES module bundle
 *   3. Main-world content script — single IIFE bundle (self-contained)
 *   4. Isolated-world content script — single IIFE bundle
 *
 * Then copies manifest.json and icons into dist/.
 */

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, mkdirSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST = resolve(__dirname, 'dist');
const SRC = resolve(__dirname, 'src');
const SHARED = resolve(__dirname, '../shared/src');

/** Common resolve aliases used by all builds */
const commonResolve = {
  alias: {
    '@': SRC,
    '@shared': SHARED,
  },
  dedupe: [
    'i18next',
    'react-i18next',
    'i18next-browser-languagedetector',
    'react',
    'react-dom',
  ],
};

// ── Clean dist/ ─────────────────────────────────────────────

console.log('🧹 Cleaning dist/...');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ── Build 1: Popup ──────────────────────────────────────────

console.log('\n📦 Building popup...');
await build({
  configFile: false,
  plugins: [react(), tailwindcss()],
  resolve: commonResolve,
  root: resolve(SRC, 'popup'),
  base: './',
  publicDir: false,
  build: {
    outDir: resolve(DIST, 'popup'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(SRC, 'popup/index.html'),
      output: {
        manualChunks(id) {
          // Split heavy vendor libraries into a separate chunk
          if (id.includes('node_modules')) {
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
});

// ── Build 2: Service Worker ─────────────────────────────────

console.log('\n📦 Building service worker...');
await build({
  configFile: false,
  plugins: [],
  resolve: commonResolve,
  publicDir: false,
  build: {
    outDir: resolve(DIST, 'background'),
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: resolve(SRC, 'background/service-worker.ts'),
      formats: ['es'],
      fileName: () => 'service-worker.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

// ── Build 3: Main-world content script ──────────────────────

console.log('\n📦 Building main-world content script...');
await build({
  configFile: false,
  plugins: [],
  resolve: commonResolve,
  publicDir: false,
  build: {
    outDir: resolve(DIST, 'content'),
    emptyOutDir: false,  // Don't wipe — isolated-world goes here too
    sourcemap: false,
    lib: {
      entry: resolve(SRC, 'content/main-world.ts'),
      formats: ['iife'],
      name: 'MPCMainWorld',
      fileName: () => 'main-world.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

// ── Build 4: Isolated-world content script ──────────────────

console.log('\n📦 Building isolated-world content script...');
await build({
  configFile: false,
  plugins: [],
  resolve: commonResolve,
  publicDir: false,
  build: {
    outDir: resolve(DIST, 'content'),
    emptyOutDir: false,  // Don't wipe — main-world is already here
    sourcemap: false,
    lib: {
      entry: resolve(SRC, 'content/isolated-world.ts'),
      formats: ['iife'],
      name: 'MPCIsolatedWorld',
      fileName: () => 'isolated-world.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

// ── Copy static assets ──────────────────────────────────────

console.log('\n📋 Copying manifest.json and icons...');

cpSync(resolve(__dirname, 'manifest.json'), resolve(DIST, 'manifest.json'));
cpSync(resolve(__dirname, 'public/icons'), resolve(DIST, 'icons'), { recursive: true });

console.log('\n✅ Safari extension built successfully!');
console.log(`   Output: ${DIST}`);
