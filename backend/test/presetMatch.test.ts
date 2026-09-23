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
