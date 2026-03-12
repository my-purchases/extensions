import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderItem, CollectionStatus } from '@/types/order';
import type { RuntimeMessage, RuntimeResponse, ExportFormat, OrderFilters, AutoCollectState } from '@/shared/messages';
import { OrderList } from './components/OrderList';
import { ExportPanel } from './components/ExportPanel';
import { FilterBar } from './components/FilterBar';
import { StatusBadge } from './components/StatusBadge';
import { LanguageSelector } from './components/LanguageSelector';
import { ShoppingBag, RefreshCw, Trash2, ExternalLink, Play, Square, Loader2 } from 'lucide-react';

type ProviderTab = 'all' | 'aliexpress' | 'temu' | 'allegro' | 'amazon';

const PROVIDER_TAB_KEYS: Record<ProviderTab, string> = {
  all: 'tabs.all',
  aliexpress: 'tabs.aliexpress',
  temu: 'tabs.temu',
  allegro: 'tabs.allegro',
  amazon: 'tabs.amazon',
};

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message);
}

export default function App() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [status, setStatus] = useState<CollectionStatus | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({});
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [providerTab, setProviderTab] = useState<ProviderTab>('all');
  const [autoCollect, setAutoCollect] = useState<AutoCollectState>({
    isRunning: false,
    currentPage: 0,
    totalOrders: 0,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const appliedFilters: OrderFilters = { ...filters };
      if (providerTab === 'allegro') {
        appliedFilters.providerId = ['allegro-pl', 'allegro-cz'];
      } else if (providerTab === 'amazon') {
        appliedFilters.providerId = 'amazon';
      } else if (providerTab !== 'all') {
        appliedFilters.providerId = providerTab;
      }
      const res = await sendMessage({ type: 'GET_ORDERS', filters: appliedFilters });
      if (res.success && res.orders) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
    setLoading(false);
  }, [filters, providerTab]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await sendMessage({ type: 'GET_STATUS' });
      if (res.success && res.status) {
        setStatus(res.status);
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }, []);

  const loadAutoCollectStatus = useCallback(async () => {
    try {
      const res = await sendMessage({ type: 'AUTO_COLLECT_STATUS' });
      if (res.success && res.autoCollect) {
        setAutoCollect(res.autoCollect);
        // If done, stop polling
        if (!res.autoCollect.isRunning && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          // Reload orders to get the final count
          loadOrders();
        }
      }
    } catch {
      // Ignore
    }
  }, [loadOrders]);

  useEffect(() => {
    loadOrders();
    loadStatus();
    loadAutoCollectStatus();
  }, [loadOrders, loadStatus, loadAutoCollectStatus]);

  // Listen for storage changes (real-time updates from content scripts)
  useEffect(() => {
    const listener = () => {
      loadOrders();
      loadStatus();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadOrders, loadStatus]);

  // Poll auto-collect status while running
  useEffect(() => {
    if (autoCollect.isRunning && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadAutoCollectStatus();
      }, 2000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [autoCollect.isRunning, loadAutoCollectStatus]);

  const handleClearAll = async () => {
    if (!confirm(t('dialogs.deleteConfirm'))) return;
    await sendMessage({ type: 'CLEAR_ORDERS' });
    setOrders([]);
  };

  const handleExport = async (format: ExportFormat) => {
    const res = await sendMessage({ type: 'EXPORT_ORDERS', format });
    if (!res.success || !res.data) return;

    if (format === 'clipboard') {
      await navigator.clipboard.writeText(res.data);
      alert(t('dialogs.copiedToClipboard'));
      return;
    }

    // Download file
    const mimeTypes: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html',
    };
    const extensions: Record<string, string> = {
      csv: 'csv',
      json: 'json',
      html: 'html',
    };

    const blob = new Blob([res.data], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `my-purchases-${date}.${extensions[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenOrders = () => {
    if (providerTab === 'temu') {
      chrome.tabs.create({ url: 'https://www.temu.com/bgt_orders.html' });
    } else if (providerTab === 'allegro') {
      chrome.tabs.create({ url: 'https://allegro.pl/moje-allegro/zakupy/kupione' });
    } else if (providerTab === 'amazon') {
      chrome.tabs.create({ url: 'https://www.amazon.com/gp/css/order-history' });
    } else {
      chrome.tabs.create({ url: 'https://www.aliexpress.com/p/order/index.html' });
    }
  };

  const handleStartAutoCollect = async () => {
    const res = await sendMessage({ type: 'START_AUTO_COLLECT' });
    if (res.success) {
      setAutoCollect({ isRunning: true, currentPage: 0, totalOrders: orders.length });
      // Start polling for progress
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          loadAutoCollectStatus();
        }, 2000);
      }
    } else if (!res.success) {
      alert(res.error || 'Failed to start auto-collect');
    }
  };

  const handleStopAutoCollect = async () => {
    await sendMessage({ type: 'STOP_AUTO_COLLECT' });
    setAutoCollect((prev) => ({ ...prev, isRunning: false }));
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    loadOrders();
  };

  const getEmptyInstructions = (): string => {
    switch (providerTab) {
      case 'temu': return t('empty.instructionsTemu');
      case 'allegro': return t('empty.instructionsAllegro');
      case 'aliexpress': return t('empty.instructionsAliexpress');
      case 'amazon': return t('empty.instructionsAmazon');
      default: return t('empty.instructionsAll');
    }
  };

  const getGoToLabel = (): string => {
    switch (providerTab) {
      case 'temu': return t('empty.goToTemu');
      case 'allegro': return t('empty.goToAllegro');
      case 'amazon': return t('empty.goToAmazon');
      default: return t('empty.goToAliexpress');
    }
  };

  return (
    <div className="flex flex-col bg-gray-50 text-gray-900" style={{ minHeight: 'var(--popup-height)' }}>
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} />
          <h1 className="text-sm font-semibold">{t('header.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} orderCount={orders.length} />
          <LanguageSelector />
        </div>
      </header>

      {/* Provider tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {(['all', 'aliexpress', 'temu', 'allegro', 'amazon'] as ProviderTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setProviderTab(tab)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              providerTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t(PROVIDER_TAB_KEYS[tab])}
          </button>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <button
          onClick={handleOpenOrders}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
        >
          <ExternalLink size={14} />
          {t('actions.openOrders')}
        </button>

        {/* Auto-collect button */}
        {autoCollect.isRunning ? (
          <button
            onClick={handleStopAutoCollect}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
          >
            <Square size={14} />
            {t('actions.stop')}
          </button>
        ) : (
          <button
            onClick={handleStartAutoCollect}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 transition-colors"
            title={t('actions.collectAllTitle')}
          >
            <Play size={14} />
            {t('actions.collectAll')}
          </button>
        )}

        <button
          onClick={() => { loadOrders(); loadStatus(); }}
          className="flex items-center gap-1 text-xs px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          title={t('actions.refresh')}
        >
          <RefreshCw size={14} />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setShowExport(!showExport)}
          disabled={orders.length === 0}
          className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t('actions.export', { count: orders.length })}
        </button>
        <button
          onClick={handleClearAll}
          disabled={orders.length === 0}
          className="flex items-center gap-1 text-xs px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Auto-collect progress bar */}
      {autoCollect.isRunning && (
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
          <Loader2 size={14} className="text-orange-600 animate-spin" />
          <span className="text-xs text-orange-700">
            {t('autoCollect.collecting', { page: autoCollect.currentPage })}
            {autoCollect.totalOrders > 0 && ` ${t('autoCollect.orders', { count: autoCollect.totalOrders })}`}
          </span>
        </div>
      )}

      {/* Auto-collect error */}
      {!autoCollect.isRunning && autoCollect.error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600">
          {autoCollect.error}
        </div>
      )}

      {/* Export panel (collapsible) */}
      {showExport && <ExportPanel onExport={handleExport} orderCount={orders.length} />}

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Order list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            {t('loading')}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <ShoppingBag size={40} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">{t('empty.noOrders')}</p>
            <p className="text-xs text-gray-400">
              {getEmptyInstructions()}
            </p>
            <button
              onClick={handleOpenOrders}
              className="mt-4 text-xs px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {getGoToLabel()}
            </button>
          </div>
        ) : (
          <OrderList orders={orders} />
        )}
      </div>

      {/* Footer */}
      <footer className="px-4 py-2 bg-white border-t border-gray-200 text-[10px] text-gray-400 text-center">
        {t('footer', { version: '0.4.0' })}
      </footer>
    </div>
  );
}
