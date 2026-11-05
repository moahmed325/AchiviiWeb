/**
 * ND-40: a message that speaks of self-harm or suicide never goes to the model. The coach answers with one fixed,
 * caring reply that points to real help. Matching is deliberately broad: a false match costs one gentle reply.
 */
const CRISIS = [
  /\bkill(?:ing)?\s+my\s*self\b/i,
  /\bsuicid/i,
  /\bend(?:ing)?\s+(?:it\s+all|my\s+life|my\s+own\s+life)\b/i,
  /\b(?:want|wanna)\s+(?:to\s+)?die\b/i,
  /\bdon'?t\s+want\s+to\s+(?:live|be\s+alive|be\s+here)\b/i,
  /\bself[-\s]?harm/i,
  /\bhurt(?:ing)?\s+my\s*self\b/i,
  /\bcut(?:ting)?\s+my\s*self\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+dead\b/i,
];

export const CRISIS_REPLY =
  "I'm really glad you told me, and I'm sorry you're carrying this. Your plan can wait; you matter more than any goal. " +
  'Please reach out to someone right now: if you are in danger, call your local emergency number. In the US you can call ' +
  'or text 988, in the UK and Ireland call Samaritans on 116 123, and findahelpline.com lists free, confidential lines in ' +
  'other countries. Talking to someone you trust today can help too.';

export const isCrisisMessage = (text: string): boolean => CRISIS.some((pattern) => pattern.test(text));
