import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'green' | 'gold' | 'blue' | 'purple';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      max = 100,
      size = 'md',
      color = 'green',
      showLabel = false,
      label,
      animated = false,
      className,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    // Truncate, never round up: 0.62% reads 0.6%, and only a full bar reads 100%.
    const pctLabel =
      percentage >= 100 ? '100' : percentage < 10 ? (Math.floor(percentage * 10) / 10).toFixed(1) : String(Math.floor(percentage));

    const sizeStyles = {
      sm: 'h-1.5',
      md: 'h-2.5',
      lg: 'h-3',
    };

    const colorStyles = {
      green: 'bg-jade',
      gold: 'bg-honey',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
    };

    const bgStyles = {
      green: 'bg-glaze',
      gold: 'bg-butter/60',
      blue: 'bg-blue-100',
      purple: 'bg-purple-100',
    };

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {(showLabel || label) && (
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-tawf-muted">{label || 'Progress'}</span>
            <span className="font-mono text-xs font-medium text-ink tabular-nums">{pctLabel}%</span>
          </div>
        )}
        <div className={cn('w-full rounded-full overflow-hidden', bgStyles[color], sizeStyles[size])}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              colorStyles[color],
              animated && 'animate-pulse'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';
