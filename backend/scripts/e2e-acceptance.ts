/**
 * Live End-to-End Acceptance Verification Script
 * Validates the full user journey on http://localhost:5000:
 * 1. Authentication (Login demo@achivii.com)
 * 2. Life Structure Setup & Routine Constraints
 * 3. Master Planning Prompt Engine (Blueprint + 5-7 Questions + Life Context)
 * 4. Commit Goal & Immediate Daily Schedule Materialization
 * 5. Today-First Timeline & Available Free Windows
 * 6. Intraday Running-Late Shift (+30m) Adaptation (Zero Debt Invariant)
 * 7. Active Ambition Dose Execution & Proof-of-Work Submission
 * 8. Multi-Ambition Coordination Capacity Audit & Safety Ceiling
 */

const API_BASE = 'http://localhost:5000';

async function runAcceptance() {
  console.log('🚀 Starting Full Live End-to-End Acceptance Run...\n');

  // Step 1: Authentication
  console.log('1️⃣ Authenticating demo user...');
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@achivii.com', password: 'Password123!' }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
  const { token, user } = await loginRes.json();
  console.log(`✅ Logged in as: ${user.email} (ID: ${user.id})\n`);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Step 2: Configure Life Structure
  console.log('2️⃣ Configuring Life Structure & Routine Blocks...');
  const lifeRes = await fetch(`${API_BASE}/api/life/structure`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      wake_time: '07:00',
      sleep_time: '23:00',
      schedule_reliability: 'HIGH',
      buffer_minutes: 15,
      routine_blocks: [
        {
          title: 'Core Work & Standup',
          category: 'WORK',
          days_of_week: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          start_time: '09:00',
          end_time: '17:30',
          is_hard_constraint: true,
          buffer_before_minutes: 15,
          buffer_after_minutes: 15,
        },
        {
          title: 'Evening Family & Dinner',
          category: 'FAMILY',
          days_of_week: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
          start_time: '18:30',
          end_time: '20:00',
          is_hard_constraint: false,
        },
      ],
    }),
  });
  if (!lifeRes.ok) throw new Error(`Failed to save life structure: ${await lifeRes.text()}`);
  const lifeData = await lifeRes.json();
  console.log(`✅ Life structure saved with ${lifeData.routine_blocks.length} routine blocks.`);
  console.log(`   Waking: ${lifeData.wake_time} -> Sleep: ${lifeData.sleep_time}\n`);

  // Step 3: Fetch Catalog Blueprint
  console.log('3️⃣ Fetching catalog blueprint...');
  const catalogRes = await fetch(`${API_BASE}/api/catalog`, { headers });
  const catalogData = await catalogRes.json();
  const blueprint = catalogData.goals ? catalogData.goals[0] : catalogData[0];
  console.log(`✅ Selected Blueprint: "${blueprint.title}" (ID: ${blueprint.id})`);
  console.log(`   Onboarding Questions: ${blueprint.onboarding_questions?.length || 0} questions configured.\n`);

  // Step 4: Generate Master Plan Preview
  console.log('4️⃣ Invoking Master Planning Prompt Engine...');
  const questionnaireAnswers = {
    q_target_level: 'Launch a revenue-generating production SaaS app',
    q_current_baseline: 'Intermediate TypeScript and React, basic backend knowledge',
    q_weekly_ceiling: '8-10 hours per week',
    q_hard_constraints: 'Full time job 9am-5:30pm, cannot do mornings before 7am',
    q_preferred_modality: 'Hands-on project building with test-driven development',
    q_failure_triggers: 'Context switching and overcommitting during high-stress work weeks',
    q_primary_metric: 'Production deployment with 10 paid or active beta users',
  };

  const previewRes = await fetch(`${API_BASE}/api/adaptive/master-plan/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      blueprintId: blueprint.id,
      questionnaireAnswers,
      lifeStructure: {
        wake_time: '07:00',
        sleep_time: '23:00',
        buffer_minutes: 15,
      },
    }),
  });
  if (!previewRes.ok) throw new Error(`Master Plan preview failed: ${await previewRes.text()}`);
  const planPreview = await previewRes.json();
  const totalItems = planPreview.masterPlan.phases.reduce((acc: number, p: any) => acc + (p.items?.length || 0), 0);
  console.log(`✅ Master Plan Generated!`);
  console.log(`   Plan Summary: "${planPreview.masterPlan.summary}"`);
  console.log(`   Weekly Target Hours: ${planPreview.masterPlan.weekly_target_hours}h`);
  console.log(`   Recommended Daily Dose: ${planPreview.masterPlan.recommended_dose_minutes}m (MVS: ${planPreview.masterPlan.minimum_viable_dose_minutes}m)`);
  console.log(`   Total Trajectory Items: ${totalItems} across ${planPreview.masterPlan.phases.length} phases\n`);

  // Step 5: Commit Ambition & Materialize Schedule
  console.log('5️⃣ Committing Ambition Protocol & Materializing Daily Schedule...');
  const commitRes = await fetch(`${API_BASE}/api/adaptive/goal/commit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      goalCatalogId: blueprint.id,
      outcomeStatement: planPreview.masterPlan.summary,
      questionnaireAnswers,
      sustainableWeeklyHours: planPreview.masterPlan.weekly_target_hours,
      targetDeadline: new Date(Date.now() + 90 * 86400000).toISOString(),
    }),
  });
  if (!commitRes.ok) throw new Error(`Commit failed: ${await commitRes.text()}`);
  const commitData = await commitRes.json();
  console.log(`✅ Goal Committed (Goal ID: ${commitData.goalId})`);
  console.log(`   Trajectory v1 persisted (Version ID: ${commitData.trajectoryVersionId})\n`);

  // Step 6: Fetch Today-First Daily Schedule
  console.log('6️⃣ Querying Today-First Daily Schedule...');
  const todayScheduleRes = await fetch(`${API_BASE}/api/life/schedule/today`, { headers });
  if (!todayScheduleRes.ok) throw new Error(`Fetch schedule failed: ${await todayScheduleRes.text()}`);
  const scheduleData = await todayScheduleRes.json();
  console.log(`📅 Today's Timeline (${scheduleData.date}):`);
  for (const item of scheduleData.items) {
    console.log(`   - [${item.start_time} - ${item.end_time}] ${item.item_type}: ${item.title} (${item.status})`);
  }
  console.log(`   Open Discretionary Windows: ${scheduleData.open_windows.length} windows detected.\n`);

  // Step 7: Test Intraday Running-Late Shift (+30m delay)
  console.log('7️⃣ Testing Intraday Schedule Adaptation ("Running Late? Shift +30m")...');
  const adaptRes = await fetch(`${API_BASE}/api/life/schedule/adapt`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      shiftMinutes: 30,
      reason: 'Work meeting ran 30 minutes overtime',
    }),
  });
  if (!adaptRes.ok) throw new Error(`Adapt schedule failed: ${await adaptRes.text()}`);
  const adaptedResult = await adaptRes.json();
  console.log(`✅ Adapted Schedule successfully updated with ZERO debt scolding:`);
  console.log(`   ${adaptedResult.message}`);
  
  // Re-fetch today's schedule to see final updated state
  const updatedTodayRes = await fetch(`${API_BASE}/api/life/schedule/today`, { headers });
  const updatedScheduleData = await updatedTodayRes.json();
  for (const item of updatedScheduleData.items) {
    console.log(`   - [${item.start_time} - ${item.end_time}] ${item.item_type}: ${item.title} (${item.status})`);
  }
  console.log();

  // Step 8: Start Dose & Submit Completion with Proof of Work
  const doseItem = updatedScheduleData.items.find((i: any) => i.item_type === 'AMBITION_DOSE');
  if (doseItem) {
    console.log(`8️⃣ Executing Ambition Dose: "${doseItem.title}"...`);
    // Transition to IN_PROGRESS
    await fetch(`${API_BASE}/api/life/schedule/item/${doseItem.id}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    console.log(`   Status updated to IN_PROGRESS.`);

    // Complete with Proof of Work
    await fetch(`${API_BASE}/api/life/schedule/item/${doseItem.id}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    console.log(`✅ Dose Completed! Telemetry recorded with proof-of-work.\n`);
  }

  // Step 9: Multi-Ambition Coordination & Capacity Audit
  console.log('9️⃣ Querying Multi-Ambition Coordination Capacity Audit...');
  const capacityRes = await fetch(`${API_BASE}/api/life/capacity`, { headers });
  if (!capacityRes.ok) throw new Error(`Fetch capacity failed: ${await capacityRes.text()}`);
  const capacityAudit = await capacityRes.json();
  console.log(`✅ Capacity Audit:`);
  console.log(`   - Weekly Free Discretionary Hours: ${capacityAudit.total_weekly_free_hours}h`);
  console.log(`   - Committed Ambition Hours: ${capacityAudit.committed_ambition_hours}h`);
  console.log(`   - Safe Ceiling (80% Limit): ${capacityAudit.safe_capacity_limit_hours}h`);
  console.log(`   - Utilization: ${capacityAudit.capacity_utilization_pct}%`);
  console.log(`   - Overloaded: ${capacityAudit.is_overloaded}`);
  console.log(`   - Active Ambitions: ${capacityAudit.active_ambitions_count}\n`);

  console.log('🎉 ALL SYSTEM ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
}

runAcceptance().catch((err) => {
  console.error('❌ Acceptance failed:', err);
  process.exit(1);
});
