import { useState } from 'react';
import type { OrderFilters } from '@/shared/messages';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  filters: OrderFilters;
  onChange: (filters: OrderFilters) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasFilters = !!(filters.search || filters.status || filters.dateFrom || filters.dateTo);

  return (
    <div className="px-4 py-2 bg-white border-b border-gray-100">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={filters.search ?? ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => onChange({})}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            title="Clear filters"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {['All', 'Awaiting delivery', 'Completed', 'In Transit', 'Processing', 'Expired'].map((s) => {
          const value = s === 'All' ? undefined : s;
          const isActive = filters.status === value;
          return (
            <button
              key={s}
              onClick={() => onChange({ ...filters, status: value })}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
