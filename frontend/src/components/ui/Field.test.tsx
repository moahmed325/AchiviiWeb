import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, Input, Select, Textarea } from './Field';

describe('Field', () => {
  it('labels its control', () => {
    render(
      <Field label="Email">
        <Input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });

  it('links the hint and error, and marks the control invalid', () => {
    render(
      <Field label="Password" hint="At least 8 characters." error="That password is too short.">
        <Input type="password" />
      </Field>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('At least 8 characters. That password is too short.');
  });

  it('announces an error that appears later', () => {
    const { rerender } = render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).toBeEmptyDOMElement();
    rerender(
      <Field label="Email" error="Enter an email address.">
        <Input />
      </Field>,
    );
    expect(document.querySelector('[aria-live="polite"]')).toBe(region);
    expect(region).toHaveTextContent('Enter an email address.');
  });

  it('renders a trailing control inside the input and keeps the label wiring', () => {
    render(
      <Field label="Password">
        <Input type="password" trailing={<button type="button">Show password</button>} />
      </Field>,
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('is not invalid without an error', () => {
    render(
      <Field label="Name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });

  it('passes required through to the control', () => {
    render(
      <Field label="Goal" required>
        <Textarea />
      </Field>,
    );
    expect(screen.getByLabelText('Goal')).toBeRequired();
  });

  it('labels a native select', () => {
    render(
      <Field label="Time of day">
        <Select defaultValue="evening">
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText('Time of day')).toHaveValue('evening');
  });

  describe('Textarea showCount', () => {
    const Counted = ({ value, maxLength = 100 }: { value: string; maxLength?: number }) => (
      <Field label="Notes">
        <Textarea value={value} onChange={() => {}} maxLength={maxLength} showCount />
      </Field>
    );

    it('shows no count while the text is well under the limit', () => {
      render(<Counted value={'a'.repeat(79)} />);
      expect(screen.getByLabelText('Notes')).toHaveAttribute('maxLength', '100');
      expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
    });

    it('shows the count from 80% of the limit and links it to the control', () => {
      render(<Counted value={'a'.repeat(80)} />);
      expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('80 of 100 characters');
    });

    it('says when the limit is reached', () => {
      render(<Counted value={'a'.repeat(100)} />);
      expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription("100 of 100 characters. That's the limit.");
    });

    it('asks to shorten a saved text that is already over the limit', () => {
      render(<Counted value={'a'.repeat(2500)} maxLength={2000} />);
      expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('2,500 of 2,000 characters. Shorten it to add more.');
    });
  });
});
