import { describe, it, expect } from 'vitest';
import { findPresetForGoal, CERTIFIED_PRESETS } from '../src/lib/ai/presets/index.js';

describe('certified preset matching', () => {
  it('still recognizes each preset by its own title', () => {
    for (const preset of CERTIFIED_PRESETS) {
      expect(findPresetForGoal(preset.title)?.id).toBe(preset.id);
    }
  });

  it('does not hand a nearby goal to the wrong preset', () => {
    const custom = [
      'Lose 10kg',
      'Learn piano chords',
      'Play five songs on the piano',
      'Book a dentist appointment',
      'The authority on sourdough',
      'Focus the camera lens',
      'Pay attention to your running posture',
      'Learn to whistle and hold a musical pitch',
      'Shred cheese for tacos',
      'Write more eloquent emails',
      'Watch 12 videos about knitting',
      'Run a faster 5K this season',
    ];
    for (const goal of custom) {
      expect(findPresetForGoal(goal), goal).toBeNull();
    }
  });

  it('matches the frontend TED title to the speech preset and leaves custom goals alone (ND-17)', () => {
    const ted = findPresetForGoal('Deliver a 15-Minute TED-Style Speech');
    expect(ted?.id).toBe('ted_speech_15min');
    expect(ted?.diagnosticQuestions.map((q) => q.id)).toEqual(['baseline', 'primary_fear', 'speech_context']);
    expect(findPresetForGoal('Deliver an Unforgettable 15-Minute TED-Style Speech')?.id).toBe('ted_speech_15min');
    expect(findPresetForGoal('Bake sourdough bread at home')).toBeNull();

    const pathways: Array<[string, string]> = [
      ['Run a 10K Under 50 Minutes', 'run10k'],
      ['Drop 5% Body Fat & Build Lean Muscle', 'body_recomposition_90day'],
      ['Build & Ship a SaaS Web App', 'saas_first_customer'],
      ['Play 5 Songs on Acoustic Guitar', 'guitar5songs'],
      ['Speak Conversational Spanish', 'spanish_conversation'],
      ['Launch a YouTube Channel (12 Videos)', 'youtube_12_videos'],
      ['Write & Polish a 30,000-Word Book', 'book_30k_words'],
      ['Master Deep Work & Double Daily Output', 'deep_work_focus'],
      ['Climb to a 1200 Rapid Chess Rating', 'chess_1200_rating'],
      ['Deliver a 15-Minute TED-Style Speech', 'ted_speech_15min'],
    ];
    for (const [title, id] of pathways) {
      expect(findPresetForGoal(title)?.id, title).toBe(id);
    }
  });

  it('still catches the goals the presets were written for', () => {
    expect(findPresetForGoal('Run a 10K in under 50 minutes')?.id).toBe('run10k');
    expect(findPresetForGoal('Learn acoustic guitar fingerpicking')?.id).toBe('guitar5songs');
    expect(findPresetForGoal('Hold a conversation in Spanish')?.id).toBe('spanish_conversation');
    expect(findPresetForGoal('I want a body recomposition')?.id).toBe('body_recomposition_90day');
    expect(findPresetForGoal('Launch a YouTube channel')?.id).toBe('youtube_12_videos');
    expect(findPresetForGoal('Write a non-fiction book')?.id).toBe('book_30k_words');
    expect(findPresetForGoal('Build a deep work habit')?.id).toBe('deep_work_focus');
    expect(findPresetForGoal('Reach 1200 elo in chess')?.id).toBe('chess_1200_rating');
    expect(findPresetForGoal('Get better at public speaking')?.id).toBe('ted_speech_15min');
    expect(findPresetForGoal('Ship a SaaS to the first paying customer')?.id).toBe('saas_first_customer');
  });
});

