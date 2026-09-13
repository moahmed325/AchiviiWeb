import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  subtractIntervals,
  getPreferredWindow,
  determineSessionTier,
  type TimeInterval,
} from '../src/lib/timeUtils.js';
import { SessionTier } from '@prisma/client';

describe('timeUtils.ts unit tests', () => {
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

    it('handles boundary conditions: round-trip consistency', () => {
      const testCases = ['06:00', '09:15', '14:45', '21:30', '23:59'];
      for (const timeStr of testCases) {
        expect(minutesToTime(timeToMinutes(timeStr))).toBe(timeStr);
      }
    });

    it('handles empty or falsy time strings', () => {
      expect(timeToMinutes('')).toBe(0);
    });
  });

  describe('subtractIntervals helper', () => {
    it('returns original opening when busy does not overlap', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 10:00 - 12:00
      const busy: TimeInterval = { start: 480, end: 540 }; // 08:00 - 09:00
      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([{ start: 600, end: 720 }]);
    });

    it('subtracts busy from start of opening', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 10:00 - 12:00
      const busy: TimeInterval = { start: 580, end: 660 }; // overlaps left: until 11:00
      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([{ start: 660, end: 720 }]); // 11:00 - 12:00
    });

    it('subtracts busy from end of opening', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 10:00 - 12:00
      const busy: TimeInterval = { start: 660, end: 750 }; // overlaps right: from 11:00
      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([{ start: 600, end: 660 }]); // 10:00 - 11:00
    });

    it('splits opening when busy is in the middle', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 840 }]; // 10:00 - 14:00 (4 hrs)
      const busy: TimeInterval = { start: 660, end: 720 }; // 11:00 - 12:00
      const result = subtractIntervals(openings, busy);
      expect(result).toEqual([
        { start: 600, end: 660 }, // 10:00 - 11:00
        { start: 720, end: 840 }, // 12:00 - 14:00
      ]);
    });

    it('discards residual slots shorter than 15 minutes', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 670 }]; // 70 min opening
      const busy: TimeInterval = { start: 610, end: 670 }; // leaves 10 min (600-610)
      const result = subtractIntervals(openings, busy);
      expect(result).toHaveLength(0); // 10 min < 15 min threshold
    });
  });

  describe('getPreferredWindow helper', () => {
    it('returns morning window 07:00 - 12:00', () => {
      expect(getPreferredWindow('morning')).toEqual({ start: 420, end: 720 });
    });

    it('returns afternoon window 12:00 - 17:00', () => {
      expect(getPreferredWindow('afternoon')).toEqual({ start: 720, end: 1020 });
    });

    it('returns evening window 17:00 - 22:00', () => {
      expect(getPreferredWindow('evening')).toEqual({ start: 1020, end: 1320 });
    });

    it('defaults to 08:00 - 20:00 for undefined preference', () => {
      expect(getPreferredWindow(undefined)).toEqual({ start: 480, end: 1200 });
      expect(getPreferredWindow(null)).toEqual({ start: 480, end: 1200 });
      expect(getPreferredWindow('unknown')).toEqual({ start: 480, end: 1200 });
    });
  });

  describe('determineSessionTier', () => {
    it('returns core for single session weeks', () => {
      expect(determineSessionTier(0, 1)).toBe(SessionTier.core);
    });

    it('splits 2-session weeks into core and buffer', () => {
      expect(determineSessionTier(0, 2)).toBe(SessionTier.core);
      expect(determineSessionTier(1, 2)).toBe(SessionTier.buffer);
    });

    it('splits 3-session weeks into core, buffer, and reflect', () => {
      expect(determineSessionTier(0, 3)).toBe(SessionTier.core);
      expect(determineSessionTier(1, 3)).toBe(SessionTier.buffer);
      expect(determineSessionTier(2, 3)).toBe(SessionTier.reflect);
    });

    it('splits 4-session weeks with 50% core, 25% buffer, 25% reflect', () => {
      expect(determineSessionTier(0, 4)).toBe(SessionTier.core);
      expect(determineSessionTier(1, 4)).toBe(SessionTier.core);
      expect(determineSessionTier(2, 4)).toBe(SessionTier.buffer);
      expect(determineSessionTier(3, 4)).toBe(SessionTier.reflect);
    });

    it('splits 5-session weeks conforming to ~40-50% core, ~30-40% buffer, ~20% reflect', () => {
      const tiers = [0, 1, 2, 3, 4].map((idx) => determineSessionTier(idx, 5));
      expect(tiers).toEqual([
        SessionTier.core,
        SessionTier.core,
        SessionTier.buffer,
        SessionTier.buffer,
        SessionTier.reflect,
      ]);
    });
  });
});
