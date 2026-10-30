import React from 'react';
import { useFirstName } from '../../context/AuthContext';
import { FIRST_NAME_MAX, cleanFirstName } from '../../lib/firstName';
import { Button, Field, Input } from '../ui';

/** One field and Save for the name the Dashboard greets by. A failed save says so and keeps what was typed. */
export const NameForm: React.FC<{ onSaved?: () => void; label?: string }> = ({ onSaved, label = 'Your first name' }) => {
  const { firstName, setFirstName } = useFirstName();
  const [value, setValue] = React.useState(firstName ?? '');
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  if (!setFirstName) return null;
  const unchanged = cleanFirstName(value) === (firstName ?? '');
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFailed(false);
    try {
      await setFirstName(value);
      onSaved?.();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} className="flex items-end gap-2">
      <Field label={label} error={failed ? "That didn't save. Please try again." : undefined} className="min-w-0 flex-1">
        <Input name="first-name" autoComplete="given-name" maxLength={FIRST_NAME_MAX} value={value} onChange={(event) => setValue(event.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" loading={saving} disabled={unchanged} className="shrink-0">
        Save
      </Button>
    </form>
  );
};
