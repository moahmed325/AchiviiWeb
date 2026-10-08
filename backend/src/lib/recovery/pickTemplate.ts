/**
 * Method-aware recovery, M1.2: the keyword table that picks a template with no model call (RULE-3, MR-13, MR-14).
 * Pure. A match in the clarify domain counts most, then the goal text, then the method name; the template with the
 * highest score wins, ties going to the earlier template. Nothing matches: General practice.
 */
import type { TemplateId } from './profile.js';

/** Order matters only for ties. General practice has no keywords: it is the default. */
const KEYWORDS: ReadonlyArray<[TemplateId, RegExp[]]> = [
  ['endurance', [/\brun(s|ning|ner)?\b/, /\b(5|10|21|42)\s?k\b/, /\bmarathon\b/, /\bendurance\b/, /\bcycl(e|ing|ist)\b/, /\bswim(ming)?\b/, /\btriathlon\b/, /\bjog(ging)?\b/]],
  ['strength', [/\bbody\s?fat\b/, /\bmuscle\b/, /\bstrength\b/, /\blift(ing)?\b/, /\bgym\b/, /\b(squat|deadlift|bench press)\b/, /\brecomp/, /\bfat loss\b/, /\blose weight\b/, /\bweight ?loss\b/, /\bhypertrophy\b/, /\b(push|pull)[- ]?ups?\b/, /\bphysique\b/]],
  ['language', [/\blanguage\b/, /\bfluen(t|cy)\b/, /\b(spanish|french|german|italian|portuguese|japanese|mandarin|chinese|korean|arabic|russian|hindi|dutch|turkish)\b/]],
  ['instrument', [/\binstrument\b/, /\b(guitar|piano|violin|drums?|ukulele|bass guitar|cello|saxophone|flute|trumpet)\b/, /\bsing(ing)?\b/]],
  ['writing', [/\bbook\b/, /\bnovel\b/, /\bmanuscript\b/, /\bmemoir\b/, /\bscreenplay\b/, /\bwrit(e|ing)\b/, /\bauthor(ship)?\b/, /\bchapters?\b/, /\bpoetry\b/]],
  ['product', [/\bsaas\b/, /\bstartup\b/, /\bapp\b/, /\bproduct\b/, /\bsoftware\b/, /\bmvp\b/, /\bside project\b/, /\bwebsite\b/, /\bcustomers?\b/]],
  ['exam', [/\bexams?\b/, /\btest prep\b/, /\bcertification\b/, /\b(sat|gre|gmat|lsat|mcat|ielts|toefl|cpa)\b/, /\bbar exam\b/]],
  ['speaking', [/\bpublic speaking\b/, /\bspeech\b/, /\bted\b/, /\bkeynote\b/, /\bpresentations?\b/, /\btoastmasters\b/, /\borator\b/, /\bstage fright\b/]],
  ['creative', [/\bdraw(ing)?\b/, /\bpaint(ing)?\b/, /\bsketch(ing)?\b/, /\billustrat/, /\b(graphic )?design\b/, /\bphotograph/, /\bcalligraphy\b/, /\banimation\b/]],
  ['habit', [/\bdeep work\b/, /\bfocus\b/, /\bdistraction/, /\bproductiv/, /\bhabit\b/, /\bmeditat/, /\bprocrastinat/, /\broutine\b/]],
  ['content', [/\byoutube\b/, /\bvideos?\b/, /\bvlog/, /\bchannel\b/, /\bpodcast\b/, /\btiktok\b/, /\bcontent creat/, /\b(live )?stream(ing|er)?\b/, /\btwitch\b/]],
  ['strategy_games', [/\bchess\b/, /\bpoker\b/, /\bboard games?\b/, /\besports\b/, /\brubik/]],
];

const WEIGHTS = { domain: 3, goalText: 2, methodName: 1 } as const;

export interface TemplatePickInput {
  /** Clarify's free-text domain, when there is one (never stored on the goal). */
  domain?: string | null;
  /** The goal's text: the raw goal and/or the clarified outcome. */
  goalText?: string | null;
  methodName?: string | null;
}

function hits(text: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

export function pickTemplate(input: TemplatePickInput): TemplateId {
  const sources = (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).map((key) => ({
    text: typeof input[key] === 'string' ? (input[key] as string).toLowerCase() : '',
    weight: WEIGHTS[key],
  }));
  let best: TemplateId = 'general';
  let bestScore = 0;
  for (const [template, patterns] of KEYWORDS) {
    const score = sources.reduce((sum, source) => sum + (source.text ? hits(source.text, patterns) * source.weight : 0), 0);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }
  return best;
}
