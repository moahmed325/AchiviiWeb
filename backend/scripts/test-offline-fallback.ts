import {
  clarifyGoalWithAI,
  generate12WeekPlanWithAI,
  findPresetForGoal
} from '../src/lib/ai/goalDecomposer.js';

async function runOfflineFallbackVerification() {
  console.log('================================================================================');
  console.log('🧪 VERIFICATION: SIMPLIFIED DETERMINISTIC FALLBACK UNDER FORCED DUAL FAILURE');
  console.log('================================================================================\n');

  // Save current env
  const savedGroqKey = process.env.GROQ_API_KEY;
  const savedGeminiKey = process.env.GEMINI_API_KEY;

  try {
    // --------------------------------------------------------------------------
    // Test Condition: Force Dual Provider Failure (Both Groq and Gemini Disabled)
    // --------------------------------------------------------------------------
    process.env.GROQ_API_KEY = '';
    process.env.GEMINI_API_KEY = '';

    console.log('1️⃣  TESTING CUSTOM GOAL (Forced Dual Failure: Both Groq & Gemini Unset)');
    console.log('   Goal: "Bake artisanal French sourdough bread"');

    // Step 1: Clarification Attempt
    let customClarificationError: string | null = null;
    try {
      await clarifyGoalWithAI('Bake artisanal French sourdough bread');
    } catch (err: any) {
      customClarificationError = err.message;
    }

    console.log(`   [Clarify] Error Thrown: "${customClarificationError}"`);
    if (customClarificationError && customClarificationError.includes('Unable to analyze your goal right now')) {
      console.log('   ✅ PASS: Custom goal clarification honestly failed with retry prompt (no generic plan fabricated).');
    } else {
      console.error('   ❌ FAIL: Custom goal clarification did not throw expected error.');
      process.exit(1);
    }

    // Step 2: 12-Week Plan Generation Attempt
    let customPlanError: string | null = null;
    try {
      await generate12WeekPlanWithAI(
        'Bake artisanal French sourdough bread',
        'Bake artisanal French sourdough bread in 90 Days',
        {},
        { dailyMinutes: 60, preferredSlot: 'morning', planVariant: 'steady' },
        new Date('2026-10-01')
      );
    } catch (err: any) {
      customPlanError = err.message;
    }

    console.log(`   [Plan Gen] Error Thrown: "${customPlanError}"`);
    if (customPlanError && customPlanError.includes('Unable to generate your 12-week plan right now')) {
      console.log('   ✅ PASS: Custom goal plan generation honestly failed with retry prompt (no generic weeks/tasks fabricated).');
    } else {
      console.error('   ❌ FAIL: Custom goal plan generation did not throw expected error.');
      process.exit(1);
    }

    console.log('\n2️⃣  TESTING CERTIFIED PRESET FALLBACK (Offline Seed Behavior Verification)');
    console.log('   Preset Goal: "Play 5 iconic guitar songs from memory" (guitar5songs)');

    // Step 1: Preset Clarification
    const presetClarification = await clarifyGoalWithAI('Play 5 iconic guitar songs from memory');
    console.log(`   [Preset Clarify] Outcome: "${presetClarification.clarifiedOutcome}"`);
    console.log(`   [Preset Clarify] Primary Domain: "${presetClarification.primaryDomain}"`);
    console.log(`   [Preset Clarify] Canonical Key: "${presetClarification.canonicalKey}"`);

    if (
      presetClarification.primaryDomain.includes('Acoustic Guitar') &&
      presetClarification.canonicalKey === 'music.guitar.acoustic_songs'
    ) {
      console.log('   ✅ PASS: Preset clarification returned hand-crafted certified curriculum blueprint.');
    } else {
      console.error('   ❌ FAIL: Preset clarification unexpected output.');
      process.exit(1);
    }

    // Step 2: Preset 12-Week Plan Generation
    const presetPlan = await generate12WeekPlanWithAI(
      'Play 5 iconic guitar songs from memory',
      presetClarification.clarifiedOutcome,
      { baseline: 'Complete beginner' },
      { dailyMinutes: 30, preferredSlot: 'morning', planVariant: 'steady' },
      new Date('2026-10-01')
    );

    console.log(`   [Preset Plan] Weeks count: ${presetPlan.weeks.length}`);
    console.log(`   [Preset Plan] Week 4 Gate: "${presetPlan.weeks[3].keyMilestone}"`);
    console.log(`   [Preset Plan] Week 1 Tasks count: ${presetPlan.initialTasks.length}`);
    console.log(`   [Preset Plan] Day 1 Task Title: "${presetPlan.initialTasks[0].title}"`);
    console.log(`   [Preset Plan] Day 1 Drill 1: "${presetPlan.initialTasks[0].detailedSteps[0].title}" (${presetPlan.initialTasks[0].detailedSteps[0].layer})`);

    if (
      presetPlan.weeks.length === 12 &&
      presetPlan.initialTasks.length === 7 &&
      presetPlan.initialTasks[0].detailedSteps.length > 0 &&
      presetPlan.initialTasks[0].detailedSteps[0].challenge.type === 'repetitions'
    ) {
      console.log('   ✅ PASS: Preset deterministic fallback produced full pre-validated 12-week periodization and Week 1 schedule with Wonderwall precision.');
    } else {
      console.error('   ❌ FAIL: Preset plan generation unexpected output.');
      process.exit(1);
    }

    console.log('\n================================================================================');
    console.log('🎉 ALL FALLBACK VERIFICATIONS COMPLETED SUCCESSFULLY');
    console.log('================================================================================');
  } finally {
    process.env.GROQ_API_KEY = savedGroqKey;
    process.env.GEMINI_API_KEY = savedGeminiKey;
  }
}

runOfflineFallbackVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
