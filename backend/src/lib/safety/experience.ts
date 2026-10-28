/**
 * Plan safety limits M3.1 (PSL-20): whether the person says they already lift, read from their answers. Only then do
 * weeks 1 to 3 drop the % of 1RM and reps-in-reserve caps (nothing to failure and no max test still hold). With no clear
 * signal the answer is no: a beginner's caps are the safe default. Pure.
 */
import type { PlanAnswer } from '../ai/roadmap.js';

/** The answer is about lifting: weights, a gym, strength or resistance training. */
const LIFT_CONTEXT = /\b(?:lift|lifts|lifted|lifting|lifter|lifters|weights?|weightlifting|powerlifting|bodybuilding|gym|strength|resistance|barbells?|dumbbells?|squats?|deadlifts?|bench)\b/;

/**
 * The answer claims experience: a level word, regular training, or years of lifting or training. A bare number of years
 * never counts ("I'm 35 years old"); the years must be of the lifting.
 */
const COUNT = String.raw`(?:\d+(?:\.\d+)?\+?|one|two|three|four|five|six|seven|eight|nine|ten|several|many|a few)\s*(?:years?|yrs?)`;
const EXPERIENCE = new RegExp(
  [
    String.raw`\b(?:intermediate|advanced|experienced|consistent|consistently|regularly)\b`,
    String.raw`\bbeen (?:lifting|training|going to the gym)\b`,
    // "for years", "4x a week for 2 years" (the answer is about lifting, so the years are of it)
    String.raw`\bfor (?:years|${COUNT})\b`,
    // "lifting for 3 years", "at the gym 2 years"
    String.raw`\b(?:lifting|lifted|lift|training|trained|train|in the gym|at the gym|gym|weights) (?:for )?${COUNT}\b`,
    // "3 years of lifting", "1+ years lifting experience"
    String.raw`\b${COUNT} (?:of )?(?:lifting|training|experience|strength|in the gym|at the gym|at a gym)\b`,
  ].join('|')
);

/** The answer says they are new: this always wins, so "beginner, 2 years ago I tried the gym" stays a beginner. */
const BEGINNER =
  /\b(?:beginner|beginners|untrained|novice|never (?:lifted|trained|been to (?:a|the) gym)|new to (?:lifting|the gym|weights|strength|training)|no (?:lifting|training|gym|strength) experience|little to no|haven'?t (?:lifted|trained)|not lifted)\b/;

/** Experience that has lapsed ("I lifted 10 years ago but stopped"): strength is lost, so they start like a beginner. */
const LAPSED =
  /\b(?:stopped|quit|used to|years ago|months ago|in (?:college|school|university|high school)|haven'?t (?:lifted|trained|been to (?:a|the) gym) (?:in|for)|coming back|getting back|returning|after a (?:long )?break|out of shape)\b/;

/** A plan, not a fact: "I want to go to the gym regularly", "planning to start lifting". */
const PLAN =
  /\b(?:want|wants|wanting|plan|plans|planning|hope|hoping|would like|going|aim|aiming|try|trying) to\b|\bstart(?:ing)? (?:to )?(?:lift|lifting|training|the gym|going)\b|\bget into\b/;

/** One answer: about lifting, claiming experience, and neither a plan nor a lapse. */
function saysExperienced(answer: string): boolean {
  const text = answer.toLowerCase();
  return LIFT_CONTEXT.test(text) && EXPERIENCE.test(text) && !PLAN.test(text) && !LAPSED.test(text);
}

/** An answer that says they are new, or that their lifting lapsed or is only a plan: any one of these makes it no. */
function saysNewOrLapsed(answer: string): boolean {
  const text = answer.toLowerCase();
  return BEGINNER.test(text) || (LIFT_CONTEXT.test(text) && (LAPSED.test(text) || PLAN.test(text)));
}

/** True when an answer says they already lift and none says they are new to it, have stopped, or only plan to. */
export function isExperiencedLifter(answers: readonly Pick<PlanAnswer, 'answer'>[] | null | undefined): boolean {
  const texts = (answers ?? []).map((item) => (typeof item?.answer === 'string' ? item.answer : '')).filter(Boolean);
  if (texts.some(saysNewOrLapsed)) return false;
  return texts.some(saysExperienced);
}
