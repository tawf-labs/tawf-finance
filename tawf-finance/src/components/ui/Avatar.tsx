import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'square';
  status?: 'online' | 'offline' | 'away' | 'busy';
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, name, size = 'md', variant = 'circle', status, className, ...props }, ref) => {
    const sizeStyles = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
    };

    const statusSizeStyles = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-3.5 h-3.5',
    };

    const statusColors = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-yellow-500',
      busy: 'bg-red-500',
    };

    // Get initials from name
    const getInitials = (name?: string) => {
      if (!name) return '?';
      const parts = name.trim().split(' ');
      if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
      }
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    return (
      <div
        ref={ref}
        className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
        {...props}
      >
        <div
          className={cn(
            'font-medium rounded-full overflow-hidden bg-tawf-green text-tawf-sand flex items-center justify-center',
            sizeStyles[size],
            variant === 'square' && 'rounded-xl'
          )}
        >
          {src ? (
            <img src={src} alt={alt || name || 'Avatar'} className="w-full h-full object-cover" />
          ) : (
            <span>{getInitials(name)}</span>
          )}
        </div>

        {status && (
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white',
              statusSizeStyles[size],
              statusColors[status]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
