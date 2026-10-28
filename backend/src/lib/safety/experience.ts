/**
 * Plan safety limits M3.1 (PSL-20): whether the person says they already lift, read from their answers. Only then do
 * weeks 1 to 3 drop the % of 1RM and reps-in-reserve caps (nothing to failure and no max test still hold). With no clear
 * signal the answer is no: a beginner's caps are the safe default. Pure.
 */
import type { PlanAnswer } from '../ai/roadmap.js';

/** The answer is about lifting: weights, a gym, strength or resistance training. */
const LIFT_CONTEXT = /\b(?:lift|lifts|lifted|lifting|lifter|lifters|weights?|weightlifting|powerlifting|bodybuilding|gym|strength|resistance|barbells?|dumbbells?|squats?|deadlifts?|bench)\b/;

/** The answer claims experience: a level word, regular training or years of it. */
const EXPERIENCE =
  /\b(?:intermediate|advanced|experienced|consistent|consistently|regularly|for years|been lifting|(?:\d+(?:\.\d+)?\+?|one|two|three|four|five|six|seven|eight|nine|ten|several|many|a few)\s*(?:years?|yrs?)\b)/;

/** The answer says they are new: this always wins, so "beginner, 2 years ago I tried the gym" stays a beginner. */
const BEGINNER =
  /\b(?:beginner|beginners|untrained|novice|never (?:lifted|trained|been to (?:a|the) gym)|new to (?:lifting|the gym|weights|strength|training)|no (?:lifting|training|gym|strength) experience|little to no|haven'?t (?:lifted|trained)|not lifted)\b/;

/** Experience that has lapsed ("I lifted 10 years ago but stopped"): strength is lost, so they start like a beginner. */
const LAPSED =
  /\b(?:stopped|quit|used to|years ago|months ago|in (?:college|school|university|high school)|haven'?t (?:lifted|trained|been to (?:a|the) gym) (?:in|for)|coming back|getting back|returning|after a (?:long )?break|out of shape)\b/;

/** One answer: about lifting, claiming experience, and not saying they are new or have stopped. */
function saysExperienced(answer: string): boolean {
  const text = answer.toLowerCase();
  return LIFT_CONTEXT.test(text) && EXPERIENCE.test(text) && !BEGINNER.test(text) && !LAPSED.test(text);
}

/** True when an answer says they already lift and none says they are new to it. */
export function isExperiencedLifter(answers: readonly Pick<PlanAnswer, 'answer'>[] | null | undefined): boolean {
  const texts = (answers ?? []).map((item) => (typeof item?.answer === 'string' ? item.answer : '')).filter(Boolean);
  if (texts.some((text) => BEGINNER.test(text.toLowerCase()))) return false;
  return texts.some(saysExperienced);
}
