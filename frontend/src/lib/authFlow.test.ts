import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { findPathwayBySlug } from './certifiedPresets';
import {
  authSwitchHref,
  describeAuthError,
  resolvePostAuthDestination,
  safeNext,
  validateEmail,
  validatePassword,
} from './authFlow';

describe('safeNext', () => {
  it('keeps internal paths with their query and hash', () => {
    expect(safeNext('/roadmap')).toBe('/roadmap');
    expect(safeNext('/dashboard?week=3#today')).toBe('/dashboard?week=3#today');
  });

  it.each([
    null,
    '',
    'roadmap',
    'https://evil.example/x',
    '//evil.example/x',
    '/\\evil.example/x',
    '/\t/evil.example',
    'javascript:alert(1)',
  ])('rejects %j', (raw) => {
    expect(safeNext(raw)).toBeNull();
  });

  it('rejects the auth screens so a redirect cannot loop', () => {
    expect(safeNext('/login')).toBeNull();
    expect(safeNext('/signup?pathway=run10k')).toBeNull();
  });
});

describe('findPathwayBySlug', () => {
  it('finds a pathway by id and ignores unknown or empty slugs', () => {
    expect(findPathwayBySlug('run10k')?.title).toBe('Run a 10K Under 50 Minutes');
    expect(findPathwayBySlug('not-a-pathway')).toBeUndefined();
    expect(findPathwayBySlug(null)).toBeUndefined();
  });
});

describe('resolvePostAuthDestination', () => {
  const pathway = findPathwayBySlug('run10k');

  it('sends a new user with a pathway to onboarding with the preset selected', () => {
    expect(resolvePostAuthDestination({ pathway, next: null, hasGoal: false, goalLoadFailed: false })).toEqual({
      to: '/onboarding',
      state: { presetGoal: pathway!.title, isPreset: true, switchGoal: true },
      draftGoal: pathway!.title,
    });
  });

  it('keeps an existing goal when a pathway was chosen, with a quiet note on Today', () => {
    expect(resolvePostAuthDestination({ pathway, next: '/roadmap', hasGoal: true, goalLoadFailed: false })).toEqual({
      to: '/',
      state: { pathwayNotice: pathway!.title },
    });
  });

  it('lands on Today when the goal fetch failed, whatever else was asked for', () => {
    expect(resolvePostAuthDestination({ pathway, next: null, hasGoal: false, goalLoadFailed: true })).toEqual({ to: '/' });
    expect(resolvePostAuthDestination({ next: '/roadmap', hasGoal: false, goalLoadFailed: true })).toEqual({ to: '/' });
  });

  it('honours an internal next and ignores an external one', () => {
    expect(resolvePostAuthDestination({ next: '/roadmap', hasGoal: true, goalLoadFailed: false })).toEqual({ to: '/roadmap' });
    expect(resolvePostAuthDestination({ next: '//evil.example', hasGoal: true, goalLoadFailed: false })).toEqual({ to: '/' });
  });

  it('defaults to Today with a goal and onboarding without one', () => {
    expect(resolvePostAuthDestination({ next: null, hasGoal: true, goalLoadFailed: false })).toEqual({ to: '/' });
    expect(resolvePostAuthDestination({ next: null, hasGoal: false, goalLoadFailed: false })).toEqual({ to: '/onboarding' });
  });
});

describe('authSwitchHref', () => {
  it('carries pathway and next only', () => {
    const params = new URLSearchParams('pathway=saas&next=%2Froadmap&utm=x');
    expect(authSwitchHref('login', params)).toBe('/login?pathway=saas&next=%2Froadmap');
    expect(authSwitchHref('signup', new URLSearchParams())).toBe('/signup');
  });
});

describe('describeAuthError', () => {
  it('maps each failure to its own kind', () => {
    expect(describeAuthError(new ApiError('An account with this email already exists.', 409)).kind).toBe('duplicate');
    expect(describeAuthError(new ApiError('Invalid email or password.', 401)).kind).toBe('credentials');
    expect(describeAuthError(new ApiError('Please provide a valid email address.', 400))).toEqual({
      kind: 'invalid',
      message: 'Please provide a valid email address.',
    });
    expect(describeAuthError(new TypeError('Failed to fetch')).kind).toBe('offline');
    expect(describeAuthError(new ApiError('Internal server error during registration.', 500)).kind).toBe('server');
    expect(describeAuthError(new SyntaxError('Unexpected token <')).kind).toBe('server');
  });
});

describe('validation', () => {
  it('matches the backend rules', () => {
    expect(validateEmail('')).toBeDefined();
    expect(validateEmail('name.example.com')).toBeDefined();
    expect(validateEmail('  name@example.com ')).toBeUndefined();
    expect(validatePassword('12345', 'signup')).toBe('Use at least 6 characters.');
    expect(validatePassword('123456', 'signup')).toBeUndefined();
    expect(validatePassword('1', 'login')).toBeUndefined();
    expect(validatePassword('', 'login')).toBe('Enter your password.');
  });
});
