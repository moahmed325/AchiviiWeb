import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, IconButton } from './Button';

describe('Button', () => {
  it('is a non-submitting button by default', () => {
    render(<Button>Start</Button>);
    expect(screen.getByRole('button', { name: 'Start' })).toHaveAttribute('type', 'button');
  });

  it('keeps an explicit submit type', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('blocks clicks and announces busy while loading, without leaving the tab order', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Creating
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Creating' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps focus when loading starts', () => {
    const { rerender } = render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    button.focus();
    rerender(<Button loading>Save</Button>);
    expect(button).toHaveFocus();
  });

  it('does not submit its form while loading', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Save
        </Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uses the native disabled attribute when disabled and not loading', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('renders its child element when asChild is set', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/journey">Open journey</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Open journey' });
    expect(link).toHaveAttribute('href', '/journey');
    expect(link.className).toContain('rounded-full');
  });

  it('marks an asChild link disabled and blocks its click', async () => {
    const onClick = vi.fn();
    render(
      <Button asChild disabled onClick={onClick}>
        <a href="#journey">Open journey</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Open journey' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('uses its label as the accessible name', () => {
    render(<IconButton label="Close" icon={<svg aria-hidden="true" />} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('blocks clicks while loading and stays focusable', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Refresh" loading onClick={onClick} icon={<svg aria-hidden="true" />} />);
    const button = screen.getByRole('button', { name: 'Refresh' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
