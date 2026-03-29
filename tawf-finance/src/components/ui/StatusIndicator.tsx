import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  status: 'online' | 'offline' | 'away' | 'busy' | 'active' | 'inactive' | 'pending';
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dot' | 'pill';
}

export const StatusIndicator = forwardRef<HTMLSpanElement, StatusIndicatorProps>(
  ({ status, showLabel = false, label, size = 'md', variant = 'dot', className, ...props }, ref) => {
    const statusConfig = {
      online: { color: 'bg-green-500', text: 'Online' },
      offline: { color: 'bg-gray-400', text: 'Offline' },
      away: { color: 'bg-yellow-500', text: 'Away' },
      busy: { color: 'bg-red-500', text: 'Busy' },
      active: { color: 'bg-green-500', text: 'Active' },
      inactive: { color: 'bg-gray-400', text: 'Inactive' },
      pending: { color: 'bg-yellow-500', text: 'Pending' },
    };

    const config = statusConfig[status];
    const displayLabel = label || config.text;

    const sizeStyles = {
      sm: variant === 'dot' ? 'w-1.5 h-1.5' : 'w-4 h-4',
      md: variant === 'dot' ? 'w-2 h-2' : 'w-5 h-5',
      lg: variant === 'dot' ? 'w-2.5 h-2.5' : 'w-6 h-6',
    };

    if (variant === 'pill' && showLabel) {
      return (
        <span
          ref={ref}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            status === 'online' || status === 'active' ? 'bg-green-50 text-green-700' :
            status === 'offline' || status === 'inactive' ? 'bg-gray-100 text-gray-600' :
            status === 'away' || status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
            'bg-red-50 text-red-700',
            className
          )}
          {...props}
        >
          <span className={cn('rounded-full', sizeStyles[size], config.color)} />
          {displayLabel}
        </span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn('inline-flex items-center gap-1.5', className)}
        {...props}
      >
        <span className={cn('rounded-full', sizeStyles[size], config.color)} />
        {showLabel && <span className="text-xs text-tawf-muted">{displayLabel}</span>}
      </span>
    );
  }
);

StatusIndicator.displayName = 'StatusIndicator';
