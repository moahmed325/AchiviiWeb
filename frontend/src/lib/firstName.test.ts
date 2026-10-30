import { describe, expect, it } from 'vitest';
import { cleanFirstName, firstNameFrom } from './firstName';

describe('firstNameFrom', () => {
  it('prefers the name the person gave, then Google’s given name, then the first word of the full name', () => {
    expect(firstNameFrom({ first_name: 'Mo', given_name: 'Mohamed' })).toBe('Mo');
    expect(firstNameFrom({ given_name: 'Mohamed', full_name: 'Mohamed Saeed' })).toBe('Mohamed');
    expect(firstNameFrom({ full_name: '  Mohamed   Saeed ' })).toBe('Mohamed');
    expect(firstNameFrom({ name: 'Leo' })).toBe('Leo');
  });

  it('is null with no name, a blank one or a non-string', () => {
    expect(firstNameFrom(undefined)).toBeNull();
    expect(firstNameFrom({ timezone: 'UTC' })).toBeNull();
    expect(firstNameFrom({ first_name: '   ', full_name: 42 })).toBeNull();
  });

  it('tidies spaces and cuts a very long name', () => {
    expect(cleanFirstName('  Anne  Marie ')).toBe('Anne Marie');
    expect(cleanFirstName('x'.repeat(60))).toHaveLength(40);
  });
});
