import { useTranslation } from 'react-i18next';
import type { OrderItem } from '@shared/types/order';
import { ExternalLink, Package } from 'lucide-react';

interface OrderCardProps {
  order: OrderItem;
}

/** Map English status values from order data to translation keys */
const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  'Completed': 'orderStatus.completed',
  'Awaiting delivery': 'orderStatus.awaitingDelivery',
  'In Transit': 'orderStatus.inTransit',
  'Processing': 'orderStatus.processing',
  'Expired': 'orderStatus.expired',
  'Cancelled': 'orderStatus.cancelled',
};

export function OrderCard({ order }: OrderCardProps) {
  return (
    <div className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      {/* Image */}
      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-md overflow-hidden">
        {order.imageUrl ? (
          <img
            src={order.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-full h-full flex items-center justify-center ${order.imageUrl ? 'hidden' : ''}`}>
          <Package size={20} className="text-gray-300" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">
            {order.productUrl ? (
              <a
                href={order.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                {order.title}
              </a>
            ) : (
              order.title
            )}
          </h3>
          <span className="flex-shrink-0 text-xs font-semibold text-gray-900 whitespace-nowrap">
            {order.price}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
          <span>{order.orderDate}</span>
          {order.storeName && (
            <>
              <span className="text-gray-300">|</span>
              <span className="truncate">{order.storeName}</span>
            </>
          )}
          {order.quantity > 1 && (
            <>
              <span className="text-gray-300">|</span>
              <span>x{order.quantity}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <StatusPill status={order.status} />
          {order.attributes && (
            <span className="text-[10px] text-gray-400 truncate max-w-[180px]">
              {order.attributes}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();

  const colors: Record<string, string> = {
    Completed: 'bg-green-100 text-green-700',
    'Awaiting delivery': 'bg-blue-100 text-blue-700',
    'In Transit': 'bg-blue-100 text-blue-700',
    Processing: 'bg-yellow-100 text-yellow-700',
    Expired: 'bg-gray-100 text-gray-500',
    Cancelled: 'bg-red-100 text-red-600',
  };

  const colorClass = colors[status] ?? 'bg-gray-100 text-gray-500';
  const translationKey = STATUS_TRANSLATION_KEYS[status];
  const displayStatus = translationKey ? t(translationKey) : (status || t('orderStatus.unknown'));

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colorClass}`}>
      {displayStatus}
    </span>
  );
}
