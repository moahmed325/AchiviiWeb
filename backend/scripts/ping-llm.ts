/**
 * One-shot check that the primary LLM (Gemini) answers.
 * Prints only ok/fail — never keys or raw provider payloads.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStructuredContent, DEFAULT_GEMINI_MODEL } from '../src/lib/ai/gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function sanitize(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[redacted]')
    .replace(/AQ\.[0-9A-Za-z_\-]{10,}/g, '[redacted]')
    .replace(/gsk_[0-9A-Za-z]{10,}/g, '[redacted]')
    .replace(/key[=:]\s*["']?[^"'\s]+/gi, 'key=[redacted]');
}

const result = await generateStructuredContent<{ ok: boolean }>(
  'Respond with JSON: {"ok": true}',
  'You only output JSON.'
);

if (result.success && result.data?.ok) {
  console.log(`[ping] ok provider=${result.provider} model=${DEFAULT_GEMINI_MODEL} ${result.usage?.durationMs ?? '?'}ms`);
  process.exit(0);
}

console.error(`[ping] fail provider=${result.provider ?? 'none'} ${sanitize(result.error || 'no error')}`);
process.exit(1);
