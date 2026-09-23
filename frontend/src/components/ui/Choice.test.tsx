import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, ChoiceCard, ChoiceGroup, SegmentedControl } from './Choice';

const Budget = ({ onChange }: { onChange: (value: string) => void }) => {
  const [value, setValue] = useState<string | undefined>();
  return (
    <ChoiceGroup
      legend="Daily time"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    >
      <ChoiceCard value="30" title="30 minutes" description="A light, steady pace" />
      <ChoiceCard value="60" title="60 minutes" />
      <ChoiceCard value="90" title="90 minutes" disabled />
    </ChoiceGroup>
  );
};

describe('ChoiceGroup', () => {
  it('exposes a named radio group and selects on click', async () => {
    const onChange = vi.fn();
    render(<Budget onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Daily time' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '30 minutes' })).toHaveAccessibleDescription('A light, steady pace');
    const option = screen.getByRole('radio', { name: '60 minutes' });
    await userEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('60');
    expect(option).toBeChecked();
    expect(screen.getByRole('radio', { name: '90 minutes' })).toBeDisabled();
  });
});

describe('ChoiceGroup errors', () => {
  it('links the error to the group, keeps option names clean and passes required through', () => {
    render(
      <ChoiceGroup legend="Starting point" value={undefined} onChange={() => undefined} required error="Choose where you're starting from.">
        <ChoiceCard value="new" title="Beginner" />
        <ChoiceCard value="some" title="Some experience" />
      </ChoiceGroup>,
    );
    const group = screen.getByRole('group', { name: 'Starting point' });
    expect(group).toHaveAccessibleDescription("Choose where you're starting from.");
    const option = screen.getByRole('radio', { name: 'Beginner' });
    expect(option).toBeRequired();
    expect(screen.getByText("Choose where you're starting from.").closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('moves between options with the arrow keys', async () => {
    render(<Budget onChange={() => undefined} />);
    await userEvent.click(screen.getByRole('radio', { name: '30 minutes' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: '60 minutes' })).toBeChecked();
  });
});

describe('SegmentedControl', () => {
  it('selects one option', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        legend="Slot"
        value="morning"
        onChange={onChange}
        options={[
          { value: 'morning', label: 'Morning' },
          { value: 'evening', label: 'Evening' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Morning' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Evening' }));
    expect(onChange).toHaveBeenCalledWith('evening');
  });

  it('links its error to the group', () => {
    render(
      <SegmentedControl
        legend="Length"
        value={undefined}
        onChange={() => undefined}
        error="Choose a session length."
        options={[{ value: '30', label: '30 min' }]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Length' })).toHaveAccessibleDescription('Choose a session length.');
  });
});

describe('Checkbox', () => {
  it('toggles and carries its description', async () => {
    render(<Checkbox label="Include weekends" description="Sessions can be planned on Saturday and Sunday." />);
    const box = screen.getByRole('checkbox', { name: 'Include weekends' });
    expect(box).toHaveAccessibleDescription('Sessions can be planned on Saturday and Sunday.');
    await userEvent.click(box);
    expect(box).toBeChecked();
  });

  it('is marked invalid with its error in the description', () => {
    render(<Checkbox label="I understand" error="Confirm this to continue." />);
    const box = screen.getByRole('checkbox', { name: 'I understand' });
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Confirm this to continue.');
  });
});
