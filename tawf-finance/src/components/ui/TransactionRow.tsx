import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDate } from '@/data/mockData';

export interface TransactionRowProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  type: 'deposit' | 'invest' | 'repayment' | 'withdraw' | 'refund';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
  showDate?: boolean;
  compact?: boolean;
}

const typeConfig = {
  deposit: {
    icon: ArrowDownLeft,
    label: 'Deposit',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    iconBg: 'bg-green-100',
  },
  invest: {
    icon: ArrowUpRight,
    label: 'Investment',
    color: 'text-tawf-green',
    bgColor: 'bg-tawf-green-5',
    iconBg: 'bg-tawf-green-10',
  },
  repayment: {
    icon: RefreshCw,
    label: 'Return',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    iconBg: 'bg-blue-100',
  },
  withdraw: {
    icon: ArrowUpRight,
    label: 'Withdrawal',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    iconBg: 'bg-orange-100',
  },
  refund: {
    icon: AlertCircle,
    label: 'Refund',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    iconBg: 'bg-red-100',
  },
};

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', color: 'text-yellow-600' },
  completed: { icon: CheckCircle, label: 'Completed', color: 'text-green-600' },
  failed: { icon: AlertCircle, label: 'Failed', color: 'text-red-600' },
};

export const TransactionRow = forwardRef<HTMLDivElement, TransactionRowProps>(
  (
    {
      id,
      type,
      amount,
      status,
      description,
      createdAt,
      showDate = true,
      compact = false,
      className,
      ...props
    },
    ref
  ) => {
    const typeInfo = typeConfig[type];
    const statusInfo = statusConfig[status];
    const TypeIcon = typeInfo.icon;
    const StatusIcon = statusInfo.icon;

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    if (compact) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center justify-between py-2 px-3 rounded-lg hover:bg-tawf-sand-30 transition-colors',
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', typeInfo.iconBg)}>
              <TypeIcon className={cn('w-4 h-4', typeInfo.color)} />
            </div>
            <div>
              <p className="text-sm font-medium text-tawf-ink">{description}</p>
              {showDate && (
                <p className="text-xs text-tawf-muted">{formatDate(createdAt)}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-sm font-semibold', type === 'deposit' || type === 'repayment' ? 'text-green-600' : 'text-tawf-ink')}>
              {type === 'deposit' || type === 'repayment' ? '+' : '-'}
              {formatCurrency(amount)}
            </p>
            <div className={cn('flex items-center justify-end gap-1 text-xs', statusInfo.color)}>
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between py-4 px-4 rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 transition-colors bg-white',
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-xl', typeInfo.iconBg)}>
            <TypeIcon className={cn('w-5 h-5', typeInfo.color)} />
          </div>
          <div>
            <p className="font-medium text-tawf-ink">{description}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-xs px-2 py-0.5 rounded-md', typeInfo.bgColor, typeInfo.color)}>
                {typeInfo.label}
              </span>
              {showDate && (
                <span className="text-xs text-tawf-muted">{formatDate(createdAt)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className={cn('text-lg font-semibold', type === 'deposit' || type === 'repayment' ? 'text-green-600' : 'text-tawf-ink')}>
              {type === 'deposit' || type === 'repayment' ? '+' : '-'}
              {formatCurrency(amount)}
            </p>
            <div className={cn('flex items-center justify-end gap-1 text-sm', statusInfo.color)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusInfo.label}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TransactionRow.displayName = 'TransactionRow';
