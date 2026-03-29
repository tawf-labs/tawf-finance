import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'absolute' | 'percentage';
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  trend?: 'up' | 'down' | 'neutral';
  color?: 'green' | 'gold' | 'blue' | 'purple';
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      title,
      value,
      change,
      changeType = 'percentage',
      icon,
      size = 'md',
      trend,
      color = 'green',
      className,
      ...props
    },
    ref
  ) => {
    // Auto-determine trend if change is provided but trend is not
    const detectedTrend = trend !== undefined ? trend : change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined;

    const colorStyles = {
      green: 'text-tawf-green',
      gold: 'text-tawf-gold',
      blue: 'text-blue-500',
      purple: 'text-purple-500',
    };

    const bgStyles = {
      green: 'bg-tawf-green-10',
      gold: 'bg-tawf-gold-10',
      blue: 'bg-blue-50',
      purple: 'bg-purple-50',
    };

    const sizeStyles = {
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const valueSizeStyles = {
      sm: 'text-xl',
      md: 'text-2xl',
      lg: 'text-3xl',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-2xl border border-tawf-green-10 bg-white transition-all duration-300', sizeStyles[size], className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">{title}</p>
            <p className={cn('font-serif font-semibold', colorStyles[color], valueSizeStyles[size])}>{value}</p>

            {change !== undefined && detectedTrend && (
              <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', detectedTrend === 'up' ? 'text-green-600' : detectedTrend === 'down' ? 'text-red-600' : 'text-tawf-muted')}>
                {detectedTrend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                {detectedTrend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                {detectedTrend === 'neutral' && <Minus className="w-3.5 h-3.5" />}
                <span>
                  {changeType === 'percentage' ? `${change > 0 ? '+' : ''}${change}%` : `${change > 0 ? '+' : ''}${change}`}
                  <span className="text-tawf-muted ml-1">vs last month</span>
                </span>
              </div>
            )}
          </div>

          {icon && (
            <div className={cn('p-3 rounded-xl', bgStyles[color])}>
              {icon}
            </div>
          )}
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';
