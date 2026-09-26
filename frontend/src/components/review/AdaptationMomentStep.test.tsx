import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdaptationMomentStep } from './AdaptationMomentStep';
import type { DailyTask, WeekTarget } from '../../types';
import type { MilestoneGateTransition } from '../today/MilestoneGateModal';

describe('AdaptationMomentStep Component (M7.3)', () => {
  const sampleTasks: DailyTask[] = [
    {
      id: 't-w2-1',
      goalId: 'g-1',
      weekNumber: 2,
      dayNumber: 8,
      date: '2026-10-01',
      dayOfWeek: 'Monday',
      title: 'Tempo intervals',
      status: 'pending',
      durationMinutes: 45,
      isRestDay: false,
      slotTime: '08:00',
      created_at: '',
    } as DailyTask,
    {
      id: 't-w2-2',
      goalId: 'g-1',
      weekNumber: 2,
      dayNumber: 9,
      date: '2026-10-02',
      dayOfWeek: 'Tuesday',
      title: 'Recovery run',
      status: 'pending',
      durationMinutes: 30,
      isRestDay: false,
      slotTime: '08:00',
      created_at: '',
    } as DailyTask,
  ];

  const sampleTarget: WeekTarget = {
    kind: 'deliverable',
    description: 'Record 5K benchmark run',
  };

  it('renders path adapted heading, next week number, and focus theme', () => {
    const onContinue = vi.fn();

    render(
      <AdaptationMomentStep
        currentWeekNumber={1}
        nextWeekNumber={2}
        aiAdaptationInsight="5 of 6 sessions done."
        nextWeekTasks={sampleTasks}
        nextWeekTheme="Cardio Acceleration"
        nextWeekTarget={sampleTarget}
        onContinue={onContinue}
      />
    );

    expect(screen.getByText('Week 1 Complete')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Week 2 has been adapted' })).toBeVisible();
    expect(
      screen.getByText("Next week's practice sessions have been generated from your actual pace and reflection.")
    ).toBeVisible();
    expect(screen.getByText('Focus')).toBeVisible();
    expect(screen.getByText('Cardio Acceleration')).toBeVisible();
    expect(screen.getByText('Target')).toBeVisible();
    expect(screen.getByText('Record 5K benchmark run')).toBeVisible();
    expect(screen.getByText('2 practice sessions planned')).toBeVisible();
  });

  it('displays the genuine server aiAdaptationInsight without fabricated reasoning', () => {
    const onContinue = vi.fn();
    const insightText = 'Pacing sustained at 5:15/km. Volume increased safely by 10%.';

    render(
      <AdaptationMomentStep
        currentWeekNumber={1}
        nextWeekNumber={2}
        aiAdaptationInsight={insightText}
        onContinue={onContinue}
      />
    );

    expect(screen.getByText('Adaptation Insight')).toBeVisible();
    expect(screen.getByText(insightText)).toBeVisible();
  });

  it('renders canonical BP §18 non-punitive language when milestone benchmark is not met', () => {
    const onContinue = vi.fn();
    const gate: MilestoneGateTransition = {
      title: 'Foundation Review',
      completedPhase: 'Foundation',
      nextPhase: 'Acceleration',
      benchmarkMet: false,
    };

    render(
      <AdaptationMomentStep
        currentWeekNumber={4}
        nextWeekNumber={5}
        aiAdaptationInsight="3 of 6 sessions completed."
        milestoneGateTransition={gate}
        onContinue={onContinue}
      />
    );

    // Canonical BP §18 phrase
    expect(
      screen.getByText('Your current results suggest we should reinforce this phase.')
    ).toBeVisible();
    expect(
      screen.getByText(
        'The path has adapted to give you space to consolidate your fundamentals before advancing.'
      )
    ).toBeVisible();
    expect(screen.getByText('Foundation Review')).toBeVisible();
    expect(screen.getByText('Phase Consolidation')).toBeVisible();

    // Must never contain shame or failure wording
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/punish/i)).not.toBeInTheDocument();
  });

  it('renders serene graduation copy when milestone benchmark is met', () => {
    const onContinue = vi.fn();
    const gate: MilestoneGateTransition = {
      title: 'Foundation Complete',
      completedPhase: 'Foundation',
      nextPhase: 'Acceleration',
      benchmarkMet: true,
    };

    render(
      <AdaptationMomentStep
        currentWeekNumber={4}
        nextWeekNumber={5}
        aiAdaptationInsight="6 of 6 sessions completed with strong consistency."
        milestoneGateTransition={gate}
        onContinue={onContinue}
      />
    );

    expect(screen.getByText('Foundation Complete')).toBeVisible();
    expect(screen.getByText('Milestone Achieved')).toBeVisible();
    expect(
      screen.getByText(/You've built strong consistency across this phase and unlocked/i)
    ).toBeVisible();
    expect(screen.getByText('Acceleration')).toBeVisible();
  });

  it('renders closing stretch copy when nextWeekNumber is null (week 12 completion)', () => {
    const onContinue = vi.fn();

    render(
      <AdaptationMomentStep
        currentWeekNumber={12}
        nextWeekNumber={null}
        aiAdaptationInsight="All 12 weeks complete. Ready for final summit."
        onContinue={onContinue}
      />
    );

    expect(screen.getByText('Journey Milestone')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Your closing stretch is ready' })).toBeVisible();
    expect(
      screen.getByText('You have completed the 12 planned weeks. Welcome to the Closing Stretch.')
    ).toBeVisible();
  });

  it('fires onContinue callback when "Continue to Today" is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(
      <AdaptationMomentStep
        currentWeekNumber={1}
        nextWeekNumber={2}
        aiAdaptationInsight="5 of 6 done."
        onContinue={onContinue}
      />
    );

    const continueBtn = screen.getByRole('button', { name: 'Continue to Today' });
    await user.click(continueBtn);

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
