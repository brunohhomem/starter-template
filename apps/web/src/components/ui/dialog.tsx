'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />;
}

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
};

export function DialogContent({
  className,
  title,
  description,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-4 shadow-lg sm:w-[28rem]',
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="inline-flex size-11 items-center justify-center rounded-md hover:bg-accent">
            <X className="size-5" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        </div>
        {description ? (
          <DialogPrimitive.Description className="mb-4 text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
