import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { prisma } from '../src/lib/prisma.js';
import {
  isValidTimezone,
  normalizeTimezone,
  getZonedDateString,
  getUserTodayDateString,
  getZonedTimeParts,
  getZonedDayBounds,
  zonedWallTimeToInstant,
} from '../src/lib/timezone.js';
import { authRouter } from '../src/routes/auth.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Timezone Utility (Phase 1 Task 6 & 7)', () => {
  it('validates IANA timezones accurately', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);

    expect(isValidTimezone('Invalid/Zone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
    expect(isValidTimezone(12345)).toBe(false);
  });

  it('normalizes invalid or missing timezones to UTC', () => {
    expect(normalizeTimezone('America/New_York')).toBe('America/New_York');
    expect(normalizeTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(normalizeTimezone('Invalid/Zone')).toBe('UTC');
    expect(normalizeTimezone(null)).toBe('UTC');
    expect(normalizeTimezone(undefined)).toBe('UTC');
  });

  it('computes zoned date strings across international date boundaries', () => {
    // 2026-09-08 23:30 UTC:
    // In Tokyo (UTC+9), it is already 2026-09-09 (08:30 AM)
    // In New York (EDT, UTC-4), it is still 2026-09-08 (19:30 PM)
    const testDate = new Date('2026-09-08T23:30:00.000Z');

    const tokyoDateStr = getZonedDateString(testDate, 'Asia/Tokyo');
    const nyDateStr = getZonedDateString(testDate, 'America/New_York');
    const utcDateStr = getZonedDateString(testDate, 'UTC');

    expect(tokyoDateStr).toBe('2026-09-09');
    expect(nyDateStr).toBe('2026-09-08');
    expect(utcDateStr).toBe('2026-09-08');
  });

  it('computes today string in user timezone', () => {
    const todayStr = getUserTodayDateString('UTC');
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('breaks down date into accurate zoned time parts', () => {
    // 2026-09-08 23:30 UTC
    const testDate = new Date('2026-09-08T23:30:00.000Z');

    const tokyoParts = getZonedTimeParts(testDate, 'Asia/Tokyo');
    expect(tokyoParts.dateStr).toBe('2026-09-09');
    expect(tokyoParts.hours).toBe(8);
    expect(tokyoParts.minutes).toBe(30);
    expect(tokyoParts.minutesFromMidnight).toBe(8 * 60 + 30);
    expect(tokyoParts.dayKey).toBe('WED');

    const nyParts = getZonedTimeParts(testDate, 'America/New_York');
    expect(nyParts.dateStr).toBe('2026-09-08');
    expect(nyParts.hours).toBe(19);
    expect(nyParts.minutes).toBe(30);
    expect(nyParts.minutesFromMidnight).toBe(19 * 60 + 30);
    expect(nyParts.dayKey).toBe('TUE');
  });

  it('evaluates timezone-aware day bounds without naive UTC string splitting', () => {
    // For UTC on 2026-09-08
    const utcBounds = getZonedDayBounds('2026-09-08', 'UTC');
    expect(utcBounds.startOfDay.toISOString()).toBe('2026-09-08T00:00:00.000Z');
    expect(utcBounds.endOfDay.toISOString()).toBe('2026-09-08T23:59:59.999Z');

    // For America/New_York (EDT, UTC-4 on Sept 8)
    // 00:00 EDT = 04:00 UTC
    // 23:59:59.999 EDT = 03:59:59.999 UTC next day
    const nyBounds = getZonedDayBounds('2026-09-08', 'America/New_York');
    expect(nyBounds.startOfDay.toISOString()).toBe('2026-09-08T04:00:00.000Z');
    expect(nyBounds.endOfDay.toISOString()).toBe('2026-09-09T03:59:59.999Z');

    // For Asia/Tokyo (JST, UTC+9)
    // 00:00 JST = 15:00 UTC previous day
    // 23:59:59.999 JST = 14:59:59.999 UTC
    const tokyoBounds = getZonedDayBounds('2026-09-08', 'Asia/Tokyo');
    expect(tokyoBounds.startOfDay.toISOString()).toBe('2026-09-07T15:00:00.000Z');
    expect(tokyoBounds.endOfDay.toISOString()).toBe('2026-09-08T14:59:59.999Z');
  });

  describe('zonedWallTimeToInstant (missed-sessions M1.2, R1)', () => {
    const at = (date: string, time: string, tz: string) => zonedWallTimeToInstant(date, time, tz).toISOString();

    it('places a wall time on an ordinary day', () => {
      expect(at('2026-09-24', '01:00', 'Africa/Addis_Ababa')).toBe('2026-09-23T22:00:00.000Z');
      expect(at('2026-09-24', '04:00', 'America/Los_Angeles')).toBe('2026-09-24T11:00:00.000Z');
      expect(at('2026-09-24', '01:00', 'Pacific/Kiritimati')).toBe('2026-09-23T11:00:00.000Z');
      expect(at('2026-09-24', '00:00', 'UTC')).toBe('2026-09-24T00:00:00.000Z');
    });

    it('uses the offset in force at that wall time on a spring-forward day (New York, 8 Mar 2026)', () => {
      expect(at('2026-03-08', '01:30', 'America/New_York')).toBe('2026-03-08T06:30:00.000Z'); // EST
      expect(at('2026-03-08', '03:00', 'America/New_York')).toBe('2026-03-08T07:00:00.000Z'); // EDT
      expect(at('2026-03-08', '04:00', 'America/New_York')).toBe('2026-03-08T08:00:00.000Z'); // EDT
    });

    it('resolves a wall time skipped by spring-forward to the change itself', () => {
      // 02:00 EST jumps to 03:00 EDT at 07:00 UTC; 02:30 never happens.
      expect(at('2026-03-08', '02:30', 'America/New_York')).toBe('2026-03-08T07:00:00.000Z');
      expect(at('2026-03-08', '02:00', 'America/New_York')).toBe('2026-03-08T07:00:00.000Z');
      // London: 01:00 GMT jumps to 02:00 BST at 01:00 UTC.
      expect(at('2026-03-29', '01:30', 'Europe/London')).toBe('2026-03-29T01:00:00.000Z');
    });

    it('resolves a wall time that happens twice in fall-back to the later one', () => {
      // New York, 1 Nov 2026: 01:30 EDT (05:30 UTC) and 01:30 EST (06:30 UTC).
      expect(at('2026-11-01', '01:30', 'America/New_York')).toBe('2026-11-01T06:30:00.000Z');
      expect(at('2026-11-01', '00:30', 'America/New_York')).toBe('2026-11-01T04:30:00.000Z'); // EDT
      expect(at('2026-11-01', '03:00', 'America/New_York')).toBe('2026-11-01T08:00:00.000Z'); // EST
      // Sydney, 5 Apr 2026: 02:30 AEDT (15:30 UTC) and 02:30 AEST (16:30 UTC).
      expect(at('2026-04-05', '02:30', 'Australia/Sydney')).toBe('2026-04-04T16:30:00.000Z');
    });

    it('reads a missing or invalid timezone as UTC', () => {
      expect(at('2026-09-24', '04:00', 'Invalid/Zone')).toBe('2026-09-24T04:00:00.000Z');
      expect(zonedWallTimeToInstant('2026-09-24', '04:00').toISOString()).toBe('2026-09-24T04:00:00.000Z');
    });

    it('throws on a malformed date or time', () => {
      expect(() => zonedWallTimeToInstant('2026-9-24', '04:00', 'UTC')).toThrow();
      expect(() => zonedWallTimeToInstant('2026-09-24', '24:00', 'UTC')).toThrow();
      expect(() => zonedWallTimeToInstant('2026-09-24', '7pm', 'UTC')).toThrow();
    });
  });
});
