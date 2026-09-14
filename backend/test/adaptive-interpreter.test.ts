import { describe, it, expect } from 'vitest';
import { heuristicInterpretAnswers } from '../src/lib/adaptive/core/answerInterpreter';

describe('Onboarding Answer Interpreter Engine', () => {
  it('correctly sums compound hours mentioned in notes (e.g. 2h Sat + 3h Sun = 5.0h)', () => {
    const profile = heuristicInterpretAnswers({
      goalTitle: 'Run a 10K / Half-Marathon',
      domain: 'PHYSICAL',
      questionnaireAnswers: {
        current_running_baseline: '5km',
        weekly_run_cadence: 'I can only do 2 hours on Saturday and 3 hours on Sunday',
      },
      defaultWeeklyHours: 6,
    });

    expect(profile.suggestedWeeklyHours).toBe(5);
    expect(profile.detectedConstraints).toContain('weekend_clustered_schedule');
  });

  it('detects injuries and adapts scaffolding to low-impact tendon care', () => {
    const profile = heuristicInterpretAnswers({
      goalTitle: 'Run a 10K / Half-Marathon',
      domain: 'PHYSICAL',
      questionnaireAnswers: {
        current_running_baseline: 'Had a bad knee sprain recently, so starting slow',
        weekly_run_cadence: '4 hours / week',
      },
      defaultWeeklyHours: 5,
    });

    expect(profile.detectedConstraints).toContain('injury_protection');
    expect(profile.interpretedScaffolding).toContain('Low-impact');
  });

  it('safely falls back to default hours when no numbers are present', () => {
    const profile = heuristicInterpretAnswers({
      goalTitle: 'Build a SaaS MVP',
      domain: 'PROJECT',
      questionnaireAnswers: {
        weekly_builder_bandwidth: 'I will build whenever I have free time',
      },
      defaultWeeklyHours: 7,
    });

    expect(profile.suggestedWeeklyHours).toBe(7);
  });
});
