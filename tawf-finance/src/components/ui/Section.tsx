import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  containerClassName?: string;
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  ({ children, className, containerClassName, ...props }, ref) => {
    return (
      <section ref={ref} className={cn('section-padding', className)} {...props}>
        <div className={cn('section-container', containerClassName)}>
          {children}
        </div>
      </section>
    );
  }
);

Section.displayName = 'Section';
