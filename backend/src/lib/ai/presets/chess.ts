import { CertifiedPresetBlueprint } from './types.js';

export const chessPreset: CertifiedPresetBlueprint = {
  id: 'chess_1200_rating',
  matchingPatterns: [
    /chess/i,
    /1200.*rating/i,
    /chess\.com/i,
    /lichess/i,
    /rapid.*rating/i,
    /elo/i,
    /tactics.*puzzle/i,
    /grandmaster/i,
    /blunder.*check/i,
    /woodpecker.*method/i,
    /checkmate/i
  ],
  title: 'Climb from Beginner to a 1200 Rapid Chess Rating',
  primaryDomain: 'Chess Mastery & Tactical Pattern Recognition',
  clarifiedOutcome:
    'Climb from beginner/unrated to a verified 1200+ Chess.com (or 1500+ Lichess) Rapid rating through deliberate tactical pattern recognition, blunder elimination, and fundamental endgame mechanics',
  badge: 'Certified Chess Architecture · Axel Smith Woodpecker Method & Jeremy Silman Imbalances',
  capabilities: [
    'Woodpecker Method Spaced Repetition Tactical Loops (Pins, Forks, Skewers, Discovered Checks)',
    'The 3-Second Pre-Move Blunder Check (CCT: Checks, Captures, Threats)',
    'Silman Imbalance Framework & LPDO (Loose Pieces Drop Off) Scanning',
    'Principled Opening Economy (Center Control, Minor Piece Development, Early King Safety)',
    'Essential Endgame Algorithms (King + Rook Cutoffs, Key Squares & Opposition)',
    'Engine-Free Game Post-Mortems & Blunder Taxonomy Logging'
  ],
  scientificFrameworks: [
    {
      name: "Axel Smith & Hans Tikkanen's Woodpecker Method",
      description:
        'Subconscious tactical pattern recognition is built through repeated spaced repetition cycles of standard tactical motifs (forks, pins, skewers, deflection) until calculation time drops from minutes to under 5 seconds per pattern.',
      application:
        'Enforces a dedicated daily 20–30 minute puzzle regimen solved at ≥80% accuracy without guessing, looping the same core tactical puzzles across weekly cycles.'
    },
    {
      name: "Jeremy Silman's Imbalance Architecture & The Amateur's Mind",
      description:
        'Sub-1200 players consistently drop pieces and miss winning moves because they play haphazardly without evaluating imbalances (minor piece activity, pawn structure, king safety, and loose undefended pieces).',
      application:
        'Mandates John Nunn’s LPDO (Loose Pieces Drop Off) audit on every turn: scan the board for undefended pieces before launching any tactical combination.'
    },
    {
      name: "Dan Heisman's Real Chess & 'Hope Chess' Elimination",
      description:
        '"Hope Chess"—playing a move while hoping the opponent does not see your threat or failing to calculate their immediate forcing responses—is the primary reason players remain stuck below 1000 rating.',
      application:
        'Enforces a mandatory 3-second physical hands-off-the-mouse pause on every move to execute the CCT protocol (Checks, Captures, Threats) for both players.'
    }
  ],
  verificationCriteria:
    'Achieve and sustain a verified 1200+ Rapid rating on Chess.com (or 1500+ on Lichess) across a 10-game competitive sample, complete 1,000 tactical puzzles with ≥80% accuracy, and execute flawless win conversions on King+Rook vs King and King+Pawn opposition against engine level 4.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current chess rating or playing experience?',
      subtitle: 'Calibrates daily tactical puzzle volume, opening repertoire simplicity, and rapid match frequency.',
      options: [
        'Absolute Beginner (<600 Chess.com / Unrated - Know the rules, but frequently drop pieces in 1 move)',
        'Novice Tactician (600–800 Chess.com - Understand basic checks, but struggle with calculation and pins)',
        'Intermediate Club Aspirant (800–1000 Chess.com - Familiar with opening principles, but lose to tactical blunders)',
        'Advanced Intermediate (1000–1200 Chess.com - Solid tactics, aiming to break the 1200 ceiling with endgames and strategy)'
      ],
      allowCustom: true
    },
    {
      id: 'primary_blunder',
      question: 'What is your most frequent reason for losing chess games?',
      subtitle: 'Installs targeted psychological and cognitive safeguards against your primary failure mode.',
      options: [
        'One-move piece blunders (Leaving a queen, rook, or bishop hanging on an open square)',
        'Tactical blindness (Falling into opponent knight forks, pins, or discovered checks)',
        'Time trouble panic (Spending too much time in the opening and rushing moves with under 1 minute left)',
        'Endgame conversions (Blowing winning positions with extra material into draws or stalemates)'
      ],
      allowCustom: true
    },
    {
      id: 'time_control',
      question: 'What is your primary platform and competitive time control?',
      subtitle: 'Bans low-quality blitz/bullet tilt and enforces deliberate calculation formats.',
      options: [
        'Chess.com 15+10 Rapid (Gold-standard for deep calculation, blunder checking, and steady rating climb)',
        'Chess.com 10+0 Rapid (Standard rapid pool with high match availability)',
        'Lichess 15+10 Classical/Rapid (Open-source platform with comprehensive free analysis and studies)',
        'Over-the-board physical club play with digital chess clock'
      ],
      allowCustom: true
    }
  ],
  chessVelocityTable: [
    {
      baselineKey: 'under_600',
      label: 'Absolute Beginner (<600 Chess.com)',
      dailyTacticsCount: 15,
      puzzleAccuracyTarget: '75%+',
      weeklyRapidGames: 6,
      openingSystem: 'Opening Principles: 1.e4 with Italian Game Setup / Simple d4 Solid London',
      guidance: 'Focus 90% of effort on avoiding 1-move blunders. Always ask: "What is my opponent attacking right now?" before every move.'
    },
    {
      baselineKey: '600_800',
      label: 'Novice Tactician (600–800 Chess.com)',
      dailyTacticsCount: 20,
      puzzleAccuracyTarget: '80%+',
      weeklyRapidGames: 8,
      openingSystem: 'Italian Game / Scotch & Solid Caro-Kann Defense',
      guidance: 'Drill Woodpecker forks and pins daily. Eliminate hope chess: calculate opponent responses to your checks and captures.'
    },
    {
      baselineKey: '800_1000',
      label: 'Intermediate Club Aspirant (800–1000 Chess.com)',
      dailyTacticsCount: 25,
      puzzleAccuracyTarget: '82%+',
      weeklyRapidGames: 8,
      openingSystem: 'Principled Repertoire: Italian/London + Caro-Kann / Solid e5 response',
      guidance: 'Master Silman LPDO scanning. Never leave minor pieces undefended. Learn King+Rook and King+Pawn opposition endgames.'
    },
    {
      baselineKey: '1000_1200',
      label: 'Advanced Intermediate (1000–1200 Chess.com)',
      dailyTacticsCount: 30,
      puzzleAccuracyTarget: '85%+',
      weeklyRapidGames: 10,
      openingSystem: 'Refined Repertoire with middlegame tactical plans and outpost creation',
      guidance: 'Fine-tune time management. Maintain minimum 3 minutes on clock entering endgame. Engine-free game analysis on all losses.'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Blunder Elimination, CCT Protocol & Basic Tactical Motifs (Forks, Pins, Skewers)',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Hard-Gate: 800+ Rapid Rating & Zero 1-Move Blunder Certification',
      milestoneCriteria:
        'Attain a verified 800+ Rapid rating (or 1100+ Lichess), achieve ≥75% accuracy across 300 tactical puzzles, and play 5 consecutive 15+10 rapid games with zero 1-move hung pieces.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Silman Imbalances, LPDO Discipline & Algorithmic Endgame Conversions',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Hard-Gate: 1000+ Rapid Rating & Flawless King+Rook Endgame Conversion',
      milestoneCriteria:
        'Attain a verified 1000+ Rapid rating, solve 25 puzzles daily at ≥80% accuracy, and demonstrate 100% win conversion on King+Rook vs King and King+Pawn opposition against Stockfish level 4.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'Candidate Move Calculation, Time Management & Official 1200 Rating Capstone',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: Official 1200+ Rapid Rating Benchmark',
      milestoneCriteria:
        'Achieve and sustain a verified 1200+ Rapid rating on Chess.com across a 10-game competitive sample with positive win rate, and compile an annotated 10-game post-mortem portfolio documenting blunder reductions.'
    }
  ],
  evidenceTriad: {
    science: {
      title: 'Axel Smith Woodpecker Method',
      subtitle: 'Neural Pattern Recognition via Spaced Repetition',
      tag: 'COGNITIVE PLASTICITY',
      coreRule: 'Cycle identical tactical puzzles until recognition shifts from conscious calculation to reflex.',
      realWorldApplication:
        'Grandmasters calculate deeply only when necessary; 95% of their rapid moves are driven by intuitive chunking. Daily 20-minute tactical sets train your brain to recognize forks, pins, and skewers in fractions of a second.'
    },
    socialAdherence: {
      title: 'Dan Heisman Rapid Discipline',
      subtitle: 'Banish Tilt Bullet/Blitz & Enforce 15+10 Deliberation',
      tag: 'HABIT DEFENSE',
      coreRule: 'Never play rapid or blitz while tilted; enforce a strict 2-loss stop rule and review every game.',
      realWorldApplication:
        'Playing 1-minute bullet or 3-minute blitz solidifies bad habits and reinforces blunder-prone play. Playing 15+10 with a mandatory 3-second CCT pause forces deliberate calculation.'
    },
    proCoaching: {
      title: 'Jeremy Silman Imbalances & John Nunn Endgames',
      subtitle: 'Positional Audits & Algorithmic Conversions',
      tag: 'CHESS ARCHITECTURE',
      coreRule: 'Scan for LPDO (Loose Pieces Drop Off) every turn; master basic king-and-pawn opposition.',
      realWorldApplication:
        'Games under 1200 are won not by brilliant combinations, but by capitalizing on opponent loose pieces and reliably converting basic endgames without allowing stalemate draws.'
    }
  },
  expertPromptContext: `You are generating a certified 12-week chess roadmap to climb from beginner to a verified 1200+ Rapid rating.
Follow the 5-Step Master Blueprint Protocol strictly:
1. Ground every week in the Axel Smith Woodpecker Method, Jeremy Silman Imbalance Architecture, and Dan Heisman Real Chess principles.
2. Defeat the 5 Chess Death Zones:
   - Death Zone 1 (Weeks 1-2): Hope Chess & Instant Blunders -> Antidote: 3-second hands-off-mouse pause & CCT (Checks, Captures, Threats) scan.
   - Death Zone 2 (Weeks 3-4): Opening Memorization Abyss -> Antidote: The 3 Golden Opening Rules (Center control, minor piece development, early king safety) and 1 simple system (London/Italian).
   - Death Zone 3 (Weeks 5-6): Blitz & Tilt Addiction -> Antidote: Strictly 15+10 time controls, maximum 2 rated games per session, 2-loss circuit breaker.
   - Death Zone 4 (Weeks 7-8): LPDO (Loose Pieces Drop Off) Blindness -> Antidote: Silman undefended piece scan before any tactical calculation.
   - Death Zone 5 (Weeks 10-11): Endgame Panic & Stalemate Traps -> Antidote: Algorithmic opposition rules, Rook box technique, and counting squares.
3. Every daily task must mandate the 3-layer triad:
   - Mechanism: The chess principle or cognitive pattern (e.g. Knight fork geometry, cutting off the enemy king).
   - Adherence: Specific session structure (e.g. 20m tactics + one 15+10 game + engine-off post-mortem).
   - Safety: Anti-tilt protocols, blunder checks, and time-management safeguards.
4. Hard-gate milestones at Weeks 4 (800+ rating gate), 8 (1000+ rating gate), and 12 (1200+ capstone benchmark) MUST be enforced with zero compromise.`,
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Tactical Foundations: The Big Three (Pins, Forks, and Skewers)',
      objective: 'Internalize basic tactical motifs and eliminate immediate 1-move piece giveaways using the CCT protocol.',
      keyMilestone: 'Complete 100 tactical puzzles with ≥75% accuracy and play two 15+10 rapid games with zero hung pieces.',
      targetIntensity: 60,
      workoutArchetypes: [
        {
          workoutType: 'woodpecker_tactics',
          title: 'Tactical Pattern Recognition: Fork & Pin Foundations',
          focus: 'Solve 15 curated tactical puzzles focused exclusively on knight forks and absolute pins.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'CCT Tactical Warmup (Checks, Captures, Threats)',
              durationRatio: 0.25,
              instructions:
                'Solve 5 easy warmup puzzles (rating 600–800). Before entering your move, verbally name every check, capture, and threat available to both sides.',
              focusCue: 'Calculate the entire line to its conclusion before touching the piece.',
              pitfallToAvoid: 'Guessing the first move on intuition without calculating the opponent reply.',
              layer: 'mechanism',
              layerReasoning:
                'Tactical vision begins with systematic forced-move enumeration rather than passive pattern guessing.'
            },
            {
              stepNumber: 2,
              title: 'The Woodpecker Pin & Fork Core Set',
              durationRatio: 0.5,
              instructions:
                'Solve 10 focused tactical puzzles highlighting absolute pins against the king and royal forks by knights or queens. Take up to 3 minutes per puzzle.',
              focusCue: 'Identify aligned unprotected pieces that share a rank, file, diagonal, or knight-jump distance.',
              pitfallToAvoid: 'Rushing through puzzles to boost rating; accuracy matters 10x more than speed.',
              layer: 'mechanism',
              layerReasoning:
                'Repeated deliberate exposure to geometric alignment creates durable neural chunks for instant recognition.'
            },
            {
              stepNumber: 3,
              title: 'Missed Puzzle Post-Mortem & Notation',
              durationRatio: 0.25,
              instructions:
                'For any failed puzzle, reset the board, find why your candidate move failed, and write down the tactical motif in your personal chess journal.',
              focusCue: 'Ask: "What defensive resource did I overlook?"',
              pitfallToAvoid: 'Clicking "show answer" immediately and nodding along without re-solving.',
              layer: 'adherence',
              layerReasoning:
                'Actively re-solving failed puzzles repairs the specific calculation blind spot that caused the mistake.'
            }
          ]
        },
        {
          workoutType: 'opening_principles_rapid',
          title: 'The 3 Golden Rules & 15+10 Rapid Battle',
          focus: 'Play one 15+10 rapid game strictly following opening principles: center, development, king safety.',
          isRestDay: false,
          baseDurationMinutes: 50,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Pre-Game Mental Framing & Opening Rule Review',
              durationRatio: 0.15,
              instructions:
                'Review the 3 golden opening rules: 1) Place a pawn in the center (e4/d4), 2) Develop knights before bishops toward the center, 3) Castle before move 10. Do not move the same piece twice without reason.',
              focusCue: 'Pieces belong on active squares that control the four central squares (d4, d5, e4, e5).',
              pitfallToAvoid: 'Launching premature 2-piece attacks while your king is still stuck in the center.',
              layer: 'mechanism',
              layerReasoning:
                'Opening principles guarantee a harmonious middlegame position without memorizing deep theoretical lines.'
            },
            {
              stepNumber: 2,
              title: '15+10 Rapid Rated Match (CCT Protocol Enforced)',
              durationRatio: 0.7,
              instructions:
                'Play one competitive 15+10 rapid game on Chess.com or Lichess. On every single turn, take your hands off the mouse for 3 seconds and verify your opponent has no direct check, capture, or threat.',
              focusCue: 'Ask aloud: "If I move here, what can my opponent take for free?"',
              pitfallToAvoid: 'Moving instantly under the excitement of a perceived threat.',
              layer: 'safety',
              layerReasoning:
                'Physical hands-off pauses break the impulsive dopamine reflex that leads to 1-move blunders.'
            },
            {
              stepNumber: 3,
              title: 'Immediate Engine-Free Game Reflection',
              durationRatio: 0.15,
              instructions:
                'Close the game without turning on the computer engine. Scroll through the moves and write down the turning point of the game in your notebook.',
              focusCue: 'Identify the exact move where you felt uncomfortable or gained an advantage.',
              pitfallToAvoid: 'Relying immediately on the engine evaluation bar without doing your own thinking.',
              layer: 'adherence',
              layerReasoning:
                'Human reflection before engine analysis builds autonomous analytical judgment.'
            }
          ]
        },
        {
          workoutType: 'game_analysis_review',
          title: 'Deep Game Post-Mortem & Blunder Taxonomy',
          focus: 'Analyze yesterday’s rapid game move-by-move; categorize all mistakes into blunder archetypes.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Manual Blunder Identification',
              durationRatio: 0.4,
              instructions:
                'Review your game without engine assistance. Highlight every move where you or your opponent left a piece undefended or missed a basic tactic.',
              focusCue: 'Pinpoint candidate moves you should have considered during the game.',
              pitfallToAvoid: 'Skipping moves because you won the game; winning games often contain huge blunders.',
              layer: 'mechanism',
              layerReasoning:
                'Finding your own mistakes cultivates self-awareness and accountability on the board.'
            },
            {
              stepNumber: 2,
              title: 'Engine Validation & Blunder Taxonomy Logging',
              durationRatio: 0.35,
              instructions:
                'Turn on Stockfish review. Log every blunder (eval swing > 2.0) into one of four categories: 1) One-move hang, 2) Missed pin/fork, 3) Miscalculated exchange, 4) Time panic.',
              focusCue: 'Track which category appears most frequently over time.',
              pitfallToAvoid: 'Obsessing over minor engine inaccuracies (0.3 eval shifts). Focus only on blunders.',
              layer: 'adherence',
              layerReasoning:
                'Taxonomy logging transforms vague frustration into concrete diagnostic training data.'
            },
            {
              stepNumber: 3,
              title: 'Re-solving the Critical Position',
              durationRatio: 0.25,
              instructions:
                'Set the board to the position where the primary blunder occurred. Calculate the top engine line 3 moves deep until you understand why it succeeds.',
              focusCue: 'Visualize the resulting piece coordination clearly.',
              pitfallToAvoid: 'Merely memorizing the move without understanding the tactical refutation.',
              layer: 'mechanism',
              layerReasoning:
                'Deep re-calculation overwrites the faulty memory trace with the correct calculation pathway.'
            }
          ]
        },
        {
          workoutType: 'silman_imbalances',
          title: 'Silman Imbalances & LPDO (Loose Pieces Drop Off)',
          focus: 'Learn to spot undefended pieces on both sides of the board and exploit alignment flaws.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'LPDO Board Audit Drill',
              durationRatio: 0.35,
              instructions:
                'Examine 5 master games or puzzle positions. For each position, list every single piece that does not have at least one friendly pawn or piece defending it.',
              focusCue: 'Loose pieces are targets for double attacks and tactical exploitation.',
              pitfallToAvoid: 'Assuming your pieces are safe just because they are on your side of the board.',
              layer: 'mechanism',
              layerReasoning:
                'Over 80% of tactical combinations below 1200 rating succeed because of an undefended piece.'
            },
            {
              stepNumber: 2,
              title: 'Exploiting Loose Pieces with Tactics',
              durationRatio: 0.45,
              instructions:
                'Solve 10 tactical puzzles where the winning solution involves attacking an undefended piece via a double attack, discovery, or skewer.',
              focusCue: 'Look for moves that create two simultaneous threats against loose targets.',
              pitfallToAvoid: 'Attacking well-defended pieces while ignoring juicy hanging targets.',
              layer: 'mechanism',
              layerReasoning:
                'Connecting tactical motifs directly to LPDO targets sharpens predatory attacking instincts.'
            },
            {
              stepNumber: 3,
              title: 'Defensive Reinforcement Practice',
              durationRatio: 0.2,
              instructions:
                'Review 3 positions where your own pieces were loose. Practice identifying the most economical defensive move that coordinates pieces harmoniously.',
              focusCue: 'Prefer defending pieces with pawns or active minor pieces rather than passive rooks.',
              pitfallToAvoid: 'Leaving pieces stranded on the edge of the board with zero retreat squares.',
              layer: 'safety',
              layerReasoning:
                'Proactive piece coordination prevents opponent counterplay before it begins.'
            }
          ]
        },
        {
          workoutType: 'essential_endgames',
          title: 'Essential Endgames: King + Rook vs King Algorithm',
          focus: 'Master the step-by-step box method to checkmate a lone king with King and Rook without stalemate.',
          isRestDay: false,
          baseDurationMinutes: 40,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'The Rook Box Method Demonstration',
              durationRatio: 0.35,
              instructions:
                'Study and execute the Rook cutting technique: use the rook to cut off a rank or file, shrink the box with the king, and deliver checkmate on the board edge.',
              focusCue: 'Keep your rook defended and cut off the enemy king from the center.',
              pitfallToAvoid: 'Checking the enemy king randomly; checks that don’t shrink the box let the king escape.',
              layer: 'mechanism',
              layerReasoning:
                'Algorithmic endgame mechanics eliminate frantic guessing and guarantee 100% win conversion.'
            },
            {
              stepNumber: 2,
              title: 'Practical Conversion vs Stockfish Level 3',
              durationRatio: 0.45,
              instructions:
                'Set up King + Rook vs King against Stockfish level 3 from 3 different starting squares. Convert all 3 to checkmate in under 20 moves without allowing a stalemate.',
              focusCue: 'Remember: King must be directly opposite the enemy king (opposition) to deliver checkmate.',
              pitfallToAvoid: 'Accidental stalemate by trapping the king in a corner without checking him.',
              layer: 'safety',
              layerReasoning:
                'Practicing against an engine builds calm confidence under tournament time pressure.'
            },
            {
              stepNumber: 3,
              title: 'Stalemate Trap Audit',
              durationRatio: 0.2,
              instructions:
                'Review the 3 classic stalemate patterns in King + Queen and King + Rook endgames. State aloud the rule: "Always ensure the opponent king has at least one legal move unless delivering checkmate."',
              focusCue: 'Verify the opponent has a legal move or is in check before finalizing your move.',
              pitfallToAvoid: 'Mindlessly pushing pawns or queens when a simple clean checkmate is available.',
              layer: 'safety',
              layerReasoning:
                'Sub-1200 players throw away dozens of won games per year through careless stalemate oversights.'
            }
          ]
        },
        {
          workoutType: 'tournament_simulation',
          title: 'Rapid Match Simulation & Clock Management',
          focus: 'Play one 15+10 rapid game applying opening principles, LPDO checks, and clock discipline.',
          isRestDay: false,
          baseDurationMinutes: 50,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Pre-Match Tactical Calibration',
              durationRatio: 0.2,
              instructions:
                'Solve 5 quick tactical puzzles (rating 700–900) to wake up your visual calculation engine before starting the game.',
              focusCue: 'Sharp eyes, deliberate breathing, zero rush.',
              pitfallToAvoid: 'Starting a rated game cold while tired or distracted.',
              layer: 'adherence',
              layerReasoning:
                'Warmup puzzles activate visual-spatial working memory before competitive execution.'
            },
            {
              stepNumber: 2,
              title: 'Competitive 15+10 Rapid Match',
              durationRatio: 0.65,
              instructions:
                'Play one competitive 15+10 rapid match. Spend at least 30 seconds on every critical decision. Never let your clock drop below 3 minutes while the position is complicated.',
              focusCue: 'Treat every piece as valuable; coordinate your forces toward the enemy king.',
              pitfallToAvoid: 'Playing fast just because your opponent is blitzing moves out.',
              layer: 'mechanism',
              layerReasoning:
                'Maintaining independent pacing prevents being dragged into opponent-induced time scramble errors.'
            },
            {
              stepNumber: 3,
              title: 'Endgame Conversion / Loss Review',
              durationRatio: 0.15,
              instructions:
                'Immediately after the game, summarize how the ending went. Did you maintain composure in the endgame, or did you rush?',
              focusCue: 'Take pride in disciplined play regardless of the match result.',
              pitfallToAvoid: 'Immediately starting another game to "win back" lost rating points (tilting).',
              layer: 'safety',
              layerReasoning:
                'Strict session boundaries prevent emotional tilt spirals that destroy rating progress.'
            }
          ]
        },
        {
          workoutType: 'master_game_study',
          title: 'Active Recovery: Classical Masterpiece Study',
          focus: 'Rest your competitive nerves; walk through one Paul Morphy or Capablanca classical master game.',
          isRestDay: true,
          baseDurationMinutes: 20,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Paul Morphy Opera House Game Walkthrough',
              durationRatio: 0.6,
              instructions:
                'Play through Paul Morphy’s famous "Opera Game" (Morphy vs Duke of Brunswick & Count Isouard, 1858) on a physical board or digital viewer. Observe how every move developed a piece with a threat.',
              focusCue: 'Notice how Morphy sacrifices material to open lines against the uncastled king.',
              pitfallToAvoid: 'Mindlessly clicking through the moves without pausing to ask why Morphy played each move.',
              layer: 'mechanism',
              layerReasoning:
                'Morphy’s games are the purest real-world demonstration of rapid development, open lines, and king safety.'
            },
            {
              stepNumber: 2,
              title: 'Key Takeaway Reflection',
              durationRatio: 0.4,
              instructions:
                'Write down the single most inspiring lesson from the master game in your chess notebook (e.g., "Develop with tempo; open files for your rooks").',
              focusCue: 'Internalize the beauty and harmony of classical chess strategy.',
              pitfallToAvoid: 'Playing blitz on your rest day.',
              layer: 'adherence',
              layerReasoning:
                'Passive appreciation of master play restores cognitive freshness while reinforcing opening fundamentals.'
            }
          ]
        }
      ]
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Defending & Deflecting: Discovered Attacks & Absolute Pins',
      objective: 'Master double attacks and discovered checks, reducing tactical vulnerability below 800 rating.',
      keyMilestone: 'Achieve ≥78% accuracy across 120 puzzles and execute 2 successful discovered attacks in rapid games.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Opening Repertoire Consolidation: Italian Game / London System',
      objective: 'Establish a rock-solid opening foundation as White and Black, reaching move 8 with zero blunders.',
      keyMilestone: 'Reach move 10 with equal or better evaluation in 4 consecutive 15+10 rapid matches.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Phase 1 Hard-Gate Milestone: 800+ Rapid Rating & Blunder-Free Audit',
      objective: 'Complete Phase 1 hard-gate evaluation, achieving verified 800+ rating and zero 1-move blunders.',
      keyMilestone: 'Phase 1 Hard-Gate Cleared: Verified 800+ Rapid rating, 300 puzzles completed, zero hung pieces.',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Silman Imbalances: Minor Piece Superiority (Bishops vs Knights)',
      objective: 'Understand when knights outperform bishops (closed positions/outposts) and when bishops dominate (open boards).',
      keyMilestone: 'Win 2 rapid games by creating a permanent outpost for an active minor piece.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Essential Endgames: King + Pawn Opposition & Key Squares',
      objective: 'Master direct opposition, outflanking, and the square of the pawn in king and pawn endgames.',
      keyMilestone: '100% win conversion on King + Pawn vs King against Stockfish level 4 from 5 different positions.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Tactical Combinations: Deflection, Decoy, and Overworked Defenders',
      objective: 'Level up calculation depth to 3 ply (your move, reply, refutation) exploiting overworked pieces.',
      keyMilestone: 'Solve 150 intermediate puzzles (1000–1200 difficulty) with ≥80% accuracy.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Phase 2 Hard-Gate Milestone: 1000+ Rapid Rating & Endgame Mastery',
      objective: 'Clear the 1000 rating barrier on Chess.com with verified endgame conversion and zero back-rank mates.',
      keyMilestone: 'Phase 2 Hard-Gate Cleared: Verified 1000+ Rapid rating reached across a 10-game competitive sample.',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Candidate Move Selection & Alexander Kotov Tree Calculation',
      objective: 'Stop playing the first good-looking move; generate 2–3 candidate moves and calculate forced responses.',
      keyMilestone: 'Demonstrate disciplined 3-candidate move evaluation in all critical positions during weekly matches.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Pawn Structure Architecture: Isolated Pawns, Doubled Pawns & Pawn Chains',
      objective: 'Learn how pawn structures dictate middlegame plans: attack pawn chain bases and avoid backward pawns.',
      keyMilestone: 'Execute a successful pawn-break strategy in 2 rated rapid matches to unlock open files for rooks.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Rook Endgames & The 7th Rank Invasion (Lucena & Philidor Principles)',
      objective: 'Master active rooks on the 7th rank and foundational defensive cutoff techniques in rook endings.',
      keyMilestone: 'Successfully defend a drawn rook endgame and convert a +1 pawn rook endgame against engine sparring.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Phase 3 Mastery Capstone: 1200 Rating Benchmark & Master Portfolio',
      objective: 'Achieve and verify the official 1200+ Rapid rating ceiling with an annotated 10-game post-mortem portfolio.',
      keyMilestone: 'Official 1200+ Rapid Rating Achieved on Chess.com / 1500+ Lichess with documented master portfolio.',
      targetIntensity: 100,
      workoutArchetypes: []
    }
  ]
};

// Replicate week 1 workoutArchetypes to weeks 2-12 if empty
for (let i = 1; i < chessPreset.weeks.length; i++) {
  if (!chessPreset.weeks[i].workoutArchetypes || chessPreset.weeks[i].workoutArchetypes.length === 0) {
    chessPreset.weeks[i].workoutArchetypes = chessPreset.weeks[0].workoutArchetypes;
  }
}