describe('over-broad preset patterns', () => {
  it('matches every preset by its exact id and title', () => {
    for (const preset of CERTIFIED_PRESETS) {
      expect(findPresetForGoal(preset.id)?.id, preset.id).toBe(preset.id);
      expect(findPresetForGoal(preset.title)?.id, preset.title).toBe(preset.id);
      expect(findPresetForGoal(preset.title.toUpperCase())?.id, preset.title).toBe(preset.id);
    }
  });

  it('does not treat a non-running "10k" goal as run10k', () => {
    const notRunning = [
      'Get to 10k subscribers',
      'Grow my YouTube channel to 10k subscribers',
      'Reach 10k followers on Instagram',
      'Save $10k',
      'Write 10k words a week',
      'Walk 10k steps a day',
      'Run my agency to 10k MRR',
      'Run a newsletter with 10k readers',
      'Save 10k under 50 days',
      'Hit 10K MRR',
    ];
    for (const goal of notRunning) {
      expect(findPresetForGoal(goal)?.id, goal).not.toBe('run10k');
    }
    // Only the YouTube goal belongs to another preset; the rest are custom goals.
    expect(findPresetForGoal('Grow my YouTube channel to 10k subscribers')?.id).toBe('youtube_12_videos');
    expect(findPresetForGoal('Get to 10k subscribers')).toBeNull();
    expect(findPresetForGoal('Save $10k')).toBeNull();
    expect(findPresetForGoal('Write 10k words a week')).toBeNull();
    expect(findPresetForGoal('Reach 10k followers on Instagram')).toBeNull();
  });

  it('keeps matching real 10K running goals', () => {
    const running = [
      'Run a 10k under 50 minutes',
      'Run a 10K Under 50 Minutes',
      'Run a 10K in under 50 minutes',
      'Run 10k',
      'Run 10 km without stopping',
      'Run 10 kilometers',
      'Running my first 10k',
      'Race a sub-50 10K',
      'Jog a 10k',
      'Finish a 10k race',
      'Complete a 10 km run',
      '10K under 50 minutes',
      '10k under 50',
      'Sub-50 10k',
      'Train for a 10K road race',
    ];
    for (const goal of running) {
      expect(findPresetForGoal(goal)?.id, goal).toBe('run10k');
    }
  });

  it('requires video or chess context next to the YouTube and chess numbers', () => {
    expect(findPresetForGoal('Publish 12 blog posts')).toBeNull();
    expect(findPresetForGoal('Publish 12 research papers this year')).toBeNull();
    expect(findPresetForGoal('Reach a 1200 rating on Codeforces')).toBeNull();
    expect(findPresetForGoal('Rapid improvement in my credit rating')).toBeNull();

    expect(findPresetForGoal('Publish 12 videos')?.id).toBe('youtube_12_videos');
    expect(findPresetForGoal('Publish 12 high-retention videos')?.id).toBe('youtube_12_videos');
    expect(findPresetForGoal('Get to 1200 rapid')?.id).toBe('chess_1200_rating');
    expect(findPresetForGoal('Improve my blitz rating')?.id).toBe('chess_1200_rating');
    expect(findPresetForGoal('Reach 1200 elo')?.id).toBe('chess_1200_rating');
  });

  it('keeps each preset\'s core goals', () => {
    const cases: Array<[string, string]> = [
      ['Learn barre chords', 'guitar5songs'],
      ['Launch my micro-SaaS', 'saas_first_customer'],
      ['Speak Spanish fluently', 'spanish_conversation'],
      ['Lose fat and build muscle', 'body_recomposition_90day'],
      ['Start a YouTube channel', 'youtube_12_videos'],
      ['Finish my manuscript', 'book_30k_words'],
      ['Write 30,000 words of my book', 'book_30k_words'],
      ['Get into a flow state every day', 'deep_work_focus'],
      ['Play chess on lichess', 'chess_1200_rating'],
      ['Overcome stage fright', 'ted_speech_15min'],
    ];
    for (const [goal, id] of cases) {
      expect(findPresetForGoal(goal)?.id, goal).toBe(id);
    }
  });
});
