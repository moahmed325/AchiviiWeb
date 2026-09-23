import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from './Badge';
import { EmptyState } from './States';
import { SkipLink, VisuallyHidden } from './A11y';
import { Surface } from './Surface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
import { TextLink } from './TextLink';

describe('Tabs', () => {
  const renderTabs = () =>
    render(
      <Tabs defaultValue="today">
        <TabsList aria-label="Step detail">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="why">Why it matters</TabsTrigger>
          <TabsTrigger value="later" disabled>
            Later
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today">Draft three titles.</TabsContent>
        <TabsContent value="why">The first 30 seconds matter.</TabsContent>
      </Tabs>,
    );

  it('wires tabs to their panel', () => {
    renderTabs();
    expect(screen.getByRole('tablist', { name: 'Step detail' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Today' })).toHaveTextContent('Draft three titles.');
  });

  it('moves with the arrow keys and skips disabled tabs', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Today' }));
    await userEvent.keyboard('{ArrowRight}');
    const why = screen.getByRole('tab', { name: 'Why it matters' });
    expect(why).toHaveFocus();
    expect(why).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveFocus();
  });
});

describe('Surface', () => {
  it('renders the requested element and marks inverse surfaces', () => {
    render(
      <Surface as="section" tone="inverse" aria-label="Arrival">
        Content
      </Surface>,
    );
    const section = screen.getByRole('region', { name: 'Arrival' });
    expect(section.tagName).toBe('SECTION');
    expect(section).toHaveClass('on-inverse');
  });
});

describe('Badge', () => {
  it('shows its status as text', () => {
    render(<Badge tone="accent">On track</Badge>);
    expect(screen.getByText('On track')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('shows the title, description and one action', () => {
    render(<EmptyState title="No journey yet" description="Pick a pathway to begin." action={<button type="button">Choose a pathway</button>} />);
    expect(screen.getByText('No journey yet')).toBeInTheDocument();
    expect(screen.getByText('Pick a pathway to begin.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a pathway' })).toBeInTheDocument();
  });
});

describe('SkipLink and VisuallyHidden', () => {
  it('links to the main landmark and is the first tab stop', async () => {
    render(
      <>
        <SkipLink />
        <button type="button">Menu</button>
        <main id="main">Content</main>
      </>,
    );
    await userEvent.tab();
    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute('href', '#main');
  });

  it('moves focus to the main landmark without changing the URL', async () => {
    render(
      <>
        <SkipLink />
        <button type="button">Menu</button>
        <main id="main">Content</main>
      </>,
    );
    const before = window.location.href;
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    expect(window.location.href).toBe(before);
  });

  it('keeps hidden text available to assistive tech', () => {
    render(
      <button type="button">
        <svg aria-hidden="true" />
        <VisuallyHidden>Close</VisuallyHidden>
      </button>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('TextLink', () => {
  it('renders a link, or its child with asChild', () => {
    render(
      <>
        <TextLink href="/login">Sign in</TextLink>
        <TextLink asChild>
          <button type="button">Use a different email</button>
        </TextLink>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('button', { name: 'Use a different email' }).className).toContain('underline');
  });
});
