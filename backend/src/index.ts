import dotenv from 'dotenv';
import { createApp } from './app.js';
import { flagSummary } from './lib/flags.js';
import { installRequestLogging } from './lib/requestContext.js';

dotenv.config();

// B-105: every log line inside a request carries its id.
installRequestLogging();

const PORT = process.env.PORT || 5000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Achivii Backend API running on http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  // B-99 (4): which feature switches this process starts with (each is still read per request).
  console.log(`[Flags] ${flagSummary()}`);
});
