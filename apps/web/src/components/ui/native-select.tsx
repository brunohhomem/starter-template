import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
