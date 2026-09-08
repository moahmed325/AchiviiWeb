import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { onboardingRouter, userGoalRouter } from './routes/onboarding.js';
import { sessionsRouter } from './routes/sessions.js';
import { progressRouter } from './routes/progress.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: [CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
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

app.listen(PORT, () => {
  console.log(`🚀 Achivii Backend API running on http://localhost:${PORT}`);
  console.log(`  └─ Health Check: http://localhost:${PORT}/api/health`);
});
