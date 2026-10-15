import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'indigo' | 'teal';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'default', size = 'sm', className, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap';

    const variantStyles = {
      default: 'bg-glaze text-ink',
      success: 'bg-[#DDEFE6] text-jade-deep',
      warning: 'bg-[#F6EBCB] text-[#6E4E0E]',
      error: 'bg-[#F6E1DC] text-clay',
      info: 'bg-[#E0EAF2] text-[#1E4A6B]',
      purple: 'bg-[#ECE6F2] text-[#4F3A6E]',
      indigo: 'bg-[#E3E6F3] text-[#2E3A75]',
      teal: 'bg-[#DBEFEC] text-[#1A5C55]',
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
