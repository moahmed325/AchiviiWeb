import { Router, Request, Response } from 'express';
import { getAuthUser } from './auth.js';
import {
  getActiveNotifications,
  recordNotificationDelivery,
  dismissNotification,
  checkFrequencyCap,
  NotificationType,
} from '../lib/notifications.js';

export const notificationsRouter = Router();

// GET /api/notifications
notificationsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const notifications = await getActiveNotifications(user.id);
    res.status(200).json({ notifications });
  } catch (error: any) {
    console.error('Failed to get notifications:', error);
    res.status(500).json({ error: error.message || 'Failed to get notifications.' });
  }
});

// POST /api/notifications/log-delivery
notificationsRouter.post('/log-delivery', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { type } = req.body as { type: NotificationType };
    if (!type) {
      res.status(400).json({ error: 'Notification type is required.' });
      return;
    }

    const cap = checkFrequencyCap(user.id, type);
    if (!cap.allowed) {
      res.status(429).json({ error: cap.reason });
      return;
    }

    const record = recordNotificationDelivery(user.id, type);
    res.status(201).json({ success: true, record });
  } catch (error: any) {
    console.error('Failed to log notification delivery:', error);
    res.status(500).json({ error: error.message || 'Failed to log delivery.' });
  }
});

// POST /api/notifications/dismiss
notificationsRouter.post('/dismiss', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { notification_id } = req.body;
    if (!notification_id) {
      res.status(400).json({ error: 'notification_id is required.' });
      return;
    }

    const dismissed = dismissNotification(user.id, notification_id);
    res.status(200).json({ success: true, dismissed });
  } catch (error: any) {
    console.error('Failed to dismiss notification:', error);
    res.status(500).json({ error: error.message || 'Failed to dismiss notification.' });
  }
});
