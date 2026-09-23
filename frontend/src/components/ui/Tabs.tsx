import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cx } from './cx';

/* Radix provides roving focus, arrow-key navigation and the tab/tabpanel ARIA wiring. */
export const Tabs = TabsPrimitive.Root;

export const TabsList: React.FC<React.ComponentProps<typeof TabsPrimitive.List>> = ({ className, ...props }) => (
  <TabsPrimitive.List
    className={cx('flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    {...props}
  />
);

export const TabsTrigger: React.FC<React.ComponentProps<typeof TabsPrimitive.Trigger>> = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    className={cx(
      'focus-ring-inset relative -mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 text-small font-medium text-text-secondary',
      'transition-colors duration-(--duration-quick) hover:text-text',
      'data-[state=active]:border-accent data-[state=active]:text-text',
      'disabled:cursor-not-allowed disabled:opacity-45',
      className,
    )}
    {...props}
  />
);

export const TabsContent: React.FC<React.ComponentProps<typeof TabsPrimitive.Content>> = ({ className, ...props }) => (
  <TabsPrimitive.Content className={cx('focus-ring pt-6', className)} {...props} />
);
