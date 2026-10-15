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
      green: 'text-ink',
      gold: 'text-honey',
      blue: 'text-[#1E4A6B]',
      purple: 'text-[#4F3A6E]',
    };

    const bgStyles = {
      green: 'bg-glaze text-jade',
      gold: 'bg-butter/70 text-honey',
      blue: 'bg-[#E0EAF2] text-[#1E4A6B]',
      purple: 'bg-[#ECE6F2] text-[#4F3A6E]',
    };

    const sizeStyles = {
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const valueSizeStyles = {
      sm: 'text-2xl',
      md: 'text-[1.9rem]',
      lg: 'text-4xl',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-2xl border border-line bg-white transition-[box-shadow] duration-300 hover:shadow-tile', sizeStyles[size], className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[0.8rem] font-medium text-tawf-muted mb-2">{title}</p>
            <p className={cn('display font-semibold tabular-nums leading-none', colorStyles[color], valueSizeStyles[size])}>{value}</p>

            {change !== undefined && detectedTrend && (
              <div className={cn('flex items-center gap-1 mt-3 font-mono text-[0.72rem] font-medium', detectedTrend === 'up' ? 'text-jade' : detectedTrend === 'down' ? 'text-clay' : 'text-tawf-muted')}>
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
            <div className={cn('grid size-10 place-items-center rounded-xl', bgStyles[color])}>
              {icon}
            </div>
          )}
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';
