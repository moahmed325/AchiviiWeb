import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const catalogRouter = Router();

// GET /api/catalog - List all goals in the catalog with phases & task blueprints
catalogRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const goals = await prisma.goalCatalog.findMany({
      orderBy: { created_at: 'asc' },
      include: {
        phases: {
          orderBy: { phase_order: 'asc' },
          include: {
            task_templates: true,
          },
        },
      },
    });

    res.status(200).json({ goals });
  } catch (error: any) {
    console.error('Fetch catalog error:', error);
    res.status(500).json({ error: 'Failed to retrieve goal catalog.' });
  }
});

// GET /api/catalog/:id - Get a specific goal by ID
catalogRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const goal = await prisma.goalCatalog.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { phase_order: 'asc' },
          include: {
            task_templates: true,
          },
        },
      },
    });

    if (!goal) {
      res.status(404).json({ error: 'Goal not found in catalog.' });
      return;
    }

    res.status(200).json({ goal });
  } catch (error: any) {
    console.error('Fetch goal by ID error:', error);
    res.status(500).json({ error: 'Failed to retrieve goal.' });
  }
});
