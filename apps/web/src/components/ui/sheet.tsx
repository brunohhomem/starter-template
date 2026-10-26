'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Sheet(props: ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

export function SheetTrigger(props: ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />;
}

type SheetContentProps = ComponentProps<typeof Dialog.Content> & {
  title: string;
};

export function SheetContent({ className, title, children, ...props }: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
      <Dialog.Content
        className={cn(
          'motion-pop fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-4 border-r border-border bg-background p-4 shadow-lg transition-transform',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-3">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-md hover:bg-accent">
            <X className="size-5" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
