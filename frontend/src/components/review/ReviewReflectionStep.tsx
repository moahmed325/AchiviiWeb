import React from 'react';
import { Field, Textarea } from '../ui/Field';

export interface ReviewReflectionStepProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
}

/**
 * Reflection capture interface for weekly review (BP §17, §33).
 * Encourages thoughtful evaluation of the past week's practice.
 */
export const ReviewReflectionStep: React.FC<ReviewReflectionStepProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <Field
        label="What worked? What could be better?"
        hint="Take a quiet moment to reflect on your practice."
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Morning sessions went well. Got distracted Thursday..."
          rows={3}
          disabled={disabled}
          className="min-h-[100px] resize-y"
          aria-invalid={Boolean(error)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export default ReviewReflectionStep;
