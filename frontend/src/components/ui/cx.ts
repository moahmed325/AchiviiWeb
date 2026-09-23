export type ClassValue = string | false | null | undefined;

/** Joins class names, skipping falsy values. No conflict resolution: pass layout classes, not restyles. */
export const cx = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');
