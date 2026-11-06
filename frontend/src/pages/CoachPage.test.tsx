import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Goal } from '../types';
import type { CoachState } from '../lib/api';

const api = vi.hoisted(() => ({ fetchCoach: vi.fn(), sendCoachMessage: vi.fn() }));
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), ...api }));
vi.mock('../context/AuthContext', () => ({ useAuthToken: () => 't', useFirstName: () => ({ firstName: 'Mo' }), useAuth: () => ({ token: 't' }) }));
vi.mock('../context/GoalContext', () => ({ useGoal: () => ({ activeGoal: { id: 'g', rawGoal: 'Run a 10K', currentWeek: 3, totalWeeks: 12 } as Goal }) }));
vi.mock('../components/billing', () => ({ ProCheckout: () => <p>Pro checkout</p> }));

import { CoachPage } from './CoachPage';
import { ApiError } from '../lib/api';

const ON: CoachState = { enabled: true, hasGoal: true, access: 'ok', messages: [], remainingToday: 30, dailyLimit: 30 };
const msg = (id: string, role: 'user' | 'coach', content: string) => ({ id, role, content, createdAt: '2026-11-05T10:00:00.000Z' });
const renderPage = () => render(<MemoryRouter><CoachPage /></MemoryRouter>);

beforeEach(() => {
  api.fetchCoach.mockReset().mockResolvedValue(ON);
  api.sendCoachMessage.mockReset();
});

describe('Coach (ND-41)', () => {
  it('says it knows the plan, greets by name and offers ways to start', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /Coach/ })).toBeInTheDocument();
    expect(screen.getByText('Knows your plan: Run a 10K · Week 3 of 12')).toBeInTheDocument();
    expect(await screen.findByText(/^Hi Mo\./)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Ways to start' })).getAllByRole('button')).toHaveLength(4);
  });

  it('sends with Enter, shows the question at once, then the reply; the box clears', async () => {
    let answer!: (value: unknown) => void;
    api.sendCoachMessage.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderPage();
    const box = await screen.findByRole('textbox', { name: 'Message Coach' });
    await userEvent.type(box, 'What now?{Enter}');
    expect(api.sendCoachMessage).toHaveBeenCalledWith('t', 'What now?', 'Mo');
    expect(screen.getByText('What now?')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Coach is writing');
    expect(box).toHaveValue('');
    answer({ messages: [msg('1', 'user', 'What now?'), msg('2', 'coach', 'Do today’s easy run.')], remainingToday: 29 });
    expect(await screen.findByText('Do today’s easy run.')).toBeInTheDocument();
    expect(screen.queryByText('Coach is writing')).toBeNull();
  });

  it('a starter sends itself; Shift+Enter adds a line instead of sending', async () => {
    api.sendCoachMessage.mockResolvedValue({ messages: [], remainingToday: 29 });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'How am I doing so far?' }));
    expect(api.sendCoachMessage).toHaveBeenCalledWith('t', 'How am I doing so far?', 'Mo');
    const box = screen.getByRole('textbox', { name: 'Message Coach' });
    await userEvent.type(box, 'one{Shift>}{Enter}{/Shift}two');
    expect(box).toHaveValue('one\ntwo');
    expect(api.sendCoachMessage).toHaveBeenCalledTimes(1);
  });

  it('a failed send keeps the text and says to try again', async () => {
    api.sendCoachMessage.mockRejectedValue(new ApiError('boom', 503, 'coach_unavailable'));
    renderPage();
    const box = await screen.findByRole('textbox', { name: 'Message Coach' });
    await userEvent.type(box, 'Hello{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent("Coach couldn't answer just now. Please try again.");
    expect(box).toHaveValue('Hello');
  });

  it('shows the conversation, oldest first, with who said what', async () => {
    api.fetchCoach.mockResolvedValue({ ...ON, messages: [msg('1', 'user', 'Hi'), msg('2', 'coach', 'Hello Mo')] });
    renderPage();
    const items = within(await screen.findByRole('list')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('You said:Hi');
    expect(items[1]).toHaveTextContent('Coach said:Hello Mo');
  });

  it('a trial that ended keeps the conversation readable and offers Go Pro instead of the box', async () => {
    api.fetchCoach.mockResolvedValue({ ...ON, access: 'locked', messages: [msg('1', 'coach', 'Earlier advice')] });
    renderPage();
    expect(await screen.findByText('Earlier advice')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Go Pro' }));
    expect(await screen.findByText('Pro checkout')).toBeInTheDocument();
  });

  it('out of messages today: says when Coach is back, no box', async () => {
    api.fetchCoach.mockResolvedValue({ ...ON, remainingToday: 0 });
    renderPage();
    expect(await screen.findByText("That's 30 messages today. Coach is back tomorrow.")).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('switched off: an honest coming soon, no box', async () => {
    api.fetchCoach.mockResolvedValue({ ...ON, enabled: false });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'A coach that knows your plan' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('without a plan: Start a goal', async () => {
    api.fetchCoach.mockResolvedValue({ ...ON, hasGoal: false });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Start a goal' })).toHaveAttribute('href', '/onboarding');
  });

  it('a load that fails offers Try again', async () => {
    api.fetchCoach.mockRejectedValueOnce(new Error('down')).mockResolvedValue(ON);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/^Hi Mo\./)).toBeInTheDocument();
  });
});
