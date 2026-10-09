import { describe, it, expect } from 'vitest';
import { extractStatedTargets } from '../src/lib/research/statedTarget.js';

describe('stated targets in the goal text', () => {
  it('reads a rate, a ceiling, and a count, including a number word', () => {
    expect(extractStatedTargets('Learn touch typing to 40 words per minute').map((item) => item.phrase)).toEqual([
      '40 words per minute',
    ]);
    expect(extractStatedTargets('Run a 10K in under 50 minutes')[0]).toMatchObject({
      value: 50,
      unit: 'minutes',
      bound: 'at_most',
      direction: 'lower_is_harder',
    });
    expect(extractStatedTargets('Learn 200 common Italian words')[0]).toMatchObject({ value: 200, unit: 'words' });
    expect(extractStatedTargets('Do 20 push-ups in a row')[0]).toMatchObject({ value: 20, unit: 'push-ups' });
    expect(extractStatedTargets('Play five songs on the piano')[0]).toMatchObject({ value: 5, unit: 'songs' });
    expect(extractStatedTargets('Learn to whistle with two fingers')).toEqual([]);
  });

  it('does not treat a race name or a plan length as the target', () => {
    expect(extractStatedTargets('Run a 10K')).toEqual([]);
    expect(extractStatedTargets('Build a 12 week meditation practice')).toEqual([]);
    expect(extractStatedTargets('Build a mindfulness meditation practice to reduce stress')).toEqual([]);
  });

  // B-27: "row 10,000 m in one steady piece" was read as a target of "1 piece", so every roadmap failed.
  it('does not read "in one piece" and similar phrases as a count of one', () => {
    expect(extractStatedTargets('Row 10,000 m in one steady piece')).toEqual([]);
    expect(extractStatedTargets('Read the whole book in one sitting')).toEqual([]);
    expect(extractStatedTargets('Finish the essay in one go')).toEqual([]);
    expect(extractStatedTargets('Hike 25 km in one day')).toEqual([]);
    expect(extractStatedTargets('Do 10 strict pull-ups in one set').map((item) => item.phrase)).toEqual(['10 pull-ups']);
  });

  it('still finds real targets, including a count of one', () => {
    expect(extractStatedTargets('Write one book')[0]).toMatchObject({ value: 1, unit: 'book' });
    expect(extractStatedTargets('Play 5 songs')[0]).toMatchObject({ value: 5, unit: 'songs' });
    expect(extractStatedTargets('Make 50 sales from my Notion template')[0]).toMatchObject({ value: 50, unit: 'sales' });
    expect(extractStatedTargets('Get 50 users for my recipe app')[0]).toMatchObject({ value: 50, unit: 'users' });
    expect(extractStatedTargets('Do 3 sets of 10 pull-ups').map((item) => item.phrase)).toEqual(['3 sets', '10 pull-ups']);
  });

  it('takes a unit of measure right after the number, not a word after it', () => {
    expect(extractStatedTargets('Swim 1500 metres freestyle without stopping').map((item) => item.phrase)).toEqual(['1500 metres']);
    expect(extractStatedTargets('Chatting with a tutor for 10 minutes without switching to English').map((item) => item.phrase)).toEqual([
      '10 minutes',
    ]);
  });

  it('never takes a connecting word as the unit', () => {
    expect(extractStatedTargets('Playing the melodies of 5 standards cleanly').map((item) => item.unit)).not.toContain('cleanly');
    expect(extractStatedTargets('Playing 5 full songs along with the track').map((item) => item.phrase)).toEqual(['5 songs']);
  });

  it('reads practice time as practice time, not a target', () => {
    expect(extractStatedTargets('Meditate for 20 minutes every day')).toEqual([]);
    expect(extractStatedTargets('Read 2 hours per week')).toEqual([]);
    expect(extractStatedTargets('Practice piano 30 minutes every day to play Für Elise')).toEqual([]);
    expect(extractStatedTargets('Practice guitar 30 minutes a day')).toEqual([]);
    expect(extractStatedTargets('Study 1 hour daily for the exam')).toEqual([]);
    expect(extractStatedTargets('Meditating 20 minutes on most days')).toEqual([]);
  });

  it('still finds a time that is the result', () => {
    expect(extractStatedTargets('Run a 10K Under 50 Minutes').map((item) => item.phrase)).toEqual(['under 50 minutes']);
    expect(extractStatedTargets('Hold a plank for 3 minutes').map((item) => item.phrase)).toEqual(['3 minutes']);
  });

  it('keeps two different targets that share a number, both required', () => {
    expect(extractStatedTargets('Lose 10 pounds and do 10 pull-ups').map((item) => item.phrase)).toEqual(['10 pounds', '10 pull-ups']);
    const posts = extractStatedTargets('Write 5 blog posts and get 5 clients');
    expect(posts.map((item) => item.phrase)).toEqual(['5 posts', '5 clients']);
    expect(posts[0].aliases).not.toContain('clients');
  });

  it('merges singular and plural of one word', () => {
    const targets = extractStatedTargets('Write 1 book. 1 books');
    expect(targets).toHaveLength(1);
  });

  it('treats one number named two ways as one target, met in either unit', () => {
    const targets = extractStatedTargets('Get 100 users. 100 people using the extension every week');
    expect(targets).toHaveLength(1);
    expect(targets[0].phrase).toBe('100 users');
    expect(targets[0].aliases).toEqual(expect.arrayContaining(['users', 'people']));
  });
});
