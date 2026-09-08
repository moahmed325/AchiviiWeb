import { prisma } from './prisma.js';
import { generateStructuredContent } from './ai/gemini.js';

export interface RoadmapVariant {
  name: string;
  description: string;
  trade_offs: string;
  days_per_week: number;
  daily_minutes_variance: number;
  phase_emphasis: Record<string, number>;
}

export interface UserConstraints {
  availableDaysCount: number; // number of days per week with at least some availability
  maxSessionDurationMinutes: number; // maximum duration permitted
  minSessionDurationMinutes: number; // minimum duration permitted
  catalogTitle: string;
  phases: { title: string; order: number; defaultDuration: number }[];
}

/**
 * Validates a Planner roadmap variant against user routine constraints.
 * Decision Log D10: Reject invalid parameters rather than silently clamping.
 */
export function validateRoadmapVariant(
  variant: RoadmapVariant,
  constraints: UserConstraints
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!variant.name || typeof variant.name !== 'string') {
    errors.push('Roadmap variant must have a valid name.');
  }
  if (!variant.description || typeof variant.description !== 'string') {
    errors.push('Roadmap variant must have a valid description.');
  }
  if (!variant.trade_offs || typeof variant.trade_offs !== 'string') {
    errors.push('Roadmap variant must declare explicit trade-offs.');
  }

  // Days per week validation
  if (typeof variant.days_per_week !== 'number' || variant.days_per_week < 2 || variant.days_per_week > 6) {
    errors.push(`days_per_week must be an integer between 2 and 6. Got ${variant.days_per_week}`);
  } else if (variant.days_per_week > constraints.availableDaysCount) {
    errors.push(
      `days_per_week (${variant.days_per_week}) exceeds user's available days (${constraints.availableDaysCount}).`
    );
  }

  // Duration variance validation
  if (typeof variant.daily_minutes_variance !== 'number') {
    errors.push('daily_minutes_variance must be a number.');
  } else {
    // Session duration must remain within bounds
    const baseDuration = constraints.phases[0]?.defaultDuration || 60;
    const effectiveDuration = baseDuration + variant.daily_minutes_variance;
    if (effectiveDuration < constraints.minSessionDurationMinutes) {
      errors.push(`Resulting session duration (${effectiveDuration}m) is below minimum of ${constraints.minSessionDurationMinutes}m.`);
    }
    if (effectiveDuration > constraints.maxSessionDurationMinutes) {
      errors.push(`Resulting session duration (${effectiveDuration}m) exceeds maximum cap of ${constraints.maxSessionDurationMinutes}m.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deterministic fallback roadmap variants tailored to user constraints.
 */
export function getDeterministicFallbackRoadmaps(constraints: UserConstraints): RoadmapVariant[] {
  const maxDays = Math.min(6, Math.max(2, constraints.availableDaysCount));
  const phaseMap: Record<string, number> = {};
  constraints.phases.forEach((p) => {
    phaseMap[p.title] = 1.0;
  });

  const variants: RoadmapVariant[] = [
    {
      name: 'Steady & Balanced',
      description: `Spreads sessions evenly across ${Math.min(4, maxDays)} days per week with standard durations.`,
      trade_offs: 'Predictable cadence that fits regular schedules without overloading weekends.',
      days_per_week: Math.min(4, maxDays),
      daily_minutes_variance: 0,
      phase_emphasis: { ...phaseMap },
    },
    {
      name: 'Focused Momentum',
      description: `Concentrated pacing across ${Math.min(3, maxDays)} days with slightly deeper session blocks.`,
      trade_offs: 'Fewer training days with more rest days in between, but requires longer uninterrupted focus blocks.',
      days_per_week: Math.min(3, maxDays),
      daily_minutes_variance: 15,
      phase_emphasis: { ...phaseMap },
    },
    {
      name: 'Frequent Micro-Habits',
      description: `Lighter sessions spread across ${Math.min(5, maxDays)} days per week.`,
      trade_offs: 'Very low daily friction, but requires showing up almost every day of the week.',
      days_per_week: Math.min(5, maxDays),
      daily_minutes_variance: -15,
      phase_emphasis: { ...phaseMap },
    },
  ];

  return variants;
}

/**
 * Generates 2–3 structured roadmap variants for a goal instance.
 * Calls Google Gemini (structured JSON) with automatic validation and deterministic fallback.
 */
export async function generateRoadmapVariants(userGoalId: string): Promise<RoadmapVariant[]> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      user: {
        include: { availability_slots: true },
      },
      goal_catalog: {
        include: {
          phases: {
            orderBy: { phase_order: 'asc' },
            include: { task_templates: true },
          },
        },
      },
    },
  });

  if (!userGoal || !userGoal.goal_catalog) {
    throw new Error(`UserGoal ${userGoalId} not found`);
  }

  // Compute user routine constraints
  const busyDays = new Set(userGoal.user.availability_slots.map((s) => s.day_of_week));
  // Mon-Sat (6 days) + Sunday free = 7 days total potential, but let's see available days
  // If user has busy slots on day X, day X may still have free time, but Sunday is always free.
  // Count distinct available days:
  const availableDaysCount = Math.max(3, 7 - Math.floor(busyDays.size / 2));

  const defaultDuration =
    userGoal.goal_catalog.phases[0]?.task_templates[0]?.session_duration_minutes || 60;

  const constraints: UserConstraints = {
    availableDaysCount,
    maxSessionDurationMinutes: 120,
    minSessionDurationMinutes: 15,
    catalogTitle: userGoal.goal_catalog.title,
    phases: userGoal.goal_catalog.phases.map((p) => ({
      title: p.title,
      order: p.phase_order,
      defaultDuration: p.task_templates[0]?.session_duration_minutes || defaultDuration,
    })),
  };

  const systemInstruction = `You are the Achivii Planner AI. Your sole responsibility is to generate 2 to 3 differentiated, structured roadmap variants for a user's 3-month goal plan.
CRITICAL RULES (Decision Log D5/D9/D10):
1. Output ONLY a valid JSON array of RoadmapVariant objects.
2. Never invent raw task descriptions, calendar dates, or schedule times.
3. Every variant must provide numeric parameters that modulate deterministic scheduling:
   - name: String (concise, inspiring roadmap title)
   - description: String (1-line overview)
   - trade_offs: String (honest pros & cons)
   - days_per_week: Integer (between 2 and ${constraints.availableDaysCount})
   - daily_minutes_variance: Integer (e.g. -15, 0, or 15)
   - phase_emphasis: Object mapping phase names to float multiplier (e.g. 1.0, 1.2)
4. Validate that days_per_week <= ${constraints.availableDaysCount}.`;

  const prompt = `Goal: "${constraints.catalogTitle}"
User Available Days: ${constraints.availableDaysCount} days/week
Base Session Duration: ${defaultDuration} minutes
Phases: ${constraints.phases.map((p) => p.title).join(', ')}

Generate 3 diverse roadmap variants (e.g. balanced, high-intensity/fewer days, frequent/bite-sized).`;

  // Attempt Gemini structured call
  const result = await generateStructuredContent<{ variants: RoadmapVariant[] } | RoadmapVariant[]>(
    prompt,
    systemInstruction
  );

  let rawVariants: RoadmapVariant[] = [];
  if (result.success && result.data) {
    if (Array.isArray(result.data)) {
      rawVariants = result.data;
    } else if (Array.isArray((result.data as any).variants)) {
      rawVariants = (result.data as any).variants;
    } else if (Array.isArray((result.data as any).roadmaps)) {
      rawVariants = (result.data as any).roadmaps;
    }
  }

  // Validate all returned variants against constraints
  const validatedVariants: RoadmapVariant[] = [];
  for (const v of rawVariants) {
    const check = validateRoadmapVariant(v, constraints);
    if (check.valid) {
      validatedVariants.push(v);
    } else {
      console.warn(`[Planner] Rejected variant "${v.name}" on constraint violations:`, check.errors);
    }
  }

  // If at least 2 variants passed validation, use them!
  if (validatedVariants.length >= 2) {
    return validatedVariants.slice(0, 3);
  }

  // Fallback to deterministic pre-validated variants
  return getDeterministicFallbackRoadmaps(constraints);
}
