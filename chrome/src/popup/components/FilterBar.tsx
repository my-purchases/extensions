import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderFilters } from '@/shared/messages';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  filters: OrderFilters;
  onChange: (filters: OrderFilters) => void;
}

const STATUS_FILTERS: { value: string | undefined; key: string }[] = [
  { value: undefined, key: 'filter.all' },
  { value: 'Awaiting delivery', key: 'filter.awaitingDelivery' },
  { value: 'Completed', key: 'filter.completed' },
  { value: 'In Transit', key: 'filter.inTransit' },
  { value: 'Processing', key: 'filter.processing' },
  { value: 'Expired', key: 'filter.expired' },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const { t } = useTranslation();
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
            placeholder={t('filter.searchPlaceholder')}
            value={filters.search ?? ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => onChange({})}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            title={t('filter.clearFilters')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {STATUS_FILTERS.map(({ value, key }) => {
          const isActive = filters.status === value;
          return (
            <button
              key={key}
              onClick={() => onChange({ ...filters, status: value })}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t(key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
