/**
 * Method-aware recovery, M1.2: the 13 domain templates, exactly as in
 * docs/features/method-aware-recovery/reference/domain-templates.md (MR-13, MR-20).
 * Each template already holds the two kinds code adds (RULE-5) and passes `profileFailures`.
 */
import { withFixedKinds, type RecoveryAction, type RecoveryKind, type RecoveryProfile, type ReturnRule, type TemplateId } from './profile.js';

function kind(
  id: string,
  name: string,
  action: RecoveryAction,
  description: string,
  flags: { hard?: boolean; inOrder?: boolean } = {}
): RecoveryKind {
  return { id, name, description, action, hard: flags.hard === true, inOrder: flags.inOrder === true };
}

const CATCH_ALL = 'catch_all';
const catchAll = (action: RecoveryAction): RecoveryKind =>
  kind(CATCH_ALL, 'Catch-all', action, 'Work that fits none of the other kinds.');

const any = (firstWeekBack: string): ReturnRule => ({ breaks: [{ length: 'any', restart: 'last level' }], firstWeekBack });
const byLength = (short: ReturnRule['breaks'][number]['restart'], long: ReturnRule['breaks'][number]['restart'], firstWeekBack: string): ReturnRule => ({
  breaks: [
    { length: '1-2 weeks', restart: short },
    { length: '3+ weeks', restart: long },
  ],
  firstWeekBack,
});

function template(id: TemplateId, kinds: RecoveryKind[], restGapDays: number, returnRule: ReturnRule): RecoveryProfile {
  return withFixedKinds({ version: 1, template: id, kinds, catchAll: CATCH_ALL, restGapDays, returnRule });
}

