import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlanV2Panel } from './PlanV2Panel';
import { formatPassIf } from '../lib/formatters';
import type { DailyTask, GoalRoadmap, RoadmapWeek } from '../types';

describe('formatPassIf helper', () => {
  it('appends a period when passIf does not end with terminal punctuation', () => {
    expect(formatPassIf('5 consecutive strict pull-ups')).toBe('Pass if 5 consecutive strict pull-ups.');
    expect(formatPassIf('X')).toBe('Pass if X.');
  });

  it('preserves terminal punctuation without appending an extra period', () => {
    expect(formatPassIf('5 consecutive strict pull-ups.')).toBe('Pass if 5 consecutive strict pull-ups.');
    expect(formatPassIf('Run 5km in under 25 minutes!')).toBe('Pass if Run 5km in under 25 minutes!');
    expect(formatPassIf('Can you finish in time?')).toBe('Pass if Can you finish in time?');
    expect(formatPassIf('X.')).toBe('Pass if X.');
  });

  it('handles empty and whitespace-only strings', () => {
    expect(formatPassIf('')).toBe('');
    expect(formatPassIf('   ')).toBe('');
    expect(formatPassIf(undefined)).toBe('');
    expect(formatPassIf(null)).toBe('');
  });
});

describe('PlanV2Panel component rendering', () => {
  const roadmap: GoalRoadmap = {
    method: {
      name: 'Linear Periodization',
      creator: 'Coach John',
      summary: 'Build volume then intensity',
      whyChosen: 'Best for beginners',
      runnerUp: { name: 'Block', whyLost: 'Too complex' },
      safety: 4,
      rules: ['Never skip rest days'],
    },
    phases: [{ name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Build base' }],
    startingPoint: { value: 0, description: '0 pull-ups' },
    finalGoal: '10 pull-ups',
    finalTest: 'Strict form test',
  };

  const createWeek = (passIf: string): RoadmapWeek => ({
    id: 'w1',
    goalId: 'g1',
    weekNumber: 1,
    phase: 'Foundation',
    theme: 'Base',
    objective: 'Initial test',
    keyMilestone: 'Max pull-up test',
    targetIntensity: 1,
    plannedMinutes: 60,
    status: 'active',
    created_at: '',
    test: {
      type: 'count',
      instructions: 'Max pull-up set in 1 min.',
      passIf,
    },
  });

  const weekTasks: DailyTask[] = [
    {
      id: 't1',
      goalId: 'g1',
      weekNumber: 1,
      dayNumber: 1,
      date: '2026-09-24',
      dayOfWeek: 'Thursday',
      title: 'Test day task',
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 30,
      isRestDay: false,
      isTestDay: true,
      status: 'pending',
      created_at: '',
    },
  ];

  it('renders "Pass if X." without duplicating a period when passIf already has one', () => {
    render(
      <MemoryRouter>
        <PlanV2Panel roadmap={roadmap} weeks={[createWeek('3 pull-ups.')]} currentWeek={1} weekTasks={weekTasks} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Pass if 3 pull-ups.')).toBeInTheDocument();
    expect(screen.queryByText(/Pass if 3 pull-ups\.\./)).not.toBeInTheDocument();
  });

  it('renders "Pass if X." when passIf lacks a period', () => {
    render(
      <MemoryRouter>
        <PlanV2Panel roadmap={roadmap} weeks={[createWeek('3 pull-ups')]} currentWeek={1} weekTasks={weekTasks} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Pass if 3 pull-ups.')).toBeInTheDocument();
  });
});
