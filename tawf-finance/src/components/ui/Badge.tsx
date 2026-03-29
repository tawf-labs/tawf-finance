import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'indigo' | 'teal';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'default', size = 'sm', className, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center gap-1.5 rounded-full font-medium';

    const variantStyles = {
      default: 'bg-tawf-green-10 text-tawf-green',
      success: 'bg-green-50 text-green-700',
      warning: 'bg-yellow-50 text-yellow-700',
      error: 'bg-red-50 text-red-700',
      info: 'bg-blue-50 text-blue-700',
      purple: 'bg-purple-50 text-purple-700',
      indigo: 'bg-indigo-50 text-indigo-700',
      teal: 'bg-teal-50 text-teal-700',
    };

    const sizeStyles = {
      sm: 'px-2.5 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
