import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewSummaryCard } from './ReviewSummaryCard';
import { PhaseGateOutcomeCard } from './PhaseGateOutcomeCard';

// Weekly update M1.4 (WU-33 (3)): a week whose every practice day was not offered has no score: shown as not counted,
// never 0%, and with no benchmark line.
describe('a week with no score (weekly update M1.4)', () => {
  it('ReviewSummaryCard shows "Not counted", never 0%', () => {
    render(<ReviewSummaryCard scorePercentage={null} completedSessions={0} totalActiveSessions={0} />);
    expect(screen.getByText('Not counted')).toBeInTheDocument();
    expect(screen.getByText('No practice days were offered this week.')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/no logged practice/)).not.toBeInTheDocument();
  });

  it('ReviewSummaryCard with a score is unchanged', () => {
    render(<ReviewSummaryCard scorePercentage={60} completedSessions={3} totalActiveSessions={5} />);
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 practice sessions completed')).toBeInTheDocument();
  });

  it('PhaseGateOutcomeCard shows no benchmark line when there is no benchmark', () => {
    const { container } = render(<PhaseGateOutcomeCard gate={{ title: 'Base complete', completedPhase: 'Base', nextPhase: 'Build', benchmarkMet: null }} />);
    expect(container).toBeEmptyDOMElement();
    render(<PhaseGateOutcomeCard gate={{ title: 'Base complete', completedPhase: 'Base', nextPhase: 'Build', benchmarkMet: true }} />);
    expect(screen.getByText('Milestone Achieved')).toBeInTheDocument();
  });
});

// No weekly tests (2026-10-30): the summary shows the week's focus, never a target or a test.
describe('the review summary without weekly tests', () => {
  it("shows the focus, and no target or test line", () => {
    render(<ReviewSummaryCard scorePercentage={80} completedSessions={4} totalActiveSessions={5} theme="Easy aerobic running" />);
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('Easy aerobic running')).toBeInTheDocument();
    expect(screen.queryByText(/Target|Weekly test/)).not.toBeInTheDocument();
  });
});
