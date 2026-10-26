import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { flagSummary } from './lib/flags.js';
import { goalRouter } from './routes/goal.js';
import { billingRouter } from './routes/billing.js';
import { webhookRouter } from './routes/webhook.js';
import { remindersRouter } from './routes/reminders.js';
import { installRequestLogging, requestContext } from './lib/requestContext.js';
import { errorHandler } from './lib/httpErrors.js';

dotenv.config();

// B-105: every log line inside a request carries its id.
installRequestLogging();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Parse allowed origins from environment variable (supports comma-separated list)
const configuredOrigins = CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];
const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]));

// Dynamic CORS configuration supporting production domains and Vercel preview deployments (*.vercel.app)
// B-99 (6): Render sits in front as one proxy hop, so req.ip is the client's (the rate limit reads it).
app.set('trust proxy', 1);

// B-105: first, so every request (the webhook included) has an id.
app.use(requestContext);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, health checks, server-to-server)
    if (!origin) return callback(null, true);

    const isExplicitlyAllowed = allowedOrigins.includes(origin);
    const isVercelDomain = /^https:\/\/[a-zA-Z0-9-_.]+\.vercel\.app$/.test(origin);

    if (isExplicitlyAllowed || isVercelDomain) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  // B-105: the app can read the request id to show it with an error.
  exposedHeaders: ['X-Request-Id'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // X-Client-Timezone: the browser's IANA zone, used to correct a user still on the default UTC (routes/auth.ts).
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Client-Timezone'],
}));
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookRouter);
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/goal', goalRouter);
app.use('/api/billing', billingRouter);
app.use('/api/reminders', remindersRouter);

// B-105: last: typed errors and anything unhandled, answered in one place.
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Achivii Backend API running on http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  // B-99 (4): which feature switches this process starts with (each is still read per request).
  console.log(`[Flags] ${flagSummary()}`);
});
