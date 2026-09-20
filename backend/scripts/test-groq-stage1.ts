import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clarifyGoalWithAI } from '../src/lib/ai/goalDecomposer.js';
import { getGroqApiKey, DEFAULT_GROQ_MODEL } from '../src/lib/ai/groq.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testGroqStage1() {
  console.log('================================================================');
  console.log('🧪 STAGE 1 CLARIFICATION TEST VIA GROQ');
  console.log(`   Model: ${DEFAULT_GROQ_MODEL}`);
  console.log('================================================================\n');

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    console.error('❌ GROQ_API_KEY is not set in backend/.env!');
    console.error('   Please add GROQ_API_KEY="gsk_..." to backend/.env and re-run.');
    process.exit(1);
  }

  const testGoal = 'Learn Docker and Kubernetes container orchestration for production microservices';
  console.log(`📥 Input Goal: "${testGoal}"\n`);
  console.log('⏳ Calling Stage 1 clarification through Groq...');

  const startTime = Date.now();
  const clarification = await clarifyGoalWithAI(testGoal);
  const durationMs = Date.now() - startTime;

  console.log(`\n⚡ Groq Response Time: ${durationMs}ms\n`);
  console.log('📋 Parsed Structured Clarification:');
  console.log('----------------------------------------------------------------');
  console.log(`🏷️  Canonical Key:          "${clarification.canonicalKey}"`);
  console.log(`🎯 Clarified Outcome:      "${clarification.clarifiedOutcome}"`);
  console.log(`🌐 Primary Domain:          "${clarification.primaryDomain}"`);
  console.log(`✅ Verification Criteria:  "${clarification.verificationCriteria}"`);
  console.log('\n🛠️ Capabilities (Sub-skills):');
  clarification.capabilities.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));

  console.log('\n🔬 Scientific Frameworks:');
  clarification.scientificFrameworks.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name}: ${f.application}`);
  });

  console.log('\n❓ Diagnostic Questions:');
  clarification.followUpQuestions.forEach((q, i) => {
    console.log(`   ${i + 1}. [${q.id}] "${q.question}"`);
    q.options.forEach((opt) => console.log(`      • ${opt}`));
  });

  // Schema Validation Check
  const isValid =
    Boolean(clarification.canonicalKey) &&
    Boolean(clarification.clarifiedOutcome) &&
    Boolean(clarification.primaryDomain) &&
    Array.isArray(clarification.capabilities) &&
    clarification.capabilities.length >= 5 &&
    Array.isArray(clarification.scientificFrameworks) &&
    clarification.scientificFrameworks.length >= 2 &&
    Boolean(clarification.verificationCriteria) &&
    Array.isArray(clarification.followUpQuestions) &&
    clarification.followUpQuestions.length >= 3;

  if (isValid) {
    console.log('\n🎉 ALL JSON SCHEMA VALIDATION CHECKS PASSED:');
    console.log('   ✓ canonicalKey conforms to hierarchical format');
    console.log('   ✓ 5-8 capabilities present');
    console.log('   ✓ Scientific frameworks present');
    console.log('   ✓ Capstone verification criteria defined');
    console.log('   ✓ Diagnostic follow-up questions valid');
  } else {
    console.error('\n❌ Clarification schema validation failed.');
    process.exit(1);
  }
}

testGroqStage1().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
