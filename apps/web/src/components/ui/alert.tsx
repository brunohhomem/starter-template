import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn('rounded-md border border-border bg-muted px-3 py-3 text-sm', className)}
      {...props}
    />
  );
}