export const RECOVERY_TEMPLATES: Readonly<Record<TemplateId, RecoveryProfile>> = {
  // 1. Endurance (running, cycling, swimming)
  endurance: template(
    'endurance',
    [
      kind('easy_session', 'Easy session', 'let_go', 'An easy, conversational-pace run, ride or swim.'),
      kind('quality_session', 'Quality session', 'move', 'A harder workout such as intervals or a tempo effort.', { hard: true }),
      kind('long_session', 'Long session', 'move', "The week's longest steady run, ride or swim.", { hard: true }),
      kind('strength_and_mobility', 'Strength and mobility', 'move', 'Strength, core or mobility work that supports the sport.'),
      catchAll('let_go'),
    ],
    1,
    byLength('back 1 week', 'back 2 weeks', 'Easy sessions only, no quality session.')
  ),

  // 2. Strength and body composition
  strength: template(
    'strength',
    [
      kind('strength_workout', 'Strength workout', 'move', 'A resistance-training session from the program, such as workout A or B.', { hard: true, inOrder: true }),
      kind('conditioning', 'Conditioning', 'let_go', 'Walking or light cardio.'),
      kind('nutrition_and_tracking', 'Nutrition and tracking', 'let_go', 'Planning, logging or checking food, protein or body measurements.'),
      kind('mobility', 'Mobility', 'move', 'Stretching or mobility work.'),
      catchAll('move'),
    ],
    1,
    byLength('back 1 week', 'back 2 weeks', 'Loads about 10% lighter than the restart week.')
  ),

  // 3. Language
  language: template(
    'language',
    [
      kind('new_material', 'New material', 'move', 'A new lesson, phrase set or grammar point.', { inOrder: true }),
      kind('daily_speaking', 'Daily speaking', 'let_go', 'Speaking aloud every day, such as shadowing audio or recording a voice note.'),
      kind('review', 'Review', 'let_go', 'Flashcards or spaced review of material already learned.'),
      kind('conversation_or_listening', 'Conversation or listening practice', 'move', 'A conversation, a role-play or a focused listening session.'),
      catchAll('move'),
    ],
    0,
    any("Starts with a review of the last two weeks' material.")
  ),

  // 4. Instrument
  instrument: template(
    'instrument',
    [
      kind('technique_drills', 'Technique drills', 'let_go', 'Short daily drills such as chord changes, scales or rhythm patterns.'),
      kind('new_piece_or_section', 'New piece or section', 'move', 'Learning a new piece or the next section of one.', { inOrder: true }),
      kind('play_through_or_recording', 'Play-through or recording', 'move', 'Playing a piece from start to end, or recording it.'),
      catchAll('move'),
    ],
    0,
    byLength('last level', 'back 1 week', 'Pieces at a slower tempo first.')
  ),

  // 5. Long-form writing
  writing: template(
    'writing',
    [
      kind('drafting', 'Drafting', 'continue', 'Writing new words of the draft.'),
      kind('outlining_and_planning', 'Outlining and planning', 'move', 'Outlining chapters or planning what to write next.', { inOrder: true }),
      kind('revising', 'Revising', 'continue', 'Editing or rewriting words already drafted.'),
      kind('reading_and_research', 'Reading and research', 'let_go', 'Reading or researching for the writing.'),
      catchAll('continue'),
    ],
    0,
    any('The first session starts from a short note on what comes next; never reread earlier pages (closed-door drafting).')
  ),

  // 6. Building a product
  product: template(
    'product',
    [
      kind('build_work', 'Build work', 'continue', 'Building the product: code, design or setup.'),
      kind('customer_conversations_and_outreach', 'Customer conversations and outreach', 'move', 'Talking to users or customers, or reaching out to them.'),
      kind('daily_distribution_sprint', 'Daily distribution sprint', 'let_go', 'A short daily push to share the product, such as posting or community replies.'),
      kind('launch_or_shipping_step', 'Launch or shipping step', 'move', 'A launch or release milestone, such as deploying or opening payments.', { inOrder: true }),
      kind('learning', 'Learning', 'let_go', 'Learning a tool or skill the build needs.'),
      catchAll('continue'),
    ],
    0,
    any('Starts by re-planning the remaining build.')
  ),

  // 7. Studying for an exam
  exam: template(
    'exam',
    [
      kind('new_topic', 'New topic', 'move', 'Studying a topic for the first time.', { inOrder: true }),
      kind('practice_questions', 'Practice questions', 'move', 'Working through practice questions or problems.'),
      kind('review', 'Review', 'let_go', 'Flashcards or spaced review of topics already studied.'),
      kind('mock_exam', 'Mock exam', 'move', 'A timed practice exam.'),
      catchAll('move'),
    ],
    0,
    any('Starts with a review of the last two topics.')
  ),

  // 8. Public speaking
  speaking: template(
    'speaking',
    [
      kind('script_and_structure', 'Script and structure', 'move', 'Writing or shaping the talk: its message, structure or opening.', { inOrder: true }),
      kind('rehearsal', 'Rehearsal', 'move', 'Practising the talk out loud.'),
      kind('recorded_run_through', 'Recorded run-through', 'move', 'Delivering the whole talk on video and reviewing it.'),
      kind('voice_and_delivery_drills', 'Voice and delivery drills', 'let_go', 'Short drills for voice, pace, posture or gestures.'),
      catchAll('move'),
    ],
    0,
    any('Starts with a recorded run-through.')
  ),

  // 9. Creative skill (drawing, design, photography)
  creative: template(
    'creative',
    [
      kind('fundamentals_drill', 'Fundamentals drill', 'let_go', 'A short drill on a basic skill, such as lines, shapes or exposure.'),
      kind('study_or_copy_work', 'Study or copy work', 'move', "Studying or copying another artist's work to learn from it."),
      kind('project_piece', 'Project piece', 'continue', 'Working on your own piece.'),
      catchAll('continue'),
    ],
    0,
    any('Starts with fundamentals.')
  ),

  // 10. Habit and focus
  habit: template(
    'habit',
    [
      kind('daily_focus_block', 'Daily focus block', 'let_go', "The day's focus block or habit session."),
      kind('weekly_planning_or_review', 'Weekly planning or review', 'move', 'Planning the coming week or reviewing the last one.'),
      catchAll('let_go'),
    ],
    0,
    any('Shorter focus blocks.')
  ),

  // 11. Content creation
  content: template(
    'content',
    [
      kind('titles_and_thumbnails', 'Titles and thumbnails', 'move', 'Writing titles and planning thumbnails before anything else.', { inOrder: true }),
      kind('research_and_scripting', 'Research and scripting', 'continue', 'Researching the piece or writing its script.', { inOrder: true }),
      kind('filming', 'Filming', 'move', 'Recording the video or audio.', { inOrder: true }),
      kind('editing', 'Editing', 'continue', 'Editing the recording.', { inOrder: true }),
      kind('publishing', 'Publishing', 'move', 'Uploading and publishing the piece.', { inOrder: true }),
      kind('learning_and_analytics', 'Learning and analytics', 'let_go', 'Studying other creators or your own numbers.'),
      catchAll('continue'),
    ],
    0,
    any('Finishes the piece in progress.')
  ),

  // 12. Strategy games
  strategy_games: template(
    'strategy_games',
    [
      kind('tactics_puzzles', 'Tactics puzzles', 'let_go', 'A daily set of tactics puzzles.'),
      kind('opening_or_theory_study', 'Opening or theory study', 'move', 'Studying an opening, an endgame or other theory.', { inOrder: true }),
      kind('played_game_with_review', 'Played game with its review', 'move', 'Playing a game and reviewing it, as one step.'),
      catchAll('move'),
    ],
    0,
    byLength('last level', 'back 1 week', 'Mostly puzzles and game review.')
  ),

  // 13. General practice (no pathway; the default, MR-13)
  general: template(
    'general',
    [
      kind('practice_session', 'Practice session', 'move', 'Doing the skill itself.'),
      kind('review_or_reflection', 'Review or reflection', 'let_go', 'Looking back at recent practice to see what to change.'),
      kind('project_work', 'Project work', 'continue', 'Working on a longer piece or project.'),
      catchAll('move'),
    ],
    0,
    byLength('last level', 'back 1 week', 'Starts with a short practice session at the last level.')
  ),
};

/** A copy of a template, safe to adjust. */
export function templateProfile(id: TemplateId): RecoveryProfile {
  return structuredClone(RECOVERY_TEMPLATES[id]);
}
