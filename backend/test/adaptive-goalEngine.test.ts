import { describe, it, expect } from 'vitest';
import {
  formalizeGoal,
  evaluateFeasibility,
  checkGoalIntegrity,
  inferDomain,
} from '../src/lib/adaptive/index.js';

describe('Adaptive Goal Engine & 90-Day Feasibility Gate', () => {
  describe('Domain Inference', () => {
    it('infers PHYSICAL domain from athletic and endurance keywords', () => {
      expect(inferDomain('Run a half marathon under 2 hours')).toBe('PHYSICAL');
      expect(inferDomain('Improve bench press and squat by 20kg')).toBe('PHYSICAL');
      expect(inferDomain('Complete Olympic distance triathlon')).toBe('PHYSICAL');
    });

    it('infers COGNITIVE domain from language and study keywords', () => {
      expect(inferDomain('Hold a 15-minute conversation in Spanish')).toBe('COGNITIVE');
      expect(inferDomain('Pass AWS Solutions Architect certification exam')).toBe('COGNITIVE');
    });

    it('infers PROJECT domain for software and business goals', () => {
      expect(inferDomain('Launch an MVP with 10 real paying users')).toBe('PROJECT');
      expect(inferDomain('Publish 12 technical blog articles')).toBe('PROJECT');
    });
  });

  describe('Goal Formalization', () => {
    it('formalizes raw goal with deterministic fallback when offline', async () => {
      const result = await formalizeGoal({
        rawGoal: 'Run a half marathon in 1:55',
        deadlineType: 'HARD',
      });

      expect(result.domain).toBe('PHYSICAL');
      expect(result.deadlineType).toBe('HARD');
      expect(result.concreteOutcomeStatement).toContain('half marathon');
      expect(result.verificationCriteria).toBeDefined();
      expect(result.baselineQuestions).toHaveLength(3);
      expect(result.targetDeadline).toBeInstanceOf(Date);
    });
  });

  describe('Feasibility Gate (Red / Yellow / Green)', () => {
    it('returns GREEN when weekly capacity leaves robust reliability margin >= 20%', () => {
      // 7h available, 5h MED -> margin = 2h (28.5% margin)
      const assessment = evaluateFeasibility({
        startingBaselineScore: 40,
        targetDifficultyScore: 70,
        weeklyAvailableHours: 7.0,
        requiredMedHours: 5.0,
        domain: 'PHYSICAL',
        deadlineDays: 90,
      });

      expect(assessment.zone).toBe('GREEN');
      expect(assessment.score).toBeGreaterThanOrEqual(0.75);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations[0]).toContain('reliability margin');
    });

    it('returns RED when required MED exceeds available capacity (margin < 0)', () => {
      // 5h available, 10h required -> margin = -5h
      const assessment = evaluateFeasibility({
        startingBaselineScore: 10,
        targetDifficultyScore: 90,
        weeklyAvailableHours: 5.0,
        requiredMedHours: 10.0,
        domain: 'PHYSICAL',
        deadlineDays: 90,
      });

      expect(assessment.zone).toBe('RED');
      expect(assessment.score).toBeLessThanOrEqual(0.45);
      expect(assessment.bottleneckRisks.length).toBeGreaterThan(0);
      expect(assessment.bottleneckRisks[0]).toContain('exceeds sustainable available capacity');
      expect(assessment.recommendations).toContainEqual(
        expect.stringContaining('Adjust goal destination')
      );
    });

    it('returns YELLOW when margin is tight between 5% and 20%', () => {
      // 6h available, 5.2h MED -> margin = 0.8h (13.3% margin)
      const assessment = evaluateFeasibility({
        startingBaselineScore: 30,
        targetDifficultyScore: 60,
        weeklyAvailableHours: 6.0,
        requiredMedHours: 5.2,
        domain: 'COGNITIVE',
        deadlineDays: 90,
      });

      expect(assessment.zone).toBe('YELLOW');
      expect(assessment.score).toBeGreaterThanOrEqual(0.6);
      expect(assessment.score).toBeLessThan(0.85);
      expect(assessment.bottleneckRisks[0]).toContain('Tight reliability margin');
      expect(assessment.recommendations).toContainEqual(
        expect.stringContaining('Protect critical-path')
      );
    });

    it('returns RED when starting capability gap is physiologically impossible in 90 days', () => {
      // Gap > 80 (e.g. baseline 5, target 95)
      const assessment = evaluateFeasibility({
        startingBaselineScore: 5,
        targetDifficultyScore: 95,
        weeklyAvailableHours: 12.0,
        domain: 'PHYSICAL',
        deadlineDays: 90,
      });

      expect(assessment.zone).toBe('RED');
      expect(assessment.bottleneckRisks).toContainEqual(
        expect.stringContaining('Starting capability gap (90 pts) is physiologically or technically unrealistic')
      );
    });
  });

  describe('Goal Integrity Audit', () => {
    it('returns INTACT when outcome and verification criteria are identical', () => {
      const status = checkGoalIntegrity(
        'Run a sub-2 hour half marathon',
        'Run a sub-2 hour half marathon',
        'Official sanctioned race chip time under 2:00:00',
        'Official sanctioned race chip time under 2:00:00'
      );

      expect(status).toBe('INTACT');
    });

    it('flags COMPROMISED on known silent destination downgrades', () => {
      // Half marathon silently lowered to 10k
      const runStatus = checkGoalIntegrity(
        'Run a half marathon',
        'Run 10km',
        'Official half marathon timing',
        'Complete 10km run'
      );
      expect(runStatus).toBe('COMPROMISED');

      // Spanish conversation silently downgraded to 500 words
      const langStatus = checkGoalIntegrity(
        'Hold a 30-minute conversation in Spanish',
        'Learn 500 words in Spanish',
        '15-minute unassisted dialogue',
        'Vocabulary flashcard completion'
      );
      expect(langStatus).toBe('COMPROMISED');

      // SaaS with 10 real users degraded to finish prototype
      const saasStatus = checkGoalIntegrity(
        'Launch MVP with 10 real users',
        'Finish prototype only',
        '10 active users using core workflow',
        'Code runs on localhost'
      );
      expect(saasStatus).toBe('COMPROMISED');
    });

    it('returns REVISED when explicitly marked as a conscious user revision', () => {
      const status = checkGoalIntegrity(
        'Run a half marathon',
        '[REVISED] Run a 10k race due to knee recovery',
        'Official race timing',
        '10k race timing'
      );

      expect(status).toBe('REVISED');
    });

    it('returns AT_RISK when minor criteria change occurs without clear degradation', () => {
      const status = checkGoalIntegrity(
        'Launch SaaS MVP with 10 users',
        'Launch SaaS MVP with 10 beta testers',
        'Verified stripe payments from 10 customers',
        'Verified active weekly usage from 10 beta testers'
      );

      expect(status).toBe('AT_RISK');
    });
  });
});
