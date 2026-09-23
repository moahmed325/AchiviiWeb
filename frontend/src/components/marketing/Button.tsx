import React from 'react';
import { ArrowRight } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'md' | 'lg';

const base =
  'group inline-flex items-center justify-center gap-2.5 rounded-full font-medium tracking-[-0.01em] whitespace-nowrap ' +
  'transition-[background-color,border-color,color,transform] duration-300 ease-[var(--ease-ascend)] ' +
  'active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

const variants: Record<Variant, string> = {
  primary: 'bg-text text-background hover:bg-white',
  secondary: 'border border-border-strong text-text hover:border-text/40 hover:bg-text/[0.04]',
  quiet: 'text-text-secondary hover:text-text',
};

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-5 text-[15px]',
  lg: 'min-h-13 px-7 text-base',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  withArrow?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };
type AnchorProps = CommonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { href: string };

export const Button: React.FC<ButtonProps | AnchorProps> = ({
  variant = 'primary',
  size = 'md',
  withArrow = false,
  className = '',
  children,
  ...rest
}) => {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  const content = (
    <>
      <span>{children}</span>
      {withArrow && (
        <ArrowRight
          aria-hidden="true"
          strokeWidth={1.75}
          className="w-4 h-4 transition-transform duration-300 ease-[var(--ease-ascend)] group-hover:translate-x-0.5"
        />
      )}
    </>
  );

  if (typeof rest.href === 'string') {
    return (
      <a className={classes} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
};
