import type { CollectionStatus } from '@/types/order';
import { Wifi, WifiOff } from 'lucide-react';

interface StatusBadgeProps {
  status: CollectionStatus | null;
  orderCount: number;
}

export function StatusBadge({ status, orderCount }: StatusBadgeProps) {
  const isActive = status?.isCollecting ?? false;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-blue-100">{orderCount} orders</span>
      <div
        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
          isActive
            ? 'bg-green-500/20 text-green-200'
            : 'bg-white/10 text-blue-200'
        }`}
        title={
          isActive
            ? 'Listening for order data on AliExpress'
            : 'Open AliExpress orders page to start collecting'
        }
      >
        {isActive ? <Wifi size={10} /> : <WifiOff size={10} />}
        {isActive ? 'Active' : 'Idle'}
      </div>
    </div>
  );
}
