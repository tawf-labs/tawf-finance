import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-full font-medium uppercase tracking-wide transition-all duration-300';

    const variantStyles = {
      primary: 'bg-tawf-green text-tawf-sand hover:bg-tawf-green-light hover:shadow-lg',
      secondary: 'border border-tawf-green text-tawf-green hover:bg-tawf-green hover:text-tawf-sand',
      ghost: 'bg-transparent text-tawf-green hover:bg-tawf-green-10',
    };

    const sizeStyles = {
      sm: 'px-4 py-2 text-xs',
      md: 'px-8 py-4 text-sm',
      lg: 'px-10 py-5 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
