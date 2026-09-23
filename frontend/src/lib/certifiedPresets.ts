/*
 * The one frontend catalogue of certified pathways (ND-15). Every pathway screen, in the app and on the landing
 * page, reads it; nothing else may hold its own list of pathways or categories.
 *
 * `id` and `title` are identity, not copy: the id is the `/signup?pathway=<id>` slug, and the title is sent as the
 * goal text, which the backend's `findPresetForGoal` matches to pick the preset. Never change either (ND-5).
 */

/** The six directions a pathway belongs to (OD-11), in display order. */
export const PATHWAY_DIRECTIONS = ['Career', 'Fitness', 'Learning', 'Creative', 'Business', 'Personal'] as const;
export type PathwayDirection = (typeof PATHWAY_DIRECTIONS)[number];

export interface CertifiedPathway {
  id: string;
  /** Matched by the backend to pick the preset: never reword it (ND-5). */
  title: string;
  direction: PathwayDirection;
  /** Plain-language description for display (ND-5). The method names stay in `badge`. */
  summary: string;
  /** Method names, shown as a secondary "Built on …" line (ND-5). */
  badge: string;
  dailyMinutes: number;
  /** Used by `getGoalImage` only. */
  label: string;
  image: string;
  /* Expert detail from the original gallery, not displayed today. */
  outcome: string;
  desc: string;
  coach: string;
  p1: { name: string; focus: string };
  p2: { name: string; focus: string };
  p3: { name: string; focus: string };
  sampleDay: {
    title: string;
    duration: string;
    focus: string;
    slot: string;
  };
}

