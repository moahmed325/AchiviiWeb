/**
 * Method-aware recovery M2.2, step 3: writes answers.json, the hand-written correct profile for each eval goal.
 * Each answer starts from its template and changes it only where the goal clearly needs it, with one `why` per
 * change. Aliases are other ids or names that mean the same kind (MR-24 point 4). Every answer must pass
 * `profileFailures` with the goal's deliverable fact. Run once, before any profile call:
 *
 *   npx tsx scripts/recovery-eval/build-answers.ts
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { EVAL_DIR, loadGoals, readJson } from './goals.js';
import type { RoadmapEntry } from './run.js';
import type { AnswerKind, EvalAnswer } from './score.js';
import { isDeliverableTarget, profileFailures, templateProfile, type RecoveryProfile } from '../../src/lib/recovery/index.js';

type Edit = (profile: EvalAnswer['profile'], change: (change: string, why: string) => void) => void;

const kind = (profile: EvalAnswer['profile'], id: string): AnswerKind => {
  const found = profile.kinds.find((item) => item.id === id);
  if (!found) throw new Error(`No kind ${id} in ${profile.template}.`);
  return found;
};
const alias = (profile: EvalAnswer['profile'], id: string, aliases: string[]) => {
  kind(profile, id).aliases = aliases;
};
const DELIVERABLE_WHY = 'week 12 is a deliverable, so the catch-all continues (RULE-4 for a model-made profile)';
const continueCatchAll: Edit = (p, change) => {
  kind(p, 'catch_all').action = 'continue';
  change('catch_all: move -> continue', DELIVERABLE_WHY);
};
const highLoad = (ids: string[], why: string): Edit => (p, change) => {
  for (const id of ids) kind(p, id).highLoad = true;
  change(`${ids.join(', ')}: high-load`, why);
};
const remove = (id: string, why: string): Edit => (p, change) => {
  p.kinds = p.kinds.filter((item) => item.id !== id);
  change(`removed ${id}`, why);
};
const add = (item: AnswerKind, why: string): Edit => (p, change) => {
  const catchAllAt = p.kinds.findIndex((k) => k.id === p.catchAll);
  p.kinds.splice(catchAllAt, 0, item);
  change(`added ${item.id} (${item.action})`, why);
};
const aliases = (map: Record<string, string[]>): Edit => (p) => {
  for (const [id, list] of Object.entries(map)) alias(p, id, list);
};

const ENDURANCE_ALIASES = aliases({
  easy_session: ['easy ride', 'easy row', 'recovery ride', 'easy aerobic session', 'zone 2 session'],
  quality_session: ['intervals', 'interval session', 'tempo session', 'hard session'],
  long_session: ['long ride', 'long row', 'long steady session'],
  strength_and_mobility: ['strength', 'mobility', 'cross-training'],
});
const STRENGTH_ALIASES = aliases({ strength_workout: ['strength session', 'lifting session', 'pull-up workout', 'training session'] });

const EDITS: Record<string, Edit[]> = {
  'endurance-1': [highLoad(['quality_session', 'long_session'], 'hard and long rides are physical strain'), ENDURANCE_ALIASES],
  'endurance-5': [highLoad(['quality_session', 'long_session'], 'hard and long rows are physical strain'), ENDURANCE_ALIASES],
  'strength-1': [highLoad(['strength_workout'], 'heavy deadlifts are physical strain'), STRENGTH_ALIASES],
  'strength-2': [
    highLoad(['strength_workout'], 'pull-up sets to near failure are physical strain'),
    remove('nutrition_and_tracking', 'a pull-up goal has no nutrition work; nothing in the goal or method tracks food'),
    remove('conditioning', 'the method is pull-up sessions only, with no walking or cardio'),
    STRENGTH_ALIASES,
  ],
  'language-3': [aliases({ new_material: ['audio lesson', 'lesson'], conversation_or_listening: ['conversation practice', 'speaking practice'] })],
  'language-2': [continueCatchAll, aliases({ new_material: ['audio lesson', 'lesson'], conversation_or_listening: ['conversation practice', 'role-play'] })],
  'instrument-1': [continueCatchAll, aliases({ new_piece_or_section: ['new section', 'section work'], play_through_or_recording: ['play-through', 'run-through'] })],
  'instrument-3': [continueCatchAll, aliases({ new_piece_or_section: ['new tune', 'new standard', 'melody learning'], play_through_or_recording: ['play-through', 'play-along'] })],
  'writing-1': [aliases({ drafting: ['writing session', 'new words'] })],
  'writing-2': [aliases({ drafting: ['writing pages', 'new pages'] })],
  'product-5': [aliases({ build_work: ['template building', 'product work'], customer_conversations_and_outreach: ['outreach', 'marketing outreach'] })],
  'product-6': [aliases({ build_work: ['coding', 'development'], customer_conversations_and_outreach: ['user interviews', 'customer interviews'] })],
  'exam-3': [aliases({ new_topic: ['new domain', 'video lesson'], mock_exam: ['practice exam', 'practice test'] })],
  'exam-2': [aliases({ new_topic: ['new concept', 'lesson'], mock_exam: ['practice test', 'full-length practice section'] })],
  'speaking-1': [continueCatchAll, aliases({ rehearsal: ['practice run', 'out-loud practice'] })],
  'speaking-2': [continueCatchAll, aliases({ rehearsal: ['practice run', 'timed run-through'] })],
  'creative-1': [aliases({ fundamentals_drill: ['warm-up drills', 'structure drills'], study_or_copy_work: ['study', 'master copy'], project_piece: ['portrait', 'full portrait'] })],
  'creative-2': [aliases({ fundamentals_drill: ['camera settings drill', 'exposure drill'], project_piece: ['photo outing', 'shoot', 'landscape shoot'] })],
  'habit-1': [aliases({ daily_focus_block: ['meditation session', 'daily meditation', 'daily practice'] })],
  'habit-2': [aliases({ daily_focus_block: ['journaling session', 'daily journaling', 'daily practice'] })],
  'content-1': [
    add(
      { id: 'guest_outreach', name: 'Guest outreach', description: 'Finding, contacting and booking guests for interviews.', action: 'move', hard: false, inOrder: false, aliases: ['guest booking', 'booking guests', 'outreach'] },
      'an interview podcast needs guests booked; the method says never to skip guest outreach'
    ),
    aliases({ titles_and_thumbnails: ['titles and artwork', 'episode titles'], filming: ['recording', 'record episode', 'recording the interview'] }),
  ],
  'content-2': [aliases({ titles_and_thumbnails: ['hooks', 'hook writing', 'hooks and titles'], research_and_scripting: ['recipe planning', 'scripting'] })],
  'strategy_games-1': [aliases({ tactics_puzzles: ['life and death problems', 'tsumego', 'go problems'], opening_or_theory_study: ['joseki', 'opening study'], played_game_with_review: ['game and review', 'played game and review'] })],
  'strategy_games-2': [
    remove('tactics_puzzles', 'real-time strategy has no puzzles; its daily drill is mechanics'),
    add(
      { id: 'mechanics_drills', name: 'Mechanics drills', description: 'Short drills for build orders, macro cycles and hotkeys against the AI or in a custom map.', action: 'let_go', hard: false, inOrder: false, aliases: ['macro drills', 'build order drills', 'mechanics practice'] },
      'the daily drill for real-time strategy; like puzzles, a missed one is not made up'
    ),
    aliases({ opening_or_theory_study: ['build order study', 'strategy study'], played_game_with_review: ['ladder game and review', 'ranked game and review', 'replay review'] }),
  ],
  'general-1': [
    continueCatchAll,
    add(
      { id: 'starter_care', name: 'Starter feeding', description: 'The daily feeding of the sourdough starter.', action: 'let_go', hard: false, inOrder: false, aliases: ['starter maintenance', 'feeding the starter'] },
      'the method feeds the starter every day; a missed feeding is not made up'
    ),
    aliases({ practice_session: ['bake', 'baking session', 'practice bake'] }),
  ],
  'general-2': [aliases({ practice_session: ['solve practice', 'timed solves', 'F2L practice'], review_or_reflection: ['time review'] })],
};

const goals = loadGoals();
const roadmaps = readJson<RoadmapEntry[]>('roadmaps.json');
const answers: EvalAnswer[] = [];
for (const goal of goals) {
  const entry = roadmaps.find((item) => item.goalId === goal.id);
  if (!entry) throw new Error(`No roadmap for ${goal.id}.`);
  const profile = templateProfile(goal.template) as EvalAnswer['profile'];
  const changes: EvalAnswer['changes'] = [];
  for (const edit of EDITS[goal.id] ?? []) edit(profile, (change, why) => changes.push({ change, why }));
  const deliverableGoal = isDeliverableTarget(entry.profileInput.weeklyTargets[11]);
  const failures = profileFailures(profile as RecoveryProfile, { deliverableGoal });
  if (failures.length) throw new Error(`${goal.id} fails its checks: ${failures.join(' ')}`);
  answers.push({ goalId: goal.id, template: goal.template, profile, changes });
}
writeFileSync(path.join(EVAL_DIR, 'answers.json'), `${JSON.stringify(answers, null, 2)}\n`, 'utf8');
console.log(`answers.json: ${answers.length} answers, ${answers.filter((a) => a.changes.length).length} changed from their template.`);
