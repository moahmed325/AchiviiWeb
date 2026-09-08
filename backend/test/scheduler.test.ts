import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  subtractIntervals,
  getPreferredWindow,
  generateThreeMonthSchedule,
  type TimeInterval,
} from '../src/lib/scheduler.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    userGoal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('scheduler.ts unit tests', () => {
  describe('time conversion helpers', () => {
    it('converts HH:MM string to minutes from midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('07:30')).toBe(450);
      expect(timeToMinutes('12:00')).toBe(720);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('converts minutes from midnight to zero-padded HH:MM string', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(450)).toBe('07:30');
      expect(minutesToTime(720)).toBe('12:00');
      expect(minutesToTime(1439)).toBe('23:59');
    });
  });

  describe('subtractIntervals', () => {
    it('handles no overlap when busy is completely before or after opening', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 10:00 - 12:00
      const busyBefore: TimeInterval = { start: 480, end: 540 };   // 08:00 - 09:00
      const busyAfter: TimeInterval = { start: 780, end: 840 };    // 13:00 - 14:00

      expect(subtractIntervals(openings, busyBefore)).toEqual([{ start: 600, end: 720 }]);
      expect(subtractIntervals(openings, busyAfter)).toEqual([{ start: 600, end: 720 }]);
    });

    it('handles busy touching the edges exactly (no overlap)', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }];
      const busyTouchesLeft: TimeInterval = { start: 540, end: 600 };
      const busyTouchesRight: TimeInterval = { start: 720, end: 780 };

      expect(subtractIntervals(openings, busyTouchesLeft)).toEqual([{ start: 600, end: 720 }]);
      expect(subtractIntervals(openings, busyTouchesRight)).toEqual([{ start: 600, end: 720 }]);
    });

    it('handles busy overlapping left side of opening', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 10:00 - 12:00 (120 min)
      const busy: TimeInterval = { start: 540, end: 660 };         // 09:00 - 11:00

      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([{ start: 660, end: 720 }]); // 11:00 - 12:00 (60 min)
    });

    it('handles busy overlapping right side of opening', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 10:00 - 12:00
      const busy: TimeInterval = { start: 660, end: 750 };         // 11:00 - 12:30

      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([{ start: 600, end: 660 }]); // 10:00 - 11:00
    });

    it('handles busy splitting opening in the middle', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 900 }]; // 10:00 - 15:00 (300 min)
      const busy: TimeInterval = { start: 720, end: 780 };         // 12:00 - 13:00 (60 min)

      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([
        { start: 600, end: 720 },
        { start: 780, end: 900 },
      ]);
    });

    it('discards intervals under 15 minutes (tight schedule filtering)', () => {
      // Opening is 120 mins: 600 to 720.
      // Busy block from 600 to 706 leaves 14 mins (706 to 720), which is < 15 min -> discarded
      const openings: TimeInterval[] = [{ start: 600, end: 720 }];
      const busyLeaving14m: TimeInterval = { start: 600, end: 706 };
      expect(subtractIntervals(openings, busyLeaving14m)).toEqual([]);

      // Busy block from 600 to 705 leaves exactly 15 mins (705 to 720) -> retained
      const busyLeaving15m: TimeInterval = { start: 600, end: 705 };
      expect(subtractIntervals(openings, busyLeaving15m)).toEqual([{ start: 705, end: 720 }]);
    });

    it('discards middle-split slivers if either side is < 15 minutes', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 120m
      // Split leaving 10m on left (600-610) and 50m on right (670-720)
      const busy: TimeInterval = { start: 610, end: 670 };
      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([{ start: 670, end: 720 }]);
    });

    it('returns empty array when busy interval completely covers or exceeds the opening', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }];
      const exactBusy: TimeInterval = { start: 600, end: 720 };
      const engulfingBusy: TimeInterval = { start: 500, end: 800 };

      expect(subtractIntervals(openings, exactBusy)).toEqual([]);
      expect(subtractIntervals(openings, engulfingBusy)).toEqual([]);
    });

    it('handles multiple sequential subtractions', () => {
      let openings: TimeInterval[] = [{ start: 420, end: 1320 }]; // 07:00 - 22:00 (15 hrs)
      const busyBlocks: TimeInterval[] = [
        { start: 540, end: 720 },  // 09:00 - 12:00
        { start: 780, end: 1020 }, // 13:00 - 17:00
      ];

      for (const busy of busyBlocks) {
        openings = subtractIntervals(openings, busy);
      }

      expect(openings).toEqual([
        { start: 420, end: 540 },  // 07:00 - 09:00
        { start: 720, end: 780 },  // 12:00 - 13:00
        { start: 1020, end: 1320 },// 17:00 - 22:00
      ]);
    });
  });

  describe('getPreferredWindow', () => {
    it('returns morning interval (07:00–12:00) when pref is morning', () => {
      expect(getPreferredWindow('morning')).toEqual({ start: 420, end: 720 });
      expect(getPreferredWindow('Morning')).toEqual({ start: 420, end: 720 });
      expect(getPreferredWindow('MORNING')).toEqual({ start: 420, end: 720 });
    });

    it('returns afternoon interval (12:00–17:00) when pref is afternoon', () => {
      expect(getPreferredWindow('afternoon')).toEqual({ start: 720, end: 1020 });
      expect(getPreferredWindow('Afternoon')).toEqual({ start: 720, end: 1020 });
    });

    it('returns evening interval (17:00–21:30) when pref is evening', () => {
      expect(getPreferredWindow('evening')).toEqual({ start: 1020, end: 1290 });
      expect(getPreferredWindow('Evening')).toEqual({ start: 1020, end: 1290 });
    });

    it('returns full default window (07:00–22:00) when pref is missing or unknown', () => {
      expect(getPreferredWindow(null)).toEqual({ start: 420, end: 1320 });
      expect(getPreferredWindow(undefined)).toEqual({ start: 420, end: 1320 });
      expect(getPreferredWindow('anytime')).toEqual({ start: 420, end: 1320 });
    });
  });

  describe('generateThreeMonthSchedule', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('throws error if userGoal is not found', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue(null);
      await expect(generateThreeMonthSchedule('non-existent-id')).rejects.toThrow(
        'UserGoal or GoalCatalog not found.'
      );
    });

    it('handles full week with zero availability gracefully without crashing', async () => {
      // User has busy blocks covering 00:00 - 23:59 on Mon-Sat
      const allDayBusySlots = [
        { day_of_week: 'MON', start_time: '00:00', end_time: '23:59' },
        { day_of_week: 'TUE', start_time: '00:00', end_time: '23:59' },
        { day_of_week: 'WED', start_time: '00:00', end_time: '23:59' },
        { day_of_week: 'THU', start_time: '00:00', end_time: '23:59' },
        { day_of_week: 'FRI', start_time: '00:00', end_time: '23:59' },
        { day_of_week: 'SAT', start_time: '00:00', end_time: '23:59' },
      ];

      const mockGoal = {
        id: 'goal-1',
        start_date: new Date('2026-09-14T00:00:00Z'), // Monday
        goal_catalog: {
          phases: [
            {
              phase_order: 1,
              task_templates: [
                {
                  id: 'task-1',
                  sessions_per_week: 5,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          ],
        },
        user: {
          availability_slots: allDayBusySlots,
        },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.session.createMany as any).mockResolvedValue({ count: 12 }); // Sunday has fixed free window (08:00-21:00)

      const result = await generateThreeMonthSchedule('goal-1');
      // On Sunday (which has no user busy slots by design), 1 session per week can fit
      expect(prisma.session.createMany).toHaveBeenCalled();
      const createdSessions = (prisma.session.createMany as any).mock.calls[0][0].data;
      
      // All placed sessions must be on Sunday because Mon-Sat are completely busy
      for (const s of createdSessions) {
        const d = new Date(s.scheduled_date);
        expect(d.getDay()).toBe(0); // 0 is Sunday
      }
      expect(result).toBe(createdSessions.length);
    });

    it('respects preferred_time_of_day when suitable window is available', async () => {
      const mockGoal = {
        id: 'goal-pref',
        start_date: new Date('2026-09-14T00:00:00Z'), // Monday
        goal_catalog: {
          phases: [
            {
              phase_order: 1,
              task_templates: [
                {
                  id: 'task-morning',
                  sessions_per_week: 3,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'morning', // 07:00 - 12:00 (420 - 720)
                },
              ],
            },
          ],
        },
        user: {
          availability_slots: [], // fully free
        },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.session.createMany as any).mockResolvedValue({ count: 36 });

      await generateThreeMonthSchedule('goal-pref');

      expect(prisma.session.createMany).toHaveBeenCalled();
      const createdSessions = (prisma.session.createMany as any).mock.calls[0][0].data;

      // Check that placed sessions start within the morning window (>= 07:00 and < 12:00)
      for (const s of createdSessions) {
        const startMinutes = timeToMinutes(s.start_time);
        const endMinutes = timeToMinutes(s.end_time);
        expect(startMinutes).toBeGreaterThanOrEqual(420); // 07:00
        expect(endMinutes).toBeLessThanOrEqual(720);      // 12:00
        expect(endMinutes - startMinutes).toBe(45);
      }
    });

    it('falls back to non-preferred window when preferred window is occupied by busy slots', async () => {
      // Morning (07:00 - 12:00) is blocked by busy slot, but afternoon (12:00 - 17:00) is open
      const mockGoal = {
        id: 'goal-fallback',
        start_date: new Date('2026-09-14T00:00:00Z'),
        goal_catalog: {
          phases: [
            {
              phase_order: 1,
              task_templates: [
                {
                  id: 'task-morn-fallback',
                  sessions_per_week: 1,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          ],
        },
        user: {
          availability_slots: [
            { day_of_week: 'MON', start_time: '07:00', end_time: '12:00' },
            { day_of_week: 'TUE', start_time: '07:00', end_time: '12:00' },
            { day_of_week: 'WED', start_time: '07:00', end_time: '12:00' },
            { day_of_week: 'THU', start_time: '07:00', end_time: '12:00' },
            { day_of_week: 'FRI', start_time: '07:00', end_time: '12:00' },
            { day_of_week: 'SAT', start_time: '07:00', end_time: '12:00' },
          ],
        },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.session.createMany as any).mockResolvedValue({ count: 12 });

      await generateThreeMonthSchedule('goal-fallback');

      const createdSessions = (prisma.session.createMany as any).mock.calls[0][0].data;
      expect(createdSessions.length).toBeGreaterThan(0);
      // Week 1 Monday session should be scheduled in afternoon / available slot (start >= 12:00)
      const monSession = createdSessions.find((s: any) => {
        const d = new Date(s.scheduled_date);
        return d.getDay() === 1; // Monday
      });
      if (monSession) {
        expect(timeToMinutes(monSession.start_time)).toBeGreaterThanOrEqual(720); // 12:00
      }
    });

    it('preserves completed sessions when preserveCompleted option is true', async () => {
      const doneSession = {
        id: 'done-session-1',
        task_template_id: 'task-1',
        scheduled_date: new Date('2026-09-14T08:00:00Z'),
        start_time: '08:00',
        end_time: '09:00',
      };

      const mockGoal = {
        id: 'goal-preserve',
        start_date: new Date('2026-09-14T00:00:00Z'),
        goal_catalog: {
          phases: [
            {
              phase_order: 1,
              task_templates: [
                {
                  id: 'task-1',
                  sessions_per_week: 1,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          ],
        },
        user: { availability_slots: [] },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.findMany as any).mockResolvedValue([doneSession]);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 11 });
      (prisma.session.createMany as any).mockResolvedValue({ count: 11 });

      const count = await generateThreeMonthSchedule('goal-preserve', { preserveCompleted: true });

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          user_goal_id: 'goal-preserve',
          id: { notIn: ['done-session-1'] },
        },
      });
      // 1 done session preserved + 11 newly created sessions = 12 total
      expect(count).toBe(12);
    });
  });
});
