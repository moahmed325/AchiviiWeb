import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UpNextSkill } from './UpNextSkill';

const auth = vi.hoisted(() => ({ upNextSkill: null as string | null, set: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({
  useAuthUser: () => ({ id: 'u1', email: 'a@b.c', upNextSkill: auth.upNextSkill }),
  useSetUpNextSkill: () => auth.set,
  useAuthToken: () => 't',
}));
vi.mock('../../hooks/useAccess', () => ({ useAccess: () => ({ state: 'pro', trialEndsAt: null, reload: vi.fn() }) }));
vi.mock('../../lib/api', () => ({ startProCheckout: vi.fn() }));

const renderIt = () =>
  render(
    <MemoryRouter>
      <ol>
        <UpNextSkill goalTitle="Build & Ship a SaaS Web App" />
      </ol>
    </MemoryRouter>,
  );

describe('UpNextSkill (ND-39)', () => {
  beforeEach(() => {
    auth.upNextSkill = null;
    auth.set.mockReset().mockResolvedValue(undefined);
  });

  it('names the skill up next and removes it', async () => {
    auth.upNextSkill = 'run10k';
    renderIt();
    expect(screen.getByRole('heading', { name: 'Up next · Run a 10K Under 50 Minutes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Run a 10K Under 50 Minutes' }));
    expect(auth.set).toHaveBeenCalledWith(null);
  });

  it('with nothing up next, opens Skills to add one', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: 'Add a skill' }));
    expect(await screen.findByRole('dialog', { name: 'Skills' })).toBeInTheDocument();
  });
});
