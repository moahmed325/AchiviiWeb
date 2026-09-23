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
});
