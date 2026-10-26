import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'ok' | 'warn';
};

const TONE_CLASS = {
  neutral: 'bg-secondary text-secondary-foreground',
  ok: 'bg-primary text-primary-foreground',
  warn: 'bg-muted text-muted-foreground',
} as const;

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-md px-2 text-xs font-medium',
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    />
  );
}
