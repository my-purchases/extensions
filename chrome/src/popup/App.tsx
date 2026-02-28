import { useState, useEffect, useCallback, useRef } from 'react';
import type { OrderItem, CollectionStatus } from '@/types/order';
import type { RuntimeMessage, RuntimeResponse, ExportFormat, OrderFilters, AutoCollectState } from '@/shared/messages';
import { OrderList } from './components/OrderList';
import { ExportPanel } from './components/ExportPanel';
import { FilterBar } from './components/FilterBar';
import { StatusBadge } from './components/StatusBadge';
import { ShoppingBag, RefreshCw, Trash2, ExternalLink, Play, Square, Loader2 } from 'lucide-react';

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message);
}

export default function App() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [status, setStatus] = useState<CollectionStatus | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({});
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [autoCollect, setAutoCollect] = useState<AutoCollectState>({
    isRunning: false,
    currentPage: 0,
    totalOrders: 0,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sendMessage({ type: 'GET_ORDERS', filters });
      if (res.success && res.orders) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
    setLoading(false);
  }, [filters]);

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
    if (!confirm('Delete all collected orders? This cannot be undone.')) return;
    await sendMessage({ type: 'CLEAR_ORDERS' });
    setOrders([]);
  };

  const handleExport = async (format: ExportFormat) => {
    const res = await sendMessage({ type: 'EXPORT_ORDERS', format });
    if (!res.success || !res.data) return;

    if (format === 'clipboard') {
      await navigator.clipboard.writeText(res.data);
      alert('Copied to clipboard! You can paste it into Google Sheets.');
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
    chrome.tabs.create({ url: 'https://www.aliexpress.com/p/order/index.html' });
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

  return (
    <div className="flex flex-col bg-gray-50 text-gray-900" style={{ minHeight: 'var(--popup-height)' }}>
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} />
          <h1 className="text-sm font-semibold">My Purchases Collector</h1>
        </div>
        <StatusBadge status={status} orderCount={orders.length} />
      </header>

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <button
          onClick={handleOpenOrders}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
        >
          <ExternalLink size={14} />
          Open Orders
        </button>

        {/* Auto-collect button */}
        {autoCollect.isRunning ? (
          <button
            onClick={handleStopAutoCollect}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
          >
            <Square size={14} />
            Stop
          </button>
        ) : (
          <button
            onClick={handleStartAutoCollect}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 transition-colors"
            title="Auto-scroll through all order pages to collect everything"
          >
            <Play size={14} />
            Collect All
          </button>
        )}

        <button
          onClick={() => { loadOrders(); loadStatus(); }}
          className="flex items-center gap-1 text-xs px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setShowExport(!showExport)}
          disabled={orders.length === 0}
          className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export ({orders.length})
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
            Collecting... page {autoCollect.currentPage}
            {autoCollect.totalOrders > 0 && ` (${autoCollect.totalOrders} orders)`}
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
            Loading...
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <ShoppingBag size={40} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">No orders collected yet</p>
            <p className="text-xs text-gray-400">
              Open your AliExpress orders page and browse through them.
              Orders will be captured automatically.
            </p>
            <button
              onClick={handleOpenOrders}
              className="mt-4 text-xs px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to AliExpress Orders
            </button>
          </div>
        ) : (
          <OrderList orders={orders} />
        )}
      </div>

      {/* Footer */}
      <footer className="px-4 py-2 bg-white border-t border-gray-200 text-[10px] text-gray-400 text-center">
        My Purchases Collector v0.1.0
      </footer>
    </div>
  );
}
