import React from 'react';
import { stepLines, type DoneDays, type StepText } from '../../lib/stepLines';

/**
 * A step's instructions in Today and Focus (method-aware recovery M3.3). With no lead line it is the one paragraph
 * it always was. Otherwise the continue line (RULE-10) and the stored easy and warm-up lines (RULE-21, MR-26) each
 * get their own line above the rest, in the same text style. `className` is the paragraph's own style. `doneDays`
 * (from `doneDaysOf` in `lib/stepLines`): a continue line whose day is done is not shown (B-50).
 */
export const StepInstructions: React.FC<{
  step: StepText;
  className: string;
  doneDays?: DoneDays;
}> = ({ step, className, doneDays }) => {
  const { lead, body } = stepLines(step, doneDays);
  if (lead.length === 0) return body ? <p className={className}>{body}</p> : null;
  return (
    <div className={className}>
      {[...lead, ...(body ? [body] : [])].map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );
};
