import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { onboardingRouter, userGoalRouter } from './routes/onboarding.js';
import { sessionsRouter } from './routes/sessions.js';
import { progressRouter } from './routes/progress.js';
import { recoveryRouter } from './routes/recovery.js';
import { reflectionRouter } from './routes/reflection.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Parse allowed origins from environment variable (supports comma-separated list)
const configuredOrigins = CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]));

// Dynamic CORS configuration supporting production domains and Vercel preview deployments (*.vercel.app)
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/user-goal', userGoalRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/recovery', recoveryRouter);
app.use('/api/reflection', reflectionRouter);

app.listen(PORT, () => {
  console.log(`🚀 Achivii Backend API running on http://localhost:${PORT}`);
  console.log(`  └─ Health Check: http://localhost:${PORT}/api/health`);
});
