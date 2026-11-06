import type { Request } from 'express';

/**
 * ND-42: a person has one main plan (status `active`) and, with Pro, at most one skill running alongside it (status
 * `alongside`). The main plan's queries are unchanged; a request about the alongside plan says so in this header.
 */
export const PLAN_HEADER = 'x-achivii-plan';

export type PlanRole = 'main' | 'alongside';

export const ALONGSIDE_STATUS = 'alongside';

/** The plan a request is about: the main plan unless the header names the alongside one. */
export function planOf(req: Pick<Request, 'headers'>): PlanRole {
  return req.headers[PLAN_HEADER] === 'alongside' ? 'alongside' : 'main';
}

/** The stored status of a plan in that role. */
export const statusOf = (role: PlanRole): string => (role === 'alongside' ? ALONGSIDE_STATUS : 'active');

/** Both running plans, for code that acts on whichever owns a task (reminders, task routes). */
export const RUNNING_STATUSES = ['active', ALONGSIDE_STATUS];
