/**
 * JSON Schemas passed to Gemini as responseJsonSchema.
 * Keep to keywords Gemini accepts: type, properties, required, items, enum, description.
 * gemini-3.5-flash-lite returns 400 INVALID_ARGUMENT for minItems/maxItems, so array lengths
 * are checked after the call instead.
 */

const challengeSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['repetitions', 'active_recall', 'checklist', 'exercise'] },
    drillName: { type: 'string' },
    targetCount: { type: 'number' },
    totalSets: { type: 'number' },
    unit: { type: 'string' },
    question: { type: 'string' },
    hint: { type: 'string' },
    keyTakeaway: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, label: { type: 'string' } },
        required: ['id', 'label'],
      },
    },
    prompt: { type: 'string' },
    targetDeliverable: { type: 'string' },
    evaluationCriteria: { type: 'string' },
  },
  required: ['type'],
};

const stepSchema = {
  type: 'object',
  properties: {
    stepNumber: { type: 'integer' },
    title: { type: 'string' },
    durationMinutes: { type: 'integer' },
    instructions: { type: 'string' },
    focusCue: { type: 'string' },
    pitfallToAvoid: { type: 'string' },
    passMark: { type: 'string' },
    output: { type: 'string' },
    timing: { type: 'string' },
    challenge: challengeSchema,
    resourceTitle: { type: 'string' },
    resourceUrl: { type: 'string' },
    resourceType: {
      type: 'string',
      enum: ['youtube_video', 'documentation', 'scientific_study', 'interactive_tool', 'guide'],
    },
    resourceWhy: { type: 'string' },
  },
  required: [
    'stepNumber',
    'title',
    'durationMinutes',
    'instructions',
    'focusCue',
    'pitfallToAvoid',
    'passMark',
    'output',
  ],
};

const taskSchema = {
  type: 'object',
  properties: {
    dayNumber: { type: 'integer' },
    dayOfWeek: { type: 'string' },
    title: { type: 'string' },
    isRestDay: { type: 'boolean' },
    durationMinutes: { type: 'integer' },
    slotTime: { type: 'string' },
    implementationIntention: { type: 'string' },
    detailedSteps: { type: 'array', items: stepSchema },
  },
  required: [
    'dayNumber',
    'dayOfWeek',
    'title',
    'isRestDay',
    'durationMinutes',
    'slotTime',
    'implementationIntention',
    'detailedSteps',
  ],
};

export const WEEK_TASKS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    tasks: { type: 'array', items: taskSchema, description: 'Exactly 7 days.' },
  },
  required: ['tasks'],
};
