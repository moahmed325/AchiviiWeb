import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cx } from './cx';

export interface TextLinkProps extends React.ComponentProps<'a'> {
  /** Renders the single child (a router Link, or a `<button type="button">` for in-page actions) with link styling. */
  asChild?: boolean;
}

/**
 * An inline text link, for example "Already have an account? Sign in". Inline links inside a sentence are exempt from
 * the 44px target rule; a standalone action should be a Button instead.
 */
export const TextLink: React.FC<TextLinkProps> = ({ asChild = false, className, ...rest }) => {
  const Comp: React.ElementType = asChild ? Slot : 'a';
  return (
    <Comp
      className={cx(
        'focus-ring cursor-pointer rounded-block font-medium text-accent-hover underline decoration-accent-hover/40 underline-offset-4',
        'transition-[color,text-decoration-color] duration-(--duration-quick) hover:decoration-current',
        'in-[.on-inverse]:text-accent-on-inverse in-[.on-inverse]:decoration-accent-on-inverse/40',
        className,
      )}
      {...rest}
    />
  );
};
