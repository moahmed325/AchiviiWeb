import { Router, Request, Response } from 'express';
import { getAuthUser } from './auth.js';
import { calculateProductSuccessMetrics, trackProductEvent } from '../lib/analytics.js';

export const analyticsRouter = Router();

// GET /api/analytics/success-criteria
analyticsRouter.get('/success-criteria', async (req: Request, res: Response): Promise<void> => {
  try {
    const metrics = await calculateProductSuccessMetrics();
    res.status(200).json(metrics);
  } catch (error: any) {
    console.error('Failed to calculate success criteria metrics:', error);
    res.status(500).json({ error: error.message || 'Failed to compute analytics.' });
  }
});

// POST /api/analytics/track
analyticsRouter.post('/track', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    const { event_name, metadata } = req.body;

    if (!event_name) {
      res.status(400).json({ error: 'event_name is required.' });
      return;
    }

    const event = trackProductEvent(event_name, user?.id, metadata);
    res.status(201).json({ success: true, event });
  } catch (error: any) {
    console.error('Failed to record telemetry event:', error);
    res.status(500).json({ error: error.message || 'Failed to record event.' });
  }
});
