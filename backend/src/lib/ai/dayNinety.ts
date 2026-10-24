/**
 * Checkpoints (RULE-11, RULE-12): the day-90 line, as the goal response sends it and as both prompts are told it. Set only
 * while an accepted checkpoint offer leaves week 12 below the full goal; amounts as the checkpoint card shows them.
 */
export interface DayNinetyLine {
  /** The day-90 target: week 12's target as stored. */
  target: string;
  /** The goal shown: `week12Line`'s goal when safety lowered week 12, else the full goal. */
  goal: string;
}

/** RULE-12: the one line both prompts get after the goal, word for word. */
export function dayNinetyPromptLine(line: DayNinetyLine): string {
  return `Day-90 target: ${line.target} (their goal: ${line.goal}); aim the plan at the day-90 target.`;
}
