import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'sand' | 'glass';
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', hover = false, className, ...props }, ref) => {
    const baseStyles = 'rounded-2xl border transition-all duration-300';

    const variantStyles = {
      default: 'bg-white border-tawf-green-10',
      sand: 'bg-tawf-sand-30 border-tawf-green-10',
      glass: 'bg-tawf-sand-50/90 backdrop-blur-sm border-white/20',
    };

    const hoverStyles = hover ? 'hover:shadow-lg hover:border-tawf-green-20' : '';

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], hoverStyles, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
