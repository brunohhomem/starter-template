import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-11 w-16 shrink-0 items-center rounded-full border border-input bg-muted data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-7 translate-x-1 rounded-full bg-background shadow-sm transition-transform data-[state=checked]:translate-x-8" />
    </SwitchPrimitive.Root>
  );
}
