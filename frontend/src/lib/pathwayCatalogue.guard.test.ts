import { describe, expect, it } from 'vitest';
import { CERTIFIED_PATHWAYS } from './certifiedPresets';

const CATALOGUE = '/src/lib/certifiedPresets.ts';

const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const RETIRED_CATEGORIES = ['Tech & Career', 'Fitness & Health', 'Creative & Media', 'Mastery & Mind'];

const quotedIds = (source: string) =>
  CERTIFIED_PATHWAYS.filter((p) => new RegExp(`['"\`]${p.id}['"\`]`).test(source)).map((p) => p.id);

describe('one pathway catalogue (ND-15)', () => {
  it('scans the app source', () => {
    expect(Object.keys(sources)).toContain(CATALOGUE);
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('keeps pathway titles in the catalogue only', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => path !== CATALOGUE)
      .flatMap(([path, source]) => CERTIFIED_PATHWAYS.filter((p) => source.includes(p.title)).map((p) => `${path}: ${p.title}`));
    expect(offenders).toEqual([]);
  });

  it('keeps lists of pathway ids in the catalogue only', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => path !== CATALOGUE)
      .map(([path, source]) => [path, quotedIds(source)] as const)
      .filter(([, ids]) => ids.length > 1)
      .map(([path, ids]) => `${path}: ${ids.join(', ')}`);
    expect(offenders).toEqual([]);
  });

  it('has no second set of categories', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      RETIRED_CATEGORIES.filter((c) => source.includes(c)).map((c) => `${path}: ${c}`),
    );
    expect(offenders).toEqual([]);
  });
});
