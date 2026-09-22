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
