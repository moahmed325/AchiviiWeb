import { generateStructuredContent } from '../ai/gemini.js';
import { detectTaskDomain, TaskDomain } from './taskGuideGenerator.js';

export interface ChecklistItem {
  step_number: number;
  action: string;
  duration_minutes: number;
  is_checkpoint: boolean;
}

export interface CuratedResource {
  type: 'YOUTUBE' | 'DOCS' | 'TEMPLATE' | 'PROMPT' | 'TOOL';
  title: string;
  url_or_payload: string;
  why_recommended: string;
}

export interface FallbackHierarchy {
  level_1_standard: string;
  level_2_reduced: string;
  level_3_mvs: string;
  level_4_substitute: string;
}

export interface PitfallGuardrail {
  trap: string;
  antidote: string;
}

export interface TaskFieldManual {
  objective: string;
  checklist: ChecklistItem[];
  resources: CuratedResource[];
  pitfall_guardrail: PitfallGuardrail;
  fallbacks: FallbackHierarchy;
}

/**
 * Returns a high-confidence, scientifically and socially grounded deterministic Field Manual
 * for common domains (Software/SaaS, Fitness, Language, Writing, General).
 */
export function generateDeterministicFieldManual(
  taskTitle: string,
  category?: string,
  durationMinutes: number = 45,
  goalContext?: string
): TaskFieldManual {
  const domain = detectTaskDomain(taskTitle, category, goalContext);
  const totalMins = Math.max(15, durationMinutes);

  const step1Mins = totalMins <= 20 ? 3 : Math.min(10, Math.round(totalMins * 0.15));
  const step3Mins = totalMins <= 20 ? 3 : Math.min(10, Math.round(totalMins * 0.15));
  const step2Mins = Math.max(10, totalMins - step1Mins - step3Mins);

  const mvsMins = Math.max(10, Math.round(totalMins * 0.35));
  const reducedMins = Math.max(15, Math.round(totalMins * 0.65));

  switch (domain) {
    case 'SOFTWARE':
      return {
        objective: `Implement, verify, and commit a working increment for "${taskTitle}".`,
        checklist: [
          {
            step_number: 1,
            action: `Set up environment, open target files, and define input/output contracts or type interfaces for ${taskTitle}.`,
            duration_minutes: step1Mins,
            is_checkpoint: false,
          },
          {
            step_number: 2,
            action: `Build the core functionality step-by-step. Keep functions small and check terminal/browser output frequently.`,
            duration_minutes: step2Mins,
            is_checkpoint: true,
          },
          {
            step_number: 3,
            action: `Verify happy and error paths, remove debug logs, and write an atomic git commit with a clear summary message.`,
            duration_minutes: step3Mins,
            is_checkpoint: true,
          },
        ],
        resources: [
          {
            type: 'DOCS',
            title: 'MDN Web Docs & Official Framework Reference',
            url_or_payload: 'https://developer.mozilla.org',
            why_recommended: 'Authoritative, zero-fluff syntax documentation and best practices.',
          },
          {
            type: 'YOUTUBE',
            title: `Search: "${taskTitle} beginner tutorial 10 min"`,
            url_or_payload: `https://www.youtube.com/results?search_query=${encodeURIComponent(taskTitle + ' tutorial practical')}`,
            why_recommended: 'Visual walkthrough of identical implementation patterns from top engineers.',
          },
          {
            type: 'PROMPT',
            title: 'Cursor / ChatGPT Architectural Pairing Prompt',
            url_or_payload: `I am building ${taskTitle} in my modern fullstack app. Provide the clean TypeScript types, the minimal implementation file, and a quick verification test. Keep it simple and production-ready without unnecessary external libraries.`,
            why_recommended: 'Instant code scaffolding to eliminate blank page paralysis.',
          },
        ],
        pitfall_guardrail: {
          trap: 'Getting stuck tweaking UI colors or refactoring code before the core data loop works.',
          antidote: 'The "Ugly Prototype" rule: build the simplest working logic first, style later.',
        },
        fallbacks: {
          level_1_standard: `${totalMins}m: Full end-to-end implementation with verified commit.`,
          level_2_reduced: `${reducedMins}m: Write the data types and implement just the primary happy path.`,
          level_3_mvs: `${mvsMins}m: Scaffold file structure and write the input/output interface signatures.`,
          level_4_substitute: `10m: Read 1 technical guide or watch 1 implementation breakdown video.`,
        },
      };

    case 'FITNESS':
      return {
        objective: `Safely stimulate aerobic and muscular adaptation for "${taskTitle}" within target heart rate/pace zones.`,
        checklist: [
          {
            step_number: 1,
            action: `Dynamic mobility warmup: leg swings, hip openers, ankle mobility, and gear/heart-rate check.`,
            duration_minutes: step1Mins,
            is_checkpoint: false,
          },
          {
            step_number: 2,
            action: `Main interval/effort block: maintain controlled cadence and nasal/conversational breathing without redlining.`,
            duration_minutes: step2Mins,
            is_checkpoint: true,
          },
          {
            step_number: 3,
            action: `Cooldown jog/walk, rehydrate with electrolytes, and log distance/RPE effort in tracker.`,
            duration_minutes: step3Mins,
            is_checkpoint: true,
          },
        ],
        resources: [
          {
            type: 'TOOL',
            title: 'Jack Daniels VDOT Running Calculator',
            url_or_payload: 'https://vdoto2.com/calculator/',
            why_recommended: 'Scientifically calibrated training paces to avoid overtraining and injury.',
          },
          {
            type: 'YOUTUBE',
            title: 'Nike Run Club / Running Form Essentials',
            url_or_payload: 'https://www.youtube.com/results?search_query=proper+running+cadence+form+mobility',
            why_recommended: 'Biomechanical drills to maximize economy and prevent shin splints/knee strain.',
          },
        ],
        pitfall_guardrail: {
          trap: 'Starting too fast in the first 10 minutes and blowing up your energy before the main block.',
          antidote: 'The Negative Split rule: the second half of the session should feel smoother than the first.',
        },
        fallbacks: {
          level_1_standard: `${totalMins}m: Complete planned volume and target pace blocks.`,
          level_2_reduced: `${reducedMins}m: Maintain Zone 2 conversational aerobic effort at 70% distance.`,
          level_3_mvs: `${mvsMins}m: Easy active recovery jog or brisk uphill walk to protect streak.`,
          level_4_substitute: `10m: Deep mobility stretches, foam rolling, and core activation.`,
        },
      };

    case 'LANGUAGE':
      return {
        objective: `Active verbal retrieval and communicative immersion for "${taskTitle}".`,
        checklist: [
          {
            step_number: 1,
            action: `Put on headphones, clear vocal apparatus, and practice 10 high-frequency target vocabulary phrases aloud.`,
            duration_minutes: step1Mins,
            is_checkpoint: false,
          },
          {
            step_number: 2,
            action: `Interactive audio shadowing or dialogue simulation: speak sentences in full cadence without reading English subtitles.`,
            duration_minutes: step2Mins,
            is_checkpoint: true,
          },
          {
            step_number: 3,
            action: `Record a 60-second unscripted voice memo explaining today's topic, and note down 3 words you struggled to retrieve.`,
            duration_minutes: step3Mins,
            is_checkpoint: true,
          },
        ],
        resources: [
          {
            type: 'TOOL',
            title: 'Anki Spaced Repetition Flashcards',
            url_or_payload: 'https://apps.ankiweb.net/',
            why_recommended: 'Scientifically proven Ebbinghaus forgetting-curve spaced retrieval.',
          },
          {
            type: 'YOUTUBE',
            title: `Search: "${taskTitle} conversational shadowing dialogue"`,
            url_or_payload: `https://www.youtube.com/results?search_query=${encodeURIComponent(taskTitle + ' conversation shadowing native pronunciation')}`,
            why_recommended: 'Native audio with natural intonation to build auditory and muscular speech memory.',
          },
        ],
        pitfall_guardrail: {
          trap: 'Silent passive reading instead of speaking out loud.',
          antidote: 'Tongue muscle memory rule: If you did not articulate it with your vocal cords, your brain will freeze in real conversation.',
        },
        fallbacks: {
          level_1_standard: `${totalMins}m: Full dialogue shadowing + audio voice memo test.`,
          level_2_reduced: `${reducedMins}m: 15 Anki flashcards aloud + 1 short dialogue repetition.`,
          level_3_mvs: `${mvsMins}m: 10 flashcards spoken aloud in front of a mirror.`,
          level_4_substitute: `10m: Listen to 1 target-language podcast or song while actively focusing on lyrics.`,
        },
      };

    default:
      return {
        objective: `Execute focused progress and produce tangible output for "${taskTitle}".`,
        checklist: [
          {
            step_number: 1,
            action: `Prepare physical space, eliminate notifications, and write the single outcome for this session on paper.`,
            duration_minutes: step1Mins,
            is_checkpoint: false,
          },
          {
            step_number: 2,
            action: `High-focus execution sprint: build, draft, or practice continuously without switching browser tabs.`,
            duration_minutes: step2Mins,
            is_checkpoint: true,
          },
          {
            step_number: 3,
            action: `Review output against quality criteria, log proof of work, and clean up workspace for tomorrow.`,
            duration_minutes: step3Mins,
            is_checkpoint: true,
          },
        ],
        resources: [
          {
            type: 'PROMPT',
            title: 'Deliberate Practice Socratic Coach Prompt',
            url_or_payload: `I am currently working on "${taskTitle}". Act as an expert mentor. Challenge me with 3 sharp diagnostic questions to ensure I am practicing at the edge of my comfort zone rather than mindlessly going through motions.`,
            why_recommended: 'Forces active cognitive engagement and deliberate practice.',
          },
          {
            type: 'YOUTUBE',
            title: `Search: "${taskTitle} masterclass guide"`,
            url_or_payload: `https://www.youtube.com/results?search_query=${encodeURIComponent(taskTitle + ' best practices masterclass')}`,
            why_recommended: 'Top-rated breakdowns and demonstrations from experienced practitioners.',
          },
        ],
        pitfall_guardrail: {
          trap: 'Decision fatigue and multi-tasking across unrelated tabs.',
          antidote: 'Single-tasking constraint: Close all tabs except the single tool required for this session.',
        },
        fallbacks: {
          level_1_standard: `${totalMins}m: Deep focus session with complete verified artifact.`,
          level_2_reduced: `${reducedMins}m: Focused 25m sprint producing the core draft or prototype.`,
          level_3_mvs: `${mvsMins}m: 10-minute setup and outline to keep momentum unbroken.`,
          level_4_substitute: `10m: Review notes, inspect mistakes from past sessions, and set tomorrow's workspace.`,
        },
      };
  }
}

