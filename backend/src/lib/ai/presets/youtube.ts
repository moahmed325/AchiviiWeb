import { CertifiedPresetBlueprint } from './types.js';

export const youtubePreset: CertifiedPresetBlueprint = {
  id: 'youtube_12_videos',
  matchingPatterns: [
    /youtube/i,
    /launch.*youtube/i,
    /\bpublish\s+12\b/i,
    /\b12\b.*\byoutube\b|\byoutube\b.*\b12\b.*\bvideos?\b/i,
    /youtube.*channel/i,
    /content.*creator/i,
    /high.*retention.*video/i,
    /grow.*youtube/i,
    /start.*youtube/i
  ],
  title: 'Launch a YouTube Channel and Publish 12 High-Retention Videos',
  primaryDomain: 'Audience Building & Digital Video Storytelling',
  clarifiedOutcome:
    'Launch an active YouTube channel, establish a weekly production pipeline, and publish 12 high-retention videos with custom packaging',
  badge: 'Certified Creator Pipeline · MrBeast 50% Retention & Ali Abdaal Engine',
  capabilities: [
    'Title & Thumbnail Packaging Psychology (CTR ≥ 6%)',
    'The First-30-Seconds Hook & Narrative Retention Curve',
    'Batch Pre-Production (Ideation, Beat-Sheet Scripting, B-Roll Cues)',
    'High-Efficiency Lean Editing & Audio Mastering (-14 LUFS)',
    'YouTube Analytics Auditing (AVD, Click-Through, Drop-Off Points)'
  ],
  scientificFrameworks: [
    {
      name: "MrBeast & Paddy Galloway's 50% Retention & Pattern Interrupt Formula",
      description:
        'Viewer attention on digital platforms drops exponentially in the first 30 seconds. Inserting visual and auditory pattern interrupts every 4–6 seconds resets viewer dopamine and anchors the average view duration (AVD) above 50%.',
      application:
        'Enforces a zero-fluff first 30 seconds that immediately confirms the video title promise, followed by dynamic pacing with punch-ins, B-roll, and sound design accents.'
    },
    {
      name: "Ali Abdaal & Colin & Samir's Assembly-Line Creator Engine (Batching)",
      description:
        'Solo creators burn out when attempting to write, shoot, edit, and design in single disorganized bursts. Separating the pipeline into discrete assembly steps eliminates context-switching friction.',
      application:
        'Structures each week into distinct focus days: Ideation → Packaging → Scripting → Batch Filming → 4-Hour Lean Editing → Thumbnail Polishing → Upload.'
    },
    {
      name: "Edgar Dale's Visual Hierarchy & Cognitive Load Theory in Video",
      description:
        'Viewers remember 50% of what they see and hear simultaneously, compared to 10% of what they read. Minimizing cognitive clutter while emphasizing relevant on-screen visual anchors maximizes informational retention.',
      application:
        'Requires B-roll, lower-thirds, or diagrammatic graphics whenever a conceptual point exceeds 10 continuous seconds of talking-head footage.'
    }
  ],
  verificationCriteria:
    'Publish 12 public, high-retention video essays or tutorials on a live YouTube channel with custom titles and thumbnails, achieving an average 30-second retention ≥ 60% and establishing a repeatable weekly batch filming schedule.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current YouTube production and on-camera experience?',
      subtitle: 'Calibrates target video runtime, script structure, and editing complexity.',
      options: [
        'Camera-Shy Beginner (Never recorded on camera; need help with presence, speaking flow, and basic setup)',
        'Domain Expert / Educator (Deep knowledge in a topic, but zero video packaging or editing experience)',
        'Casual Hobbyist (Know basic editing software, but struggle with titles, retention, and consistency)',
        'Fast-Track Marketer (Comfortable on camera and seeking rapid audience growth and monetization)'
      ],
      allowCustom: true
    },
    {
      id: 'equipment',
      question: 'What recording setup and software will you be using?',
      subtitle: 'Determines your lighting, audio calibration, and editing workflow recommendations.',
      options: [
        'Smartphone + natural window light + wired lapel mic (CapCut / DaVinci Free)',
        'Dedicated mirrorless camera + key light + USB/XLR mic (Premiere Pro / Final Cut)',
        'Screen recording + USB condenser mic (OBS / Camtasia / Loom for software tutorials)',
        'Minimalist desktop webcam setup (Descript / basic editing tool)'
      ],
      allowCustom: true
    },
    {
      id: 'historical_friction',
      question: 'What has been your primary roadblock in past content creation attempts?',
      subtitle: 'Installs behavioral guardrails to prevent burnout and ensure you publish weekly.',
      options: [
        'Perfectionist paralysis (Spending 3 weeks on one video and never pressing publish)',
        'The 20-hour editing abyss (Exhaustion from endlessly tweaking effects on the timeline)',
        'The 0-view void depression (Losing motivation when YouTube impressions remain low early on)',
        'Idea exhaustion (Running out of compelling topics after 2 videos)'
      ],
      allowCustom: true
    }
  ],
  youtubeVelocityTable: [
    {
      baselineKey: 'camera_shy_beginner',
      label: 'Camera-Shy Beginner',
      targetRuntimeMins: '5–7 minutes',
      first30sRetentionTarget: 55,
      ctrTarget: 5,
      weeklyProductionHours: 6,
      guidance: 'Keep video runtimes tight to prevent editing exhaustion; prioritize conversational warmth, eye contact with the lens, and clear audio.'
    },
    {
      baselineKey: 'domain_expert',
      label: 'Domain Expert / Educator',
      targetRuntimeMins: '8–12 minutes',
      first30sRetentionTarget: 65,
      ctrTarget: 6,
      weeklyProductionHours: 7,
      guidance: 'Transform deep theoretical knowledge into punchy actionable frameworks with on-screen bullet overlays and diagrammatic breakdowns.'
    },
    {
      baselineKey: 'casual_hobbyist',
      label: 'Casual Hobbyist',
      targetRuntimeMins: '7–10 minutes',
      first30sRetentionTarget: 60,
      ctrTarget: 6,
      weeklyProductionHours: 8,
      guidance: 'Enforce the strict 4-hour editing cap; invest 50% of creative energy into Title and Thumbnail concepts before opening the camera app.'
    },
    {
      baselineKey: 'fast_track',
      label: 'Fast-Track Creator',
      targetRuntimeMins: '8–14 minutes',
      first30sRetentionTarget: 70,
      ctrTarget: 8,
      weeklyProductionHours: 10,
      guidance: 'Incorporate aggressive pattern interrupts every 4–6 seconds, split-test thumbnails via community tab or tools, and mine audience retention graphs.'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Channel branding setup, the 4-hour lean editing protocol, first-30s hook formulas, and publishing Videos 1, 2, and 3.',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Foundation Milestone Gate: 3 Published Videos & Audio Normalization',
      milestoneCriteria:
        'Publish 3 public videos to YouTube with custom thumbnails, verified -14 LUFS normalized audio, zero dead air pauses, and ≥55% retention at 30 seconds.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'High-CTR packaging (Title/Thumbnail pairs), visual pattern interrupts, community tab polling, and publishing Videos 4, 5, 6, and 7.',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Acceleration Milestone Gate: Outlier Packaging & Retention Breakthrough',
      milestoneCriteria:
        'Achieve a published catalog of 7 videos with at least one topic yielding >2x channel average CTR (≥7%), and establish a repeatable 6-hour weekly production cadence.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'Advanced narrative arcs, end-screen binge loops, audience retention auditing, and publishing Videos 8, 9, 10, 11, and 12.',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: 12-Video Repertoire & Growth Engine',
      milestoneCriteria:
        'Publish the 12th public video on your active channel, conduct a comprehensive 90-day analytics audit (CTR, AVD, top traffic sources), and construct the next 12-week scaling strategy.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: Channel Architecture & Video 1 Packaging Sprint',
      objective: 'Set up banner/avatar branding, validate a 10-idea spreadsheet, craft 3 thumbnail wireframes, and record Video 1 A-Roll.',
      keyMilestone: 'Video 1 A-Roll filmed with clear lighting and clean audio; channel banner and avatar published.',
      targetIntensity: 60,
      workoutArchetypes: []
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: The 4-Hour Lean Edit & Publishing Video 1',
      objective: 'Cut dead air, add B-roll and zoom punch-ins, export normalized audio, design thumbnail, and publish Video 1.',
      keyMilestone: 'Video 1 officially published public on YouTube with custom thumbnail and descriptive tags.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: The First-30-Second Hook Mastery (Video 2)',
      objective: 'Script and film Video 2 using the 3-part hook formula (Curiosity, Stake, Payoff roadmap); publish Video 2.',
      keyMilestone: 'Video 2 published; 30-second retention curve exceeds Video 1 by at least 5 percentage points.',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Foundation Milestone Audit & Video 3 Delivery',
      objective: 'Produce and publish Video 3; pass the Phase 1 Foundation Milestone Gate by verifying 3 published videos.',
      keyMilestone: 'Phase 1 Foundation Milestone Gate: 3 Published Videos & Audio Normalization',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: Thumbnail Contrast & High-CTR Packaging (Video 4)',
      objective: 'Incorporate 3-color rule and rule of thirds in thumbnail design; produce and publish Video 4 with CTR ≥ 6%.',
      keyMilestone: 'Video 4 published with 2 A/B thumbnail variations ready for testing; CTR exceeds 6% in first 48 hours.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Pattern Interrupts & Audio Soundscapes (Video 5)',
      objective: 'Add risers, whooshes, and subtle background score changes every 30 seconds; produce and publish Video 5.',
      keyMilestone: 'Video 5 published; viewer drop-off after minute 2 reduced by 15% compared to Phase 1 baseline.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Storytelling Bridges & Open Loops (Video 6)',
      objective: 'Introduce a mid-video narrative tension question; produce and publish Video 6 with enhanced mid-roll retention.',
      keyMilestone: 'Video 6 published; Average View Duration (AVD) tops 45% of total runtime.',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: Acceleration Milestone Gate & Video 7 Delivery',
      objective: 'Produce and publish Video 7; pass the Phase 2 Acceleration Milestone Gate with 7 total published videos.',
      keyMilestone: 'Phase 2 Acceleration Milestone Gate: Outlier Packaging & Retention Breakthrough',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: Competitor Outlier Mining & Search SEO (Video 8)',
      objective: 'Mine competitor video comment sections for unanswered pain points; produce and publish Video 8 targeting search intent.',
      keyMilestone: 'Video 8 published; ranks on page 1 of YouTube search for primary 4-word keyword within 72 hours.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: Binge-Loop End Screens & Cards (Video 9)',
      objective: 'Design an intentional verbal and visual bridge to Video 8 on the end screen; produce and publish Video 9.',
      keyMilestone: 'End-screen click-through rate exceeds 8%, initiating multi-video viewer binge sessions.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Community Building & Collaborative Pacing (Videos 10 & 11)',
      objective: 'Batch film Videos 10 and 11; poll channel subscribers for Video 12 topic choices; publish Video 10 and Video 11.',
      keyMilestone: 'Catalog reaches 11 published videos; community tab engagement exceeds 50 votes.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Capstone Repertoire & 90-Day Channel Scale (Video 12)',
      objective: 'Produce and publish Video 12; complete comprehensive analytics post-mortem; construct scaling roadmap.',
      keyMilestone: 'Phase 3 Mastery Capstone: 12-Video Repertoire & Growth Engine',
      targetIntensity: 95,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `
================================================================================
EXPERT YOUTUBE PRODUCER & RETENTION ARCHITECT CONTEXT: 12-VIDEO CREATOR ENGINE
================================================================================
You are Ali Abdaal and Paddy Galloway coaching a creator to publish 12 high-retention videos in 90 days.
Core Non-Negotiable Rules:
1. PACKAGING COMES BEFORE SCRIPTING:
   Never write a single line of script or press record until you have a winning Title and at least 2 clear Thumbnail concepts. If nobody clicks, the video does not exist.
2. THE FIRST-30-SECONDS HOOK FORMULA:
   Banish long intros, spinning 3D logos, and 'Hey guys welcome back to my channel.' State the core promise within 5 seconds, establish the high stakes by second 15, and outline the payoff roadmap by second 30.
3. THE 4-HOUR LEAN EDITING CAP:
   Creators die of editing fatigue. Enforce a maximum 4-hour edit per video: Pass 1 (A-Roll J-cuts & silence removal), Pass 2 (B-roll & zoom punch-ins), Pass 3 (Audio leveling to -14 LUFS & subtle background music), Pass 4 (Thumbnail & tags).
4. AUDIO IS 50% OF THE VIDEO:
   Viewers tolerate 720p video; they instantly click away from echoey, muffled, or unbalanced audio. Always normalize dialogue to -14 LUFS with a gentle high-pass filter.
================================================================================
`,
  evidenceTriad: {
    science: {
      title: "Viewer Cognitive Load & Attention Decay Curve",
      subtitle: "Paddy Galloway & Edgar Dale",
      tag: "Attention Science",
      coreRule: "Auditory/visual pattern interrupts every 4–6s prevent subconscious tab switching.",
      realWorldApplication:
        "Every talking-head section over 8 seconds is broken up with a 1.1x camera zoom punch-in, relevant B-roll insert, or sound effect accent."
    },
    socialAdherence: {
      title: "The Sunday 6 PM Publish Hard-Gate",
      subtitle: "Ali Abdaal & James Clear",
      tag: "Behavioral Adherence",
      coreRule: "A done and published video beats a perfect unreleased draft in your timeline every single time.",
      realWorldApplication:
        "Creators commit to a public upload deadline every Sunday, treating the schedule as sacred and resisting the urge to endlessly tweak minor transitions."
    },
    proCoaching: {
      title: "Thumbnail Contrast & The 3-Element Rule",
      subtitle: "MrBeast & Film Booth (Ed Lawrence)",
      tag: "Packaging Architecture",
      coreRule: "Thumbnails must convey the entire premise at mobile stamp size using ≤3 focal elements.",
      realWorldApplication:
        "Avoid clutter: one clear human face or focal subject, high-contrast foreground/background separation, and max 3-4 words of punchy text."
    }
  }
};

// Populate Week 1 workout archetypes
youtubePreset.weeks[0].workoutArchetypes = [
  {
    workoutType: 'ideation_mining',
    title: 'Content Sprint: Ideation & Competitor Outlier Mining',
    focus: 'Validating 10 high-demand video concepts using YouTube search autocomplete and competitor outlier analysis.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Competitor Outlier & View-to-Subscriber Ratio Audit',
        durationRatio: 0.35,
        instructions:
          'Identify 3 successful channels in your niche with 10k–100k subscribers. Sort their videos by "Most Popular" and find videos with 5x–10x their subscriber count in views. Log the underlying emotional hooks and topic angles.',
        focusCue: 'Look for the core human curiosity trigger (e.g. "How I...", "Stop doing X", "The Truth About...").',
        pitfallToAvoid: 'Choosing topics based only on personal whim without validating audience search demand.',
        layer: 'mechanism',
        layerReasoning:
          'YouTube recommendation algorithms favor proven topic models with high historical CTR across lookalike audience clusters.'
      },
      {
        stepNumber: 2,
        title: '10-Idea Spreadsheet & Search Intent Validation',
        durationRatio: 0.4,
        instructions:
          'Input your top concept into YouTube Search bar incognito; document the 5 auto-complete search phrases. Fill your 10-idea spreadsheet with working titles, search tags, and target viewer profiles.',
        focusCue: 'Ensure each idea solves a specific friction point or answers an urgent question for the viewer.',
        pitfallToAvoid: 'Spreading ideas across 5 unrelated niches instead of dominating one specific audience profile.',
        layer: 'adherence',
        layerReasoning:
          'Having a validated backlog of 10 ideas completely eliminates Sunday morning writer block and decision fatigue.'
      },
      {
        stepNumber: 3,
        title: 'Selection of Video 1 Core Premise',
        durationRatio: 0.25,
        instructions:
          'Select the single highest-confidence topic from your spreadsheet for Video 1. Write a 1-sentence value proposition: "By the end of this video, the viewer will know how to [RESULT] without [COMMON PAIN]."',
        focusCue: 'Keep the premise clear, tangible, and achievable in a 6-to-8 minute runtime.',
        pitfallToAvoid: 'Choosing an overly broad topic like "All About Nutrition" instead of "How to Eat 150g Protein on a Budget".',
        layer: 'safety',
        layerReasoning:
          'Scoping Video 1 to a tight, actionable premise prevents script bloat and keeps the upcoming edit under 4 hours.'
      }
    ]
  },
  {
    workoutType: 'packaging_wireframe',
    title: 'Packaging Architecture: Title & 3 Thumbnail Wireframes',
    focus: 'Drafting 5 title variations and wireframing 3 high-contrast thumbnail concepts before writing the script.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Drafting 5 High-Curiosity Title Variations',
        durationRatio: 0.35,
        instructions:
          'Write 5 distinct title variations for Video 1 experimenting with different hooks: (1) Fear of missing out, (2) Direct transformation, (3) Beginner roadmap, (4) Unpopular opinion, (5) Numbered list. Keep all titles under 55 characters so they do not truncate on mobile.',
        focusCue: 'Short, punchy words; eliminate unnecessary adverbs and jargon.',
        pitfallToAvoid: 'Clickbait titles that fail to deliver the promise inside the video, which destroys viewer retention.',
        layer: 'mechanism',
        layerReasoning:
          'Titles under 50 characters experience 12% higher click-through on mobile devices where 70%+ of YouTube views occur.'
      },
      {
        stepNumber: 2,
        title: 'Thumbnail Sketching & 3-Element Rule Layout',
        durationRatio: 0.45,
        instructions:
          'On paper or Canva, sketch 3 thumbnail compositions following the 3-Element Rule: (1) Subject/Face expressing clear emotion, (2) High-contrast object or visual element, (3) Max 3 bold words of complementary text (not repeating the title).',
        focusCue: 'View the sketch zoomed out to 10% on your screen (mobile preview size); does it immediately read?',
        pitfallToAvoid: 'Crowding the thumbnail with paragraphs of text, tiny logos, and low-contrast backgrounds.',
        layer: 'safety',
        layerReasoning:
          'Eye-tracking studies demonstrate viewers spend under 1.8 seconds evaluating a thumbnail before scrolling past.'
      },
      {
        stepNumber: 3,
        title: 'Peer Feedback & Packaging Lock-In',
        durationRatio: 0.2,
        instructions:
          'Send your top 2 title/thumbnail pairs to a peer or creator group. Ask: "Which one would you click and why?" Lock in the final winning packaging combo.',
        focusCue: 'Look for instant instinctive reactions rather than analytical design debates.',
        pitfallToAvoid: 'Second-guessing your packaging after the script is written; lock it in now as the anchor.',
        layer: 'adherence',
        layerReasoning:
          'External validation gives you 100% conviction that the video has an audience before investing hours into filming.'
      }
    ]
  },
  {
    workoutType: 'scripting_hook',
    title: 'Pre-Production: Beat-Sheet Scripting & First-30s Hook',
    focus: 'Writing bulleted beat sheets, drafting the First-30s Hook formula, and tagging B-roll cues.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'The First-30-Second Hook Scripting',
        durationRatio: 0.35,
        instructions:
          'Script word-for-word the first 30 seconds: Second 0–5 (confirm the thumbnail promise with zero filler), Second 6–15 (raise the emotional stakes or cost of ignorance), Second 16–30 (provide the fast-paced 3-part roadmap of what is coming).',
        focusCue: 'No "Welcome back", no channel theme music, no slow build-up; launch right into action.',
        pitfallToAvoid: 'Starting with a slow 15-second preamble about your personal morning routine.',
        layer: 'mechanism',
        layerReasoning:
          'YouTube analytics show that 40–60% of all viewer drop-off happens in the first 30 seconds; a punchy hook flattens this curve.'
      },
      {
        stepNumber: 2,
        title: 'Bulleted Beat-Sheet Construction (No Teleprompter Robot)',
        durationRatio: 0.45,
        instructions:
          'Break the body of the video into 3–4 distinct key points. For each point, write 3 bullet points (concept, personal example/data, takeaway action). Do NOT write a verbatim script; speak from points to ensure natural cadence.',
        focusCue: 'Talk to the camera as if explaining the concept to a smart friend at a coffee shop.',
        pitfallToAvoid: 'Reading an essay word-for-word, which creates dead, unblinking robotic eye contact.',
        layer: 'adherence',
        layerReasoning:
          'Bullet points reduce filming takes by 50% compared to memorizing long paragraphs or wrestling with a teleprompter.'
      },
      {
        stepNumber: 3,
        title: 'B-Roll & On-Screen Visual Cue Tagging',
        durationRatio: 0.2,
        instructions:
          'Highlight your beat sheet in yellow wherever an on-screen visual is required: [B-ROLL: screenshot of tool], [B-ROLL: hands typing on keyboard], [GRAPHIC: 3 bullet summary].',
        focusCue: 'Ensure no talking-head segment runs longer than 15 seconds without a tagged visual change.',
        pitfallToAvoid: 'Forgetting to tag B-roll, which forces you to film pickups during the editing phase.',
        layer: 'safety',
        layerReasoning:
          'Pre-planning B-roll ensures you capture all cutaway footage in the same studio session.'
      }
    ]
  },
  {
    workoutType: 'batch_filming',
    title: 'Production Sprint: Studio Calibration & A-Roll Filming',
    focus: 'Setting key light, -12dB mic gain staging, framing, and recording Video 1 A-Roll with energy.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Audio Check & Lighting Calibration',
        durationRatio: 0.2,
        instructions:
          'Set camera at eye level (or slightly above). Position key light at 45 degrees. Clip lapel mic 6 inches below your collarbone. Record a 15-second test clip; verify audio peaks between -12dB and -6dB with zero room echo.',
        focusCue: 'Check that eyes have clean catchlights and the audio waveform is thick without clipping red.',
        pitfallToAvoid: 'Filming a whole video only to discover the microphone was muted or peaking into digital distortion.',
        layer: 'safety',
        layerReasoning:
          'Bad audio cannot be fixed in post-production without severe robotic phase artifacts; getting clean signal at the source is vital.'
      },
      {
        stepNumber: 2,
        title: 'First-30-Second Hook Filming (3 Takes)',
        durationRatio: 0.3,
        instructions:
          'Record the first 30 seconds 3 times consecutively. Each time, increase your physical vocal energy and smile by 20% compared to normal conversation.',
        focusCue: 'Look directly through the camera lens as if looking into someone’s eyes.',
        pitfallToAvoid: 'Looking at the flip-out selfie screen instead of directly into the camera lens glass.',
        layer: 'mechanism',
        layerReasoning:
          'Direct lens contact simulates bilateral mutual gaze in human psychology, triggering 2x higher viewer trust.'
      },
      {
        stepNumber: 3,
        title: 'Body A-Roll Recording & B-Roll Pickups',
        durationRatio: 0.5,
        instructions:
          'Record the body sections following your beat sheet. If you stumble, pause, clap twice (creates an audio spike spike on the timeline for easy cutting), and restart the sentence. Capture 10 minutes of tagged B-roll immediately after.',
        focusCue: 'Leave 2 seconds of silence after a mistake before restarting the sentence.',
        pitfallToAvoid: 'Stopping and restarting the camera recording after every minor mistake.',
        layer: 'adherence',
        layerReasoning:
          'Clapping after mistakes produces prominent transient audio peaks that make trimming dead takes instantaneous during editing.'
      }
    ]
  },
  {
    workoutType: 'lean_editing',
    title: 'Post-Production Core: The 4-Hour Lean Edit (Passes 1 & 2)',
    focus: 'Rough cut assembly, removing all silence and pauses, ripple deletes, and audio leveling to -14 LUFS.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Pass 1: A-Roll Silence Removal & J-Cut Ripple Delete',
        durationRatio: 0.45,
        instructions:
          'Import footage into your editor. Use keyboard shortcuts (Q and W in Premiere/DaVinci) to ripple-delete every breath, stutter, and pause longer than 0.3 seconds. Create a seamless, energetic spoken stream.',
        focusCue: 'Keep playback speed at 1.5x while cutting to finish the rough assembly in under 30 minutes.',
        pitfallToAvoid: 'Endlessly re-watching the rough cut; make the cut and move forward.',
        layer: 'mechanism',
        layerReasoning:
          'Removing dead pauses increases verbal information density, preventing the micro-boredom that leads viewers to click suggested videos.'
      },
      {
        stepNumber: 2,
        title: 'Pass 2: Audio Normalization & High-Pass Filtering',
        durationRatio: 0.3,
        instructions:
          'Apply an 80Hz high-pass filter to remove room hum. Apply a gentle vocal compressor (2:1 ratio). Normalize overall master audio to -14 LUFS (or -1dB true peak).',
        focusCue: 'Dialogue should sound crisp, rich, and effortless to understand at 50% device volume.',
        pitfallToAvoid: 'Leaving audio quiet, forcing mobile viewers to strain or crank their speakers.',
        layer: 'safety',
        layerReasoning:
          'YouTube automatically normalizes audio to -14 LUFS; mastering to this target prevents unexpected automatic volume attenuation.'
      },
      {
        stepNumber: 3,
        title: 'Pass 3: Zoom Cuts & Pace Auditing',
        durationRatio: 0.25,
        instructions:
          'Add 1.1x scale zoom cuts on alternating sentences to simulate a 2-camera studio setup. Ensure the pacing feels dynamic without being dizzying.',
        focusCue: 'Zoom in on critical takeaway points or comedic punches to emphasize importance.',
        pitfallToAvoid: 'Excessive zooms every second that distract from the educational message.',
        layer: 'adherence',
        layerReasoning:
          'Zoom cuts provide zero-cost pattern interrupts that double visual interest without requiring hours of external B-roll hunting.'
      }
    ]
  },
  {
    workoutType: 'broll_thumbnail',
    title: 'Finishing Sprint: B-Roll, Sound Design & Thumbnail Polish',
    focus: 'Inserting cutaways, subtle background music (-24dB), sound accents, and rendering high-contrast thumbnail.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'B-Roll & Lower-Third Graphic Inserts',
        durationRatio: 0.4,
        instructions:
          'Overlay your tagged B-roll and clean lower-third text summaries on the timeline. Keep each B-roll clip between 2.5 and 4 seconds long.',
        focusCue: 'B-roll must directly show what your voiceover is describing at that exact second.',
        pitfallToAvoid: 'Generic stock footage of smiling corporate handshakes that disconnects from your message.',
        layer: 'mechanism',
        layerReasoning:
          'Multimodal dual-coding (hearing the concept while seeing an exact visual demonstration) boosts cognitive recall by up to 65%.'
      },
      {
        stepNumber: 2,
        title: 'Subtle Background Music Ducking & Sound Accents',
        durationRatio: 0.3,
        instructions:
          'Add a royalty-free lo-fi or energetic background track mixed to -24dB to -28dB (barely noticeable beneath dialogue). Add subtle whoosh sounds under title graphics and pop sounds under key takeaways.',
        focusCue: 'Music should set the vibe without competing with the voice frequencies.',
        pitfallToAvoid: 'Loud background music that overwhelms the dialogue frequencies.',
        layer: 'safety',
        layerReasoning:
          'Proper audio ducking ensures vocals remain intelligible for listeners with mild hearing impairments or noisy environments.'
      },
      {
        stepNumber: 3,
        title: 'Final Thumbnail Color Grading & Export',
        durationRatio: 0.3,
        instructions:
          'Take a high-res photo for the thumbnail. Cut out background, boost saturation by +15%, sharpen eyes, and place bold text behind subject. Export at 1280x720 under 2MB.',
        focusCue: 'Check the thumbnail on your phone screen from an arm’s length away; is the subject instantly obvious?',
        pitfallToAvoid: 'Using an awkward low-resolution freeze-frame from the video as the thumbnail.',
        layer: 'adherence',
        layerReasoning:
          'A dedicated thumbnail photo with intentional lighting outperforms random video screen grabs by over 40% in CTR.'
      }
    ]
  },
  {
    workoutType: 'publish_review',
    title: 'The Sunday Publish Gate: Upload, Metadata & Weekly Review',
    focus: 'Uploading video, setting chapter timestamps, end screens, community post, and logging weekly metrics.',
    isRestDay: true,
    baseDurationMinutes: 15,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Upload, Timestamps & End-Screen Setup',
        durationRatio: 0.6,
        instructions:
          'Upload to YouTube Studio. Add descriptive chapters in the description (0:00 Intro, 0:30 Point 1...). Upload custom thumbnail. Set end screen linking to your subscribe button or next relevant video. Schedule or publish public.',
        focusCue: 'Verify title spelling and check that thumbnail displays correctly in YouTube Studio preview.',
        pitfallToAvoid: 'Leaving description blank and skipping chapter timestamps.',
        layer: 'mechanism',
        layerReasoning:
          'Chapter timestamps generate Google Search rich snippets and allow viewers to re-watch key segments, driving repeat views.'
      },
      {
        stepNumber: 2,
        title: 'Weekly Production Post-Mortem & Video 2 Topic Confirmation',
        durationRatio: 0.4,
        instructions:
          'Record your total hours spent this week. Document the single biggest friction point during filming or editing. Select and lock in the topic for next week from your 10-idea spreadsheet.',
        focusCue: 'Celebrate hitting the upload gate: 1 video published beats 100 planned videos in your head.',
        pitfallToAvoid: 'Obsessively refreshing the YouTube Studio realtime view count every 5 minutes.',
        layer: 'adherence',
        layerReasoning:
          'Immediate post-mortems allow continuous iterative refinement, reducing production hours by 20% by Week 4.'
      }
    ]
  }
];
