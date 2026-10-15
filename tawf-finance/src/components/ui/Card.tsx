import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'sand' | 'glass';
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', hover = false, className, ...props }, ref) => {
    const baseStyles = 'rounded-2xl border transition-[box-shadow,border-color] duration-300';

    const variantStyles = {
      default: 'bg-white border-line',
      sand: 'bg-glaze/50 border-line',
      glass: 'bg-white/75 backdrop-blur-md border-white/60',
    };

    const hoverStyles = hover ? 'hover:shadow-lift hover:border-glaze-deep' : '';

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