/**
 * Synthesizes a tailored, high-grade Field Manual via Gemini with a 4-second timeout,
 * falling back seamlessly to deterministic domain rules.
 */
export async function generateFieldManual(
  taskTitle: string,
  category?: string,
  durationMinutes: number = 45,
  goalContext?: string,
  userMemory?: string
): Promise<TaskFieldManual> {
  const fallback = generateDeterministicFieldManual(taskTitle, category, durationMinutes, goalContext);

  const systemInstruction = `You are the Lead Field Manual Director for an executive execution system.
Your job is to provide a world-class, scientifically and socially proven "How-To Field Manual" for an individual daily focus task.

TASK SPECIFICATION:
- "objective": Exactly 1 crisp, binary, testable sentence defining completion (e.g. "Deploy Next.js landing page with working email collection to Vercel.").
- "checklist": Array of exactly 3 to 4 sequential, time-boxed steps. Each step must give an EXACT, non-vague command (e.g. "Run npx create-next-app with Tailwind and delete boilerplate styles", NOT "Start project"). Mark at least one step as "is_checkpoint": true.
- "resources": 2 to 3 high-leverage resources. MUST include a YouTube search link or real official doc/tool/template, plus an interactive AI pairing prompt.
- "pitfall_guardrail": Exactly 1 common beginner trap ("trap") and its psychological/tactical antidote ("antidote") (Section 9.10 Friction Model: eliminate setup, cognitive, or decision friction).
- "fallbacks": Predefined 4-level Fallback Hierarchy (Section 9.9):
  - "level_1_standard": Full planned duration description
  - "level_2_reduced": 60% duration description (reduced volume)
  - "level_3_mvs": 30% duration minimum viable dose (frictionless momentum saver)
  - "level_4_substitute": 10m mental simulation, review, or video breakdown

Return ONLY valid JSON matching this schema:
{
  "objective": "string",
  "checklist": [
    { "step_number": 1, "action": "string", "duration_minutes": number, "is_checkpoint": boolean }
  ],
  "resources": [
    { "type": "YOUTUBE" | "DOCS" | "TEMPLATE" | "PROMPT" | "TOOL", "title": "string", "url_or_payload": "string", "why_recommended": "string" }
  ],
  "pitfall_guardrail": {
    "trap": "string",
    "antidote": "string"
  },
  "fallbacks": {
    "level_1_standard": "string",
    "level_2_reduced": "string",
    "level_3_mvs": "string",
    "level_4_substitute": "string"
  }
}`;

  const prompt = `Task Title: "${taskTitle}"
Category: "${category || 'General'}"
Allocated Duration: ${durationMinutes} minutes
Goal Context: "${goalContext || ''}"
${userMemory ? `User Lifestyle & Constraint Memory: "${userMemory}"` : ''}

Generate the complete, beginner-proof Field Manual with exact actionable commands and zero fluff.`;

  try {
    const geminiCall = generateStructuredContent<TaskFieldManual>(prompt, systemInstruction);
    const timeoutPromise = new Promise<{ success: false; data: null; isFallback: true }>((resolve) =>
      setTimeout(() => resolve({ success: false, data: null, isFallback: true }), 4000)
    );

    const result = await Promise.race([geminiCall, timeoutPromise]);

    if (result.success && result.data && Array.isArray(result.data.checklist) && result.data.checklist.length > 0) {
      // Validate schema elements
      const data = result.data;
      if (data.objective && data.resources && data.pitfall_guardrail && data.fallbacks) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[FieldManualEngine] AI generation failed, using deterministic field manual:', err);
  }

  return fallback;
}
