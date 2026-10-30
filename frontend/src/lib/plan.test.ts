import { describe, expect, it } from 'vitest';
import { formatMetric } from './plan';

describe('formatMetric (ND-31)', () => {
  it('shows a time in minutes as minutes and seconds', () => {
    expect(formatMetric(54.6667, 'min')).toBe('54:40');
    expect(formatMetric(50, 'minutes')).toBe('50:00');
    expect(formatMetric(0.5, 'min')).toBe('0:30');
  });

  it('rounds anything else and keeps its unit', () => {
    expect(formatMetric(42.456, 'wpm')).toBe('42.46 wpm');
    expect(formatMetric(12, '')).toBe('12');
  });

});
