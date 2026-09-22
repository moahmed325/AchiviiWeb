import { jsonrepair } from 'jsonrepair';

export interface ParsedModelJson<T> {
  data: T;
  repaired: boolean;
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

/**
 * Parse model output as JSON. Strict first; on failure, repair (bad tokens, trailing commas,
 * truncated tails) and parse again. Throws only when repair also fails.
 */
export function parseModelJson<T>(text: string): ParsedModelJson<T> {
  const body = stripFences(text);
  if (!body) throw new Error('Model returned an empty response');
  try {
    return { data: JSON.parse(body) as T, repaired: false };
  } catch (strictErr: any) {
    try {
      return { data: JSON.parse(jsonrepair(body)) as T, repaired: true };
    } catch {
      throw new Error(`Invalid JSON from model: ${strictErr?.message || strictErr}`);
    }
  }
}
