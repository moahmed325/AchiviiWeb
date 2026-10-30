/** Longest first name kept; anything longer is cut, so a pasted sentence never fills the greeting. */
export const FIRST_NAME_MAX = 40;

/** A name as typed: spaces tidied, cut to `FIRST_NAME_MAX`; empty means none. */
export const cleanFirstName = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, FIRST_NAME_MAX).trim();

/**
 * The name the Dashboard greets by, from the Supabase user's metadata: the one the person gave us (`first_name`, at
 * sign-up or in Account), else Google's given name, else the first word of the full name. Null when there is none.
 */
export function firstNameFrom(metadata: Record<string, unknown> | null | undefined): string | null {
  const text = (key: string) => (typeof metadata?.[key] === 'string' ? cleanFirstName(metadata[key] as string) : '');
  const name = text('first_name') || text('given_name') || (text('full_name') || text('name')).split(' ')[0];
  return name || null;
}
