import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Goal } from '../../types';
import { AchievementScreen } from './AchievementScreen';

const mockGoal: Goal = {
  id: 'goal-achieve-100',
  userId: 'usr-1',
  rawGoal: 'Run a sub-45 10k',
  clarifiedOutcome: 'Run 10 kilometers under 45 minutes with steady pacing',
  methodologyNotes: 'Jack Daniels VDOT Formula for distance runners',
  canonicalMethodName: 'VDOT Running Formula',
  canonicalAuthority: 'Jack Daniels',
  status: 'completed',
  startDate: '2026-06-01',
  targetDate: '2026-08-30',
  currentWeek: 12,
  answers: '{}',
  routine: '{}',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-08-30T10:00:00Z',
  completedAt: '2026-08-30T10:00:00Z',
  roadmap: {
    finalGoal: 'Run 10 kilometers under 45 minutes',
    finalTest: 'Run 10k test on official flat course',
    startingPoint: { value: 52, description: '52 minute 10k' },
    method: {
      name: 'VDOT Running Formula',
      creator: 'Jack Daniels',
      summary: 'Scientifically validated VO2 max pacing',
      whyChosen: 'Optimal for progressive aerobic threshold development',
      runnerUp: null,
      safety: 5,
      rules: ['Never increase weekly volume by more than 10%'],
    },
    phases: [
      { name: 'Aerobic Foundation', startWeek: 1, endWeek: 4, purpose: 'Build aerobic base and running economy.' },
      { name: 'Threshold Density', startWeek: 5, endWeek: 8, purpose: 'Develop lactate threshold and cruising speed.' },
      { name: 'Pace Mastery', startWeek: 9, endWeek: 12, purpose: 'Sharpen race pace cadence and finish closing stretch.' },
    ],
  },
  roadmapWeeks: [
    {
      id: 'rw-4',
      goalId: 'goal-achieve-100',
      weekNumber: 4,
      theme: 'Phase 1 Aerobic Benchmark',
      phase: 'Aerobic Foundation',
      status: 'completed',
      objective: 'Build aerobic base',
      keyMilestone: 'Consistent sub-threshold pacing',
      targetIntensity: 3,
      plannedMinutes: 200,
      test: {
        type: 'timer',
        instructions: 'Run 5k at continuous threshold pace',
        passIf: 'Under 22:30',
      },
      testResult: {
        value: '22:15',
        passed: true,
        unit: 'mm:ss',
        note: 'Paced evenly',
      },
      created_at: '2026-06-01T00:00:00Z',
    },
    {
      id: 'rw-12',
      goalId: 'goal-achieve-100',
      weekNumber: 12,
      theme: 'Phase 3 Capstone Verification',
      phase: 'Pace Mastery',
      status: 'completed',
      objective: 'Execute sub-45 10k',
      keyMilestone: 'Official sub-45 arrival',
      targetIntensity: 5,
      plannedMinutes: 240,
      target: {
        kind: 'number',
        metric: '10k Race Time',
        value: 45,
        unit: 'min',
        direction: 'lower_is_better',
      },
      test: {
        type: 'timer',
        instructions: 'Official 10k timed time-trial on certified course',
        passIf: 'Sub-45:00',
      },
      testResult: {
        value: '44:12',
        passed: true,
        unit: 'mm:ss',
        note: 'Personal best recorded on cool morning',
      },
      created_at: '2026-06-01T00:00:00Z',
    },
  ],
  dailyTasks: [
    { id: 't1', goalId: 'goal-achieve-100', weekNumber: 1, dayNumber: 1, date: '2026-06-01', dayOfWeek: 'Monday', title: 'Easy Aerobic Run', durationMinutes: 45, isRestDay: false, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
    { id: 't2', goalId: 'goal-achieve-100', weekNumber: 1, dayNumber: 2, date: '2026-06-02', dayOfWeek: 'Tuesday', title: 'Rest & Mobility', durationMinutes: 0, isRestDay: true, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
    { id: 't3', goalId: 'goal-achieve-100', weekNumber: 1, dayNumber: 3, date: '2026-06-03', dayOfWeek: 'Wednesday', title: 'Threshold Intervals', durationMinutes: 50, isRestDay: false, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
    { id: 't4', goalId: 'goal-achieve-100', weekNumber: 1, dayNumber: 4, date: '2026-06-04', dayOfWeek: 'Thursday', title: 'Recovery Walk', durationMinutes: 0, isRestDay: true, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
    { id: 't5', goalId: 'goal-achieve-100', weekNumber: 1, dayNumber: 5, date: '2026-06-05', dayOfWeek: 'Friday', title: 'Tempo Run', durationMinutes: 40, isRestDay: false, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
    { id: 't6', goalId: 'goal-achieve-100', weekNumber: 1, dayNumber: 6, date: '2026-06-06', dayOfWeek: 'Saturday', title: 'Long Aerobic Run', durationMinutes: 75, isRestDay: false, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
    { id: 't7', goalId: 'goal-achieve-100', weekNumber: 1, dayNumber: 7, date: '2026-06-07', dayOfWeek: 'Sunday', title: 'Rest Day', durationMinutes: 0, isRestDay: true, status: 'completed', slotTime: 'morning', detailedSteps: '[]', implementationIntention: '', created_at: '' },
  ],
  weeklyReviews: [
    {
      id: 'rev-12',
      goalId: 'goal-achieve-100',
      weekNumber: 12,
      tasksPlanned: 4,
      tasksCompleted: 4,
      scorePercentage: 100,
      reflection: 'The ninety days transformed how I train. Consistent daily action compounded beyond what I imagined.',
      aiAdaptationInsight: 'Outstanding execution.',
      created_at: '2026-08-30T10:00:00Z',
    },
  ],
};

describe('AchievementScreen Component (Visual Level 4 — M9.3)', () => {
  it('1. Renders the Arrival Hero faithfully with BP §34 monumental typography and garden asset', () => {
    render(
      <MemoryRouter>
        <AchievementScreen goal={mockGoal} />
      </MemoryRouter>
    );

    // Eyebrow and monumental headline
    expect(screen.getByText(/90 DAYS/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'COMPLETE' })).toBeInTheDocument();
    expect(screen.getByText('You made it.')).toBeInTheDocument();

    // Goal and outcome
    expect(screen.getByText('Run a sub-45 10k')).toBeInTheDocument();
    expect(screen.getByText(/Run 10 kilometers under 45 minutes with steady pacing/)).toBeInTheDocument();

    // Roman garden image with descriptive accessible alt text
    const gardenImg = screen.getByRole('img', { name: /Roman garden/i });
    expect(gardenImg).toBeInTheDocument();
    expect(gardenImg).toHaveAttribute('src', '/images/brand/garden.jpg');

    // Quick stats badges
    expect(screen.getByText('90 Days')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument(); // 4/4 completed active sessions

    // Primary and secondary CTAs
    expect(screen.getByRole('button', { name: /Your results/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Begin another journey/i })).toBeInTheDocument();
  });

  it('2. Switches to Results tab when [Your results] hero button is clicked', () => {
    render(
      <MemoryRouter>
        <AchievementScreen goal={mockGoal} />
      </MemoryRouter>
    );

    const resultsBtn = screen.getByRole('button', { name: /Your results/i });
    fireEvent.click(resultsBtn);

    // Results view displayed
    expect(screen.getByRole('heading', { level: 2, name: 'Verified Execution Metrics' })).toBeInTheDocument();
    expect(screen.getByText('Phase 3 Capstone Verification')).toBeInTheDocument();
    expect(screen.getAllByText(/Personal best recorded on cool morning/).length).toBeGreaterThan(0);
  });

  it('3. Supports accessible tab switching between Arrival, Results, and Journey', () => {
    render(
      <MemoryRouter>
        <AchievementScreen goal={mockGoal} />
      </MemoryRouter>
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    // Tab 1: Arrival is initially selected
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

    // Switch to Results
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Verified Execution Metrics' })).toBeInTheDocument();

    // Switch to Journey
    fireEvent.click(tabs[2]);
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'The Journey Honored' })).toBeInTheDocument();
    expect(screen.getByText('Aerobic Foundation')).toBeInTheDocument();
    expect(screen.getByText(/The ninety days transformed how I train/)).toBeInTheDocument();
  });

  it('4. Handles keyboard navigation across tabs (ArrowRight, ArrowLeft, Home, End)', () => {
    render(
      <MemoryRouter>
        <AchievementScreen goal={mockGoal} />
      </MemoryRouter>
    );

    const arrivalTab = screen.getByRole('tab', { name: /The Arrival/i });
    arrivalTab.focus();

    // ArrowRight -> Results
    fireEvent.keyDown(arrivalTab, { key: 'ArrowRight' });
    const resultsTab = screen.getByRole('tab', { name: /Your Results/i });
    expect(resultsTab).toHaveAttribute('aria-selected', 'true');

    // ArrowRight -> Journey
    fireEvent.keyDown(resultsTab, { key: 'ArrowRight' });
    const journeyTab = screen.getByRole('tab', { name: /What You Accomplished/i });
    expect(journeyTab).toHaveAttribute('aria-selected', 'true');

    // Home -> Arrival
    fireEvent.keyDown(journeyTab, { key: 'Home' });
    expect(screen.getByRole('tab', { name: /The Arrival/i })).toHaveAttribute('aria-selected', 'true');

    // End -> Journey
    fireEvent.keyDown(arrivalTab, { key: 'End' });
    expect(screen.getByRole('tab', { name: /What You Accomplished/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('5. Invokes onBeginAnotherJourney callback when secondary CTA is clicked', () => {
    const handleBegin = vi.fn();
    render(
      <MemoryRouter>
        <AchievementScreen goal={mockGoal} onBeginAnotherJourney={handleBegin} />
      </MemoryRouter>
    );

    const beginBtn = screen.getByRole('button', { name: /Begin another journey/i });
    fireEvent.click(beginBtn);

    expect(handleBegin).toHaveBeenCalledTimes(1);
  });
});
