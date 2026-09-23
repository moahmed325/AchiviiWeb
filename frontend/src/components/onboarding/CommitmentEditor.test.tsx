import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CommitmentItem } from '../../types';
import { CommitmentEditor } from './CommitmentEditor';
import type { EditingCommitmentSession } from './schedule';

const GYM: CommitmentItem = { id: 'c1', title: 'Gym', time: '18:00 - 19:00', days: ['Mon', 'Wed'] } as CommitmentItem;

const Harness = ({ initial, onSave }: { initial: EditingCommitmentSession; onSave: (item: CommitmentItem) => void }) => {
  const [session, setSession] = useState<EditingCommitmentSession | null>(null);
  return (
    <>
      <button onClick={() => setSession(initial)}>Edit gym</button>
      <CommitmentEditor
        session={session}
        placedCommitments={{}}
        onItemChange={(patch) => setSession((prev) => (prev ? { ...prev, item: { ...prev.item, ...patch } } : null))}
        onSave={(item) => {
          onSave(item);
          setSession(null);
        }}
        onDelete={() => setSession(null)}
        onClose={() => setSession(null)}
      />
    </>
  );
};

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Edit gym' }));
  return screen.findByRole('dialog', { name: 'Edit commitment' });
};

describe('CommitmentEditor', () => {
  it('saves the edited days and time', async () => {
    const onSave = vi.fn();
    render(<Harness initial={{ item: GYM, isNew: false }} onSave={onSave} />);
    await open();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Friday' }));
    await userEvent.click(screen.getAllByRole('button', { name: '15 min later' })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith({ ...GYM, days: ['Mon', 'Wed', 'Fri'], time: '18:00 - 19:15' });
  });

  it('asks for a name instead of saving a blank commitment', async () => {
    const onSave = vi.fn();
    render(<Harness initial={{ item: GYM, isNew: false }} onSave={onSave} />);
    await open();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(name).toHaveFocus();
    expect(name).toHaveAccessibleDescription(/Give it a name/);
    await userEvent.type(name, 'Climbing');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Climbing' }));
  });

  it('Cancel and Escape discard changes and return focus to the opener', async () => {
    const onSave = vi.fn();
    render(<Harness initial={{ item: GYM, isNew: false }} onSave={onSave} />);
    const opener = screen.getByRole('button', { name: 'Edit gym' });
    await open();
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' class');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());

    await open();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Gym');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(onSave).not.toHaveBeenCalled();
  });
});
