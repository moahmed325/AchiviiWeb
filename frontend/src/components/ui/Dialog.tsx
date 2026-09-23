import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cx } from './cx';

/* Radix provides the focus trap, Escape to close, scroll lock, inert background and focus restore. */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogLayout = 'auto' | 'sheet';
export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogContentProps extends Omit<React.ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Keeps the title for screen readers but hides it visually. */
  hideTitle?: boolean;
  /** 'auto': bottom sheet below 768px (md), centred dialog above. 'sheet': bottom sheet at every size. */
  layout?: DialogLayout;
  size?: DialogSize;
  /** Actions in desktop order (secondary first, primary last): right-aligned on desktop, stacked full-width with the primary on top on mobile. */
  footer?: React.ReactNode;
  hideClose?: boolean;
  closeLabel?: string;
}

const mobileSheet =
  'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-panel border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] ' +
  'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out';

const desktopDialog =
  'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100%-3rem)] md:-translate-x-1/2 md:-translate-y-1/2 ' +
  'md:max-h-[85dvh] md:rounded-panel md:border md:pb-0 ' +
  'md:data-[state=open]:animate-dialog-in md:data-[state=closed]:animate-dialog-out';

const desktopSheet = 'md:inset-x-auto md:left-1/2 md:w-full md:-translate-x-1/2';

const sizes: Record<DialogSize, string> = {
  sm: 'md:max-w-md',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
};

export const DialogContent: React.FC<DialogContentProps> = ({
  title,
  description,
  hideTitle = false,
  layout = 'auto',
  size = 'md',
  footer,
  hideClose = false,
  closeLabel = 'Close',
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...rest
}) => {
  // Radix returns focus to a DialogTrigger. A dialog opened from state has none, so return focus to whatever
  // was focused when it opened, if that element still exists.
  const returnFocus = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <DialogPrimitive.Content
        {...rest}
        onOpenAutoFocus={(event) => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const target = returnFocus.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
        {...(description ? {} : { 'aria-describedby': rest['aria-describedby'] })}
        className={cx(
          'ui-root fixed z-50 flex flex-col border border-border-strong bg-surface-elevated text-text shadow-overlay outline-none',
          mobileSheet,
          layout === 'auto' ? desktopDialog : desktopSheet,
          sizes[size],
          className,
        )}
      >
        <div className="flex items-start gap-4 px-6 pb-4 pt-6 md:px-7 md:pt-7">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className={hideTitle ? 'sr-only' : 'text-h3 text-text'}>{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-2 text-small text-text-secondary">{description}</DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && (
            <DialogPrimitive.Close asChild>
              <IconButton label={closeLabel} icon={<X aria-hidden="true" strokeWidth={1.5} className="size-5" />} className="-mr-2 -mt-2" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 md:px-7 md:pb-7">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-4 md:flex-row md:justify-end md:px-7">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

/** A bottom sheet at every size. Same API as DialogContent. */
export const SheetContent: React.FC<Omit<DialogContentProps, 'layout'>> = (props) => <DialogContent {...props} layout="sheet" />;
