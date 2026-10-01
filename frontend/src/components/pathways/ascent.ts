import type { CertifiedPathway } from '../../lib/certifiedPresets';

export interface AscentPhase {
  name: string;
  /** What the phase is about, without the trailing "(Weeks 1-4)" the catalogue appends. */
  focus: string;
  /** "1-4": the weeks the phase covers, when the catalogue gives them. */
  weeks?: string;
}

export interface Ascent {
  /** Where the pathway ends. */
  destination: string;
  /** The flights in order: the first is the foundation, the last is where the climb tops out. */
  phases: AscentPhase[];
  /** One ordinary day on the pathway. */
  day: { slot: string; title: string; duration: string };
}

/* The catalogue ends every phase focus with "(Weeks 1\u20134)". Accept a plain hyphen too. */
const TRAILING_WEEKS = /\s*\(Weeks?\s+(\d+)\s*[\u2013-]\s*(\d+)\)\s*$/i;

/** Splits "Aerobic base (Weeks 1\u20134)" into its focus and its week range. Text without a range is returned whole. */
export function splitWeeks(text: string): { focus: string; weeks?: string } {
  const match = TRAILING_WEEKS.exec(text);
  if (!match) return { focus: text.trim() };
  return { focus: text.slice(0, match.index).trim(), weeks: `${match[1]}\u2013${match[2]}` };
}

/** The destination, the three flights and a typical day of a pathway: the detail the library reveals once one is chosen. */
export function ascentOf(pathway: CertifiedPathway): Ascent {
  const phases = [pathway.p1, pathway.p2, pathway.p3].map(({ name, focus }) => ({ name, ...splitWeeks(focus) }));
  return { destination: pathway.outcome, phases, day: pathway.sampleDay };
}
