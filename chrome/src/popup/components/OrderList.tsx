import type { OrderItem } from '@/types/order';
import { OrderCard } from './OrderCard';

interface OrderListProps {
  orders: OrderItem[];
}

export function OrderList({ orders }: OrderListProps) {
  return (
    <div className="divide-y divide-gray-100">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
