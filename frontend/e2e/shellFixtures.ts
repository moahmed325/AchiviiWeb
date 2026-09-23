import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * A signed-in goal with a real first week, so `/`, `/dashboard` and `/roadmap` render their full content.
 * `clarifiedOutcome` is the Phase 5 kickoff's stored value (ND-18): the shell must show `rawGoal`, never this.
 */
export const SHELL_GOAL_TITLE = 'Build & Ship a SaaS Web App';
export const STORED_OUTCOME = '49.98';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const isoDay = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const steps = JSON.stringify([
  { stepNumber: 1, title: 'Sketch the core screen', durationMinutes: 20, instructions: 'Draw the one screen a user needs first.', focusCue: 'One screen only.' },
  { stepNumber: 2, title: 'List the data it needs', durationMinutes: 25, instructions: 'Write every field that screen shows.', focusCue: 'Fields, not features.' },
]);

export const shellGoal = () => ({
  id: 'g-shell',
  userId: 'u-e2e',
  rawGoal: SHELL_GOAL_TITLE,
  clarifiedOutcome: STORED_OUTCOME,
  methodologyNotes: '',
  status: 'active',
  startDate: `${isoDay(-2)}T00:00:00.000Z`,
  targetDate: `${isoDay(88)}T00:00:00.000Z`,
  currentWeek: 1,
  answers: '{}',
  routine: '{}',
  created_at: `${isoDay(-2)}T00:00:00.000Z`,
  updated_at: `${isoDay(-2)}T00:00:00.000Z`,
  roadmapWeeks: [
    {
      id: 'w1',
      goalId: 'g-shell',
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Find the smallest product',
      objective: 'Decide what the first version does.',
      keyMilestone: 'A one-page product brief',
      targetIntensity: 3,
      plannedMinutes: 270,
      status: 'active',
      created_at: `${isoDay(-2)}T00:00:00.000Z`,
    },
  ],
  dailyTasks: DAYS.map((dayOfWeek, index) => ({
    id: `t${index + 1}`,
    goalId: 'g-shell',
    weekNumber: 1,
    dayNumber: index + 1,
    date: isoDay(index - 2),
    dayOfWeek,
    title: index === 2 ? 'Write the one-page product brief' : `Session ${index + 1}`,
    detailedSteps: steps,
    implementationIntention: '',
    durationMinutes: 45,
    isRestDay: index === 6,
    status: index < 2 ? 'completed' : 'pending',
    created_at: `${isoDay(-2)}T00:00:00.000Z`,
  })),
});

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Every violation on the page as `rule: target`, so a before and after can be compared line by line.
 *
 * axe measures `target-size` where the page is scrolled now, so a control that happens to sit under the sticky bottom
 * bar counts as obscured. Each such node is checked again scrolled to the middle of the viewport; only a control that
 * is still too small there is reported.
 */
export const axeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const found: string[] = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const target = node.target.join(' ');
      if (violation.id === 'target-size' && node.target.length === 1) {
        const selector = String(node.target[0]);
        const scrollY = await page.evaluate(() => window.scrollY);
        await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const again = await new AxeBuilder({ page }).include(selector).withRules(['target-size']).analyze();
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        if (again.violations.length === 0) continue;
      }
      found.push(`${violation.id}: ${target}`);
    }
  }
  return found;
};

export const documentOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
