import type {
  DetailedStep,
  StepChallenge,
} from '../types';

/**
 * Intelligent Fallback Inference Engine
 * If a task doesn't have an explicit challenge (legacy tasks or custom plans),
 * this automatically classifies the step into the ideal challenge modality.
 */
export function inferStepChallenge(step: DetailedStep): StepChallenge {
  if (step.challenge) {
    return step.challenge;
  }

  const combinedText = `${step.title} ${step.instructions} ${step.focusCue || ''}`.toLowerCase();

  // 1. Repetitions / Sets / Physical / Musical motor drills
  if (/\b(reps|sets|bpm|tempo|scale|chord|hold|run|pushup|squat|drill|rounds|cadence|interval|metronome)\b/i.test(combinedText)) {
    const repMatch = combinedText.match(/(\d+)\s*(reps|times|rounds|seconds|sec)/i);
    const targetCount = repMatch ? parseInt(repMatch[1], 10) : 10;
    const unit = combinedText.includes('hold') || combinedText.includes('second') ? 'seconds' : 'reps';

    return {
      type: 'repetitions',
      drillName: step.title,
      targetCount: Math.min(50, Math.max(3, targetCount)),
      totalSets: 3,
      unit,
    };
  }

  // 2. Active Recall / Cognitive / Languages / Conceptual
  if (/\b(memorize|concept|recall|vocab|definition|understand|formula|rule|why|principle|theory|grammar)\b/i.test(combinedText)) {
    return {
      type: 'active_recall',
      question: `Self-test: What is the core rule or mechanism of "${step.title}"?`,
      hint: step.focusCue || 'Recall the foundational mechanics without looking at the instructions.',
      keyTakeaway: step.instructions,
    };
  }

  // 3. Technical / Coding / Building / Setup deliverables
  if (/\b(build|create|write|setup|install|configure|code|implement|deploy|commit|test|draft|design)\b/i.test(combinedText)) {
    return {
      type: 'checklist',
      items: [
        { id: 'c1', label: `Prepare environment & inspect targets for ${step.title}` },
        { id: 'c2', label: 'Execute core build steps without skipping checks' },
        { id: 'c3', label: 'Audit result and verify zero syntax or mechanical errors' },
      ],
    };
  }

  // 4. Default: Targeted Exercise Challenge
  return {
    type: 'exercise',
    prompt: step.instructions,
    targetDeliverable: step.title,
    evaluationCriteria: step.focusCue || 'Execute with focused concentration and zero rushing.',
  };
}
