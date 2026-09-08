import { describe, it, expect, vi } from 'vitest';
import { backfillLegacySessions } from '../scripts/backfill-phase1-sessions.js';
import { SessionTier } from '@prisma/client';

describe('backfillLegacySessions script', () => {
  it('backfills day_number, sequence_order, and tier on unpopulated sessions', async () => {
    const mockGoal = {
      id: 'goal-legacy',
      start_date: new Date('2026-09-14T00:00:00Z'),
      current_plan_day_offset: null,
      sessions: [
        {
          id: 'sess-1',
          task_template_id: 'task-A',
          day_number: null,
          sequence_order: null,
          tier: 'core',
          scheduled_date: new Date('2026-09-14T09:00:00Z'), // Day 0
          start_time: '09:00',
          end_time: '10:00',
          task_template: { sessions_per_week: 2 },
        },
        {
          id: 'sess-2',
          task_template_id: 'task-A',
          day_number: null,
          sequence_order: null,
          tier: 'core',
          scheduled_date: new Date('2026-09-16T09:00:00Z'), // Day 2
          start_time: '09:00',
          end_time: '10:00',
          task_template: { sessions_per_week: 2 },
        },
      ],
    };

    const mockPrisma = {
      userGoal: {
        findMany: vi.fn().mockResolvedValue([mockGoal]),
        update: vi.fn().mockResolvedValue({}),
      },
      session: {
        update: vi.fn().mockResolvedValue({}),
      },
    } as any;

    const result = await backfillLegacySessions(mockPrisma);

    expect(result.goalsProcessed).toBe(1);
    expect(result.sessionsUpdated).toBe(2);

    // Goal offset initialized
    expect(mockPrisma.userGoal.update).toHaveBeenCalledWith({
      where: { id: 'goal-legacy' },
      data: { current_plan_day_offset: 0 },
    });

    // Session 1: day 0, seq 1, tier core
    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: {
        day_number: 0,
        sequence_order: 1,
        tier: SessionTier.core,
      },
    });

    // Session 2: day 2, seq 2, tier buffer (2nd session of 2-session task)
    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: 'sess-2' },
      data: {
        day_number: 2,
        sequence_order: 2,
        tier: SessionTier.buffer,
      },
    });
  });
});
