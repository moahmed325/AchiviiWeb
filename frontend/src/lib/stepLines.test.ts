import { describe, expect, it } from 'vitest';
import { movedFrom, movedHereLine } from './stepLines';

// 2026-10-20 is a Tuesday, 2026-10-21 a Wednesday.
const TUE = { taskId: 'tue', date: '2026-10-20' };
const WED = { taskId: 'wed', date: '2026-10-21' };

describe('movedFrom', () => {
  it('names the day a carried, swapped or reordered step came from', () => {
    expect(movedFrom({ title: 'Tempo', carriedFrom: { ...TUE, replaced: [] } } as never, 'thu')).toBe('Tuesday');
    expect(movedFrom({ title: 'Tempo', swappedFrom: TUE }, 'thu')).toBe('Tuesday');
    expect(movedFrom({ title: 'Tempo', shiftedFrom: WED }, 'thu')).toBe('Wednesday');
  });

  it('is null for a step written on this day, or with no marker', () => {
    expect(movedFrom({ title: 'Tempo', shiftedFrom: { taskId: 'thu', date: '2026-10-22' } }, 'thu')).toBeNull();
    expect(movedFrom({ title: 'Tempo' }, 'thu')).toBeNull();
    expect(movedFrom({ title: 'Tempo', carriedFrom: { taskId: 'tue' } }, 'thu')).toBeNull();
  });
});

describe('movedHereLine', () => {
  it('"Moved from Tuesday" when every step came from one day (a swap)', () => {
    expect(movedHereLine([{ swappedFrom: TUE }, { swappedFrom: TUE }], 'thu')).toBe('Moved from Tuesday');
  });

  it('"Includes a step from Tuesday" when one step moved in', () => {
    expect(movedHereLine([{ title: 'Own' }, { carriedFrom: TUE }], 'thu')).toBe('Includes a step from Tuesday');
  });

  it('names each day when steps came from more than one', () => {
    expect(movedHereLine([{ title: 'Own' }, { carriedFrom: TUE }, { shiftedFrom: WED }], 'thu')).toBe('Includes steps from Tuesday and Wednesday');
  });

  it('is null when nothing moved here', () => {
    expect(movedHereLine([{ title: 'Own' }], 'thu')).toBeNull();
    expect(movedHereLine([], 'thu')).toBeNull();
  });
});
