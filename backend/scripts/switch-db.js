import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = process.argv[2]?.toLowerCase();
if (!['postgres', 'postgresql', 'sqlite'].includes(target)) {
  console.error('Usage: node scripts/switch-db.js [postgres|sqlite]');
  process.exit(1);
}

const provider = target === 'sqlite' ? 'sqlite' : 'postgresql';
const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

let content = fs.readFileSync(schemaPath, 'utf8');
content = content.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`);

fs.writeFileSync(schemaPath, content, 'utf8');
console.log(`✅ Updated prisma/schema.prisma datasource provider to: "${provider}"`);
