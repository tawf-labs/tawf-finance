import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background,box-shadow,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

    const variantStyles = {
      primary: 'bg-ink text-white hover:bg-jade',
      secondary: 'bg-white text-ink ring-1 ring-line hover:ring-ink/40',
      ghost: 'bg-transparent text-ink hover:bg-glaze',
    };

    const sizeStyles = {
      sm: 'min-h-9 px-4 text-xs',
      md: 'min-h-11 px-6 text-sm',
      lg: 'min-h-13 px-8 text-base',
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
