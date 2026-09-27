import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewTestResultStep } from './ReviewTestResultStep';
import type { WeekTarget, WeekTest, WeeklyTestResult } from '../../types';

describe('ReviewTestResultStep Component (Milestone M7.5 — OD-1a Benchmark Entry)', () => {
  const sampleTarget: WeekTarget = {
    kind: 'number',
    metric: 'Touch Typing Speed',
    value: 40,
    unit: 'wpm',
    direction: 'higher_is_better',
  };

  const sampleTest: WeekTest = {
    type: 'typing_test',
    instructions: '1-minute typing test on Aesop fables',
    passIf: '40 wpm with 95% accuracy',
  };

  it('renders nothing when neither target nor test is provided', () => {
    const { container } = render(
      <ReviewTestResultStep
        target={null}
        test={null}
        testResult={null}
        onChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders benchmark instructions, pass criteria, and target deliverable', () => {
    render(
      <ReviewTestResultStep
        target={sampleTarget}
        test={sampleTest}
        testResult={null}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Weekly Benchmark')).toBeVisible();
    expect(screen.getByText('1-minute typing test on Aesop fables')).toBeVisible();
    expect(screen.getByText('Pass if 40 wpm with 95% accuracy.')).toBeVisible();
    expect(screen.getByText('Target Deliverable')).toBeVisible();
    expect(screen.getByText('Touch Typing Speed: 40 wpm')).toBeVisible();
    expect(screen.getByLabelText('Your result')).toBeVisible();
    expect(screen.getByRole('button', { name: /Met target/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /In progress/i })).toBeVisible();
  });

  it('calls onChange with entered value and default unit in a controlled wrapper', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const StatefulWrapper = () => {
      const [res, setRes] = useState<WeeklyTestResult | null>(null);
      return (
        <ReviewTestResultStep
          target={sampleTarget}
          test={sampleTest}
          testResult={res}
          onChange={(val) => {
            onChange(val);
            setRes(val);
          }}
        />
      );
    };

    render(<StatefulWrapper />);

    const input = screen.getByLabelText('Your result');
    await user.type(input, '45');

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toMatchObject({
      value: 45,
      unit: 'wpm',
      passed: true,
    });
  });

  it('renders honest comparison summary and allows toggling outcome', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const currentResult: WeeklyTestResult = {
      value: 35,
      unit: 'wpm',
      passed: false,
      note: 'Need to practice pinky keys',
    };

    render(
      <ReviewTestResultStep
        target={sampleTarget}
        test={sampleTest}
        testResult={currentResult}
        onChange={onChange}
      />
    );

    const summary = screen.getByTestId('target-comparison-summary');
    expect(summary).toBeVisible();
    expect(screen.getByText('In Progress')).toBeVisible();
    expect(screen.getByText(/Adapt the journey, don’t punish the person/i)).toBeVisible();

    // Toggle to Met target
    const metButton = screen.getByRole('button', { name: /Met target/i });
    await user.click(metButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 35,
        unit: 'wpm',
        passed: true,
      })
    );
  });

  it('allows clearing benchmark result back to null', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const currentResult: WeeklyTestResult = {
      value: 45,
      unit: 'wpm',
      passed: true,
    };

    render(
      <ReviewTestResultStep
        target={sampleTarget}
        test={sampleTest}
        testResult={currentResult}
        onChange={onChange}
      />
    );

    const clearButton = screen.getByRole('button', { name: /Clear benchmark entry/i });
    await user.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
