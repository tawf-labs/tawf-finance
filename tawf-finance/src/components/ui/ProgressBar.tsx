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

    const sizeStyles = {
      sm: 'h-1.5',
      md: 'h-2.5',
      lg: 'h-3',
    };

    const colorStyles = {
      green: 'bg-tawf-green',
      gold: 'bg-tawf-gold',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
    };

    const bgStyles = {
      green: 'bg-tawf-green-10',
      gold: 'bg-tawf-gold-10',
      blue: 'bg-blue-100',
      purple: 'bg-purple-100',
    };

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {(showLabel || label) && (
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-tawf-muted">{label || 'Progress'}</span>
            <span className="text-xs font-medium text-tawf-green">{percentage.toFixed(0)}%</span>
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