export const CERTIFIED_PATHWAYS: CertifiedPathway[] = [
  {
    id: 'saas',
    direction: 'Business',
    summary: 'Build a web app people will pay for, from the first screen to your first paying customer.',
    title: 'Build & Ship a SaaS Web App',
    label: 'Ship a SaaS',
    outcome: 'Build, deploy, and launch a full-stack SaaS to first paying user',
    desc: 'From clean relational schema to Stripe billing & first paying user',
    dailyMinutes: 45,
    badge: 'Eric Ries Lean Startup & Vertical Slice Architecture',
    image: '/images/goals/saas.jpg',
    coach: 'Vertical Slice & Stripe Billing',
    p1: { name: 'Foundation', focus: 'Domain model, authentication & core pipeline (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Billing integration, user workflows & UX polish (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Distribution channels, landing page & user onboarding (Weeks 9–12)' },
    sampleDay: {
      title: 'Database Schema & Relational API Endpoints',
      duration: '45m',
      focus: 'Implement migrations and write deterministic API integration tests',
      slot: '08:00 – 08:45',
    },
  },
  {
    id: 'run10k',
    direction: 'Fitness',
    summary: 'Build your running base week by week, working toward 10 km in under 50 minutes.',
    title: 'Run a 10K Under 50 Minutes',
    label: 'Run a 10K',
    outcome: 'Run a 10K under 50 minutes continuously with aerobic efficiency',
    desc: 'Progressive aerobic base, 170+ SPM cadence & threshold pacing',
    dailyMinutes: 35,
    badge: 'Jack Daniels VDOT & 80/20 Polarized Base',
    image: '/images/goals/run10k.jpg',
    coach: 'Jack Daniels VDOT Formula',
    p1: { name: 'Foundation', focus: 'Aerobic base & cadence rhythm (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Threshold intervals & stamina expansion (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Pacing simulation & continuous 10K benchmark (Weeks 9–12)' },
    sampleDay: {
      title: 'Aerobic Base Pace & Cadence Calibration',
      duration: '35m',
      focus: 'Zone 2 heart rate with steady 170 SPM turnover',
      slot: '07:00 – 07:35',
    },
  },
  {
    id: 'guitar',
    direction: 'Creative',
    summary: 'Learn the chords, strumming and picking you need to play five full songs.',
    title: 'Play 5 Songs on Acoustic Guitar',
    label: 'Acoustic Guitar',
    outcome: 'Play 5 complete songs from memory with clean fingerpicking at campfires',
    desc: 'Fingerstyle mechanics, metronome switches & memory playthrough',
    dailyMinutes: 30,
    badge: 'JustinGuitar Grade 1 & Berklee Ergonomics',
    image: '/images/goals/guitar.jpg',
    coach: 'JustinGuitar 1-Min Switches',
    p1: { name: 'Foundation', focus: 'Chord transitions, finger dexterity & metronome timing (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Fingerstyle patterns, syncopation & barre chords (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Full dynamic arrangement & continuous memory playthrough (Weeks 9–12)' },
    sampleDay: {
      title: 'Clean Open-Chord Transitions & Travis Picking Drill',
      duration: '30m',
      focus: 'Metronome practice at 72 BPM without glancing at fretboard',
      slot: '19:00 – 19:30',
    },
  },
  {
    id: 'spanish',
    direction: 'Learning',
    summary: 'Learn the words and habits you need to hold a real conversation in Spanish.',
    title: 'Speak Conversational Spanish',
    label: 'Conversational Spanish',
    outcome: 'Hold 15-minute fluid conversational dialogues in Spanish without hesitation',
    desc: '500 core verbs, high-frequency frames & spoken vocalization drills',
    dailyMinutes: 30,
    badge: 'Stephen Krashen Input & Michel Thomas Verbal Production',
    image: '/images/goals/spanish.png',
    coach: 'Krashen Natural Order',
    p1: { name: 'Foundation', focus: 'Core 500 active verbs & high-frequency sentence frames (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Spontaneous response drills & audio comprehension (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Native dialogue sessions & narrative storytelling (Weeks 9–12)' },
    sampleDay: {
      title: 'Active Recall Sentence Construction & Pronunciation',
      duration: '30m',
      focus: 'Timed audio responses using past tense irregular verbs',
      slot: '07:30 – 08:00',
    },
  },
  {
    id: 'recomp',
    direction: 'Fitness',
    summary: 'Train and eat to lose body fat while you keep and build muscle.',
    title: 'Drop 5% Body Fat & Build Lean Muscle',
    label: 'Physique Recomp',
    outcome: 'Drop 5% body fat while preserving lean muscle via caloric deficit calibration',
    desc: 'Helms nutrition deficit, 2.0g/kg protein, RIR hypertrophy & 48-hr refeeds',
    dailyMinutes: 60,
    badge: 'Eric Helms Nutrition Pyramid & Schoenfeld Hypertrophy',
    image: '/images/goals/recomp.jpg',
    coach: 'Renaissance Periodization',
    p1: { name: 'Foundation', focus: 'Baseline deficit calibration & hypertrophy motor patterns (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Progressive overload, 3s eccentrics & mid-point refeed (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Metabolic adaptation defense & verified 5% body fat drop (Weeks 9–12)' },
    sampleDay: {
      title: 'Mechanical Tension Upper-Body Hypertrophy',
      duration: '60m',
      focus: 'Compound bench & row progressions, 3-second eccentrics at 2 RIR',
      slot: '07:00 – 08:00',
    },
  },
  {
    id: 'youtube',
    direction: 'Creative',
    summary: 'Plan, film and publish twelve videos, and learn what keeps people watching.',
    title: 'Launch a YouTube Channel (12 Videos)',
    label: 'YouTube Engine',
    outcome: 'Publish 12 high-retention videos with 50%+ 30s retention and 7%+ CTR',
    desc: 'MrBeast retention curves, Ali Abdaal batching & 4-hour lean edits',
    dailyMinutes: 60,
    badge: 'MrBeast 50% Retention & Ali Abdaal Creator Engine',
    image: '/images/goals/youtube.jpg',
    coach: 'Paddy Galloway Packaging',
    p1: { name: 'Foundation', focus: 'Packaging, 10-idea spreadsheet & batch production loop (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'First-30-second retention hooks & 4-hour lean editing (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Analytics-driven iteration & 12 published video milestone (Weeks 9–12)' },
    sampleDay: {
      title: 'Thumbnail Curiosity Framing & 30-Second Hook Script',
      duration: '60m',
      focus: 'Draft 3 title/thumbnail packages with dynamic pattern interrupt scripts',
      slot: '18:00 – 19:00',
    },
  },
  {
    id: 'book',
    direction: 'Creative',
    summary: 'Draft a 30,000-word book, then edit it into a finished manuscript.',
    title: 'Write & Polish a 30,000-Word Book',
    label: 'Write a Book',
    outcome: 'Write, edit, and polish a complete 30,000-word non-fiction manuscript',
    desc: 'Stephen King closed-door quotas, Pressfield War of Art & Zinsser pruning',
    dailyMinutes: 60,
    badge: 'Steven Pressfield War of Art & William Zinsser On Writing Well',
    image: '/images/goals/book.jpg',
    coach: 'Stephen King Daily Quotas',
    p1: { name: 'Foundation', focus: 'The 3-beat chapter arc, daily word quota & drafting momentum (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Closed-door zero-editing sprint & 25,000 words banked (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Developmental self-editing, Zinsser clutter cuts & polish (Weeks 9–12)' },
    sampleDay: {
      title: 'Sacred 60-Minute Closed-Door Drafting Sprint',
      duration: '60m',
      focus: 'Draft 500 words uninterrupted; enforce [TK] notation on all unknown facts',
      slot: '06:30 – 07:30',
    },
  },
  {
    id: 'deepwork',
    direction: 'Personal',
    summary: 'Train your attention so you can do long stretches of focused work each day.',
    title: 'Master Deep Work & Double Daily Output',
    label: 'Deep Work Focus',
    outcome: 'Master 4 hours of daily unbroken deep work and double cognitive output',
    desc: 'Cal Newport attention residue, Huberman 90m ultradian cycles & shutdown ritual',
    dailyMinutes: 60,
    badge: 'Cal Newport Deep Work & Andrew Huberman Focus Protocols',
    image: '/images/goals/deepwork.jpg',
    coach: 'Cal Newport Law of Focus',
    p1: { name: 'Foundation', focus: 'Digital perimeter lockdown, distraction notepad & 2h focus (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: '90m ultradian cycles, communication batching & 3.5h focus (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'The 4.0h daily focus ceiling & 2x strategic output sprint (Weeks 9–12)' },
    sampleDay: {
      title: '60-Minute Airplane-Mode Deep Focus Block',
      duration: '60m',
      focus: 'Single high-leverage intellectual deliverable with physical distraction pad',
      slot: '09:00 – 10:00',
    },
  },
  {
    id: 'chess',
    direction: 'Learning',
    summary: 'Study tactics and endgames, and play rated games, working toward a 1200 rating.',
    title: 'Climb to a 1200 Rapid Chess Rating',
    label: '1200 Chess Rating',
    outcome: 'Climb from beginner/unrated to 1200+ Chess.com Rapid rating via tactics',
    desc: 'Woodpecker spaced repetition puzzles, Silman LPDO scans & CCT pause',
    dailyMinutes: 45,
    badge: 'Axel Smith Woodpecker Method & Jeremy Silman Imbalance Architecture',
    image: '/images/goals/chess.jpg',
    coach: 'Dan Heisman Real Chess',
    p1: { name: 'Foundation', focus: 'Tactical motifs (pins/forks), CCT blunder checks & 800+ rating (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Silman LPDO scans, King+Rook/Pawn endgames & 1000+ rating (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Candidate move calculation, clock management & 1200+ capstone (Weeks 9–12)' },
    sampleDay: {
      title: 'Woodpecker Forks & Pins + 15+10 Rapid Rated Match',
      duration: '45m',
      focus: 'Solve 15 tactical puzzles (≥80% acc) and play 1 rapid game with 3s CCT pause',
      slot: '19:30 – 20:15',
    },
  },
  {
    id: 'speech',
    direction: 'Career',
    summary: 'Write, rehearse and deliver a 15-minute talk that people remember.',
    title: 'Deliver a 15-Minute TED-Style Speech',
    label: 'TED-Style Keynote',
    outcome: 'Deliver an unforgettable 15-minute keynote from memory without slide crutches',
    desc: 'Carmine Gallo 15-word throughline, Toastmasters silence pauses & Duarte sparklines',
    dailyMinutes: 45,
    badge: 'Carmine Gallo Talk Like TED & Toastmasters International',
    image: '/images/goals/speech.jpg',
    coach: 'Toastmasters Vocal Dynamics',
    p1: { name: 'Foundation', focus: '15-word throughline lock, 3-act storyboard & 5m memory delivery (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Vocal variety, silence substitution & 12m unbroken video run (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Stress inoculation, stage choreography & 15m live keynote delivery (Weeks 9–12)' },
    sampleDay: {
      title: 'Throughline Formulation & 90-Second Opening Hook Run',
      duration: '45m',
      focus: 'Diaphragmatic breathing warmup and 3 video recordings of opening hook',
      slot: '18:30 – 19:15',
    },
  },
];

export function pathwaysInDirection(direction: PathwayDirection | undefined): CertifiedPathway[] {
  return direction ? CERTIFIED_PATHWAYS.filter((p) => p.direction === direction) : [];
}

export interface PathwayGroup {
  direction: PathwayDirection;
  pathways: CertifiedPathway[];
}

/** Groups pathways by direction in display order, leaving out any direction with no pathway (OD-11). */
export function groupPathways(pathways: CertifiedPathway[]): PathwayGroup[] {
  return PATHWAY_DIRECTIONS.map((direction) => ({
    direction,
    pathways: pathways.filter((p) => p.direction === direction),
  })).filter((group) => group.pathways.length > 0);
}

/** The directions that hold at least one pathway, in display order. An empty direction is never shown. */
export const PATHWAY_GROUPS: PathwayGroup[] = groupPathways(CERTIFIED_PATHWAYS);

/** Looks up a pathway by the slug used in `/signup?pathway=<slug>`; the slug is the pathway's `id`. */
export function findPathwayBySlug(slug: string | null | undefined): CertifiedPathway | undefined {
  if (!slug) return undefined;
  return CERTIFIED_PATHWAYS.find((p) => p.id === slug);
}

/**
 * The pathway a goal was started from. A pathway goal's text is exactly its title (the backend matches the title the
 * same way), so a custom goal that merely mentions a pathway's subject is not mistaken for it.
 */
export function findPathwayByTitle(goalText: string | null | undefined): CertifiedPathway | undefined {
  const normalized = goalText?.trim().toLowerCase();
  if (!normalized) return undefined;
  return CERTIFIED_PATHWAYS.find((p) => p.title.toLowerCase() === normalized);
}

export function getGoalImage(goalTitleOrOutcome?: string): string {
  if (!goalTitleOrOutcome) return '/images/goals/saas.jpg';
  const query = goalTitleOrOutcome.toLowerCase();
  const matched = CERTIFIED_PATHWAYS.find((p) => {
    const idMatch = query.includes(p.id);
    const labelMatch = query.includes(p.label.toLowerCase());
    const titleMatch = p.title.toLowerCase().includes(query) || query.includes(p.title.toLowerCase());
    const keywordMatch =
      (p.id === 'saas' && (query.includes('saas') || query.includes('web app') || query.includes('software'))) ||
      (p.id === 'run10k' && (query.includes('10k') || query.includes('run') || query.includes('marathon'))) ||
      (p.id === 'guitar' && (query.includes('guitar') || query.includes('acoustic') || query.includes('song'))) ||
      (p.id === 'spanish' && (query.includes('spanish') || query.includes('language') || query.includes('hablar'))) ||
      (p.id === 'recomp' && (query.includes('recomp') || query.includes('fat') || query.includes('muscle') || query.includes('physique') || query.includes('body'))) ||
      (p.id === 'youtube' && (query.includes('youtube') || query.includes('channel') || query.includes('subscribers') || query.includes('video'))) ||
      (p.id === 'book' && (query.includes('book') || query.includes('write') || query.includes('author') || query.includes('words'))) ||
      (p.id === 'deepwork' && (query.includes('deep work') || query.includes('focus') || query.includes('attention') || query.includes('concentrat'))) ||
      (p.id === 'chess' && (query.includes('chess') || query.includes('elo') || query.includes('rating') || query.includes('grandmaster'))) ||
      (p.id === 'speech' && (query.includes('speech') || query.includes('speaking') || query.includes('oratory') || query.includes('presentation') || query.includes('talk')));
    return idMatch || labelMatch || titleMatch || keywordMatch;
  });
  return matched?.image || '/images/goals/saas.jpg';
}

