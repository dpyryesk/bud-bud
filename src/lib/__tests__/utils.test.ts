import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
  it('returns a single class name unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple class names with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values (undefined, null, false)', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('handles conditional classes via object syntax', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });

  it('handles mixed string and object arguments', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });

  it('handles array of class names', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge should resolve conflicts: p-4 overrides p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('merges conflicting Tailwind text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('does not deduplicate non-conflicting Tailwind classes', () => {
    const result = cn('flex', 'items-center', 'justify-between');
    expect(result).toBe('flex items-center justify-between');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns empty string for all falsy arguments', () => {
    expect(cn(undefined, null, false)).toBe('');
  });

  it('handles conditional overrides — later conditional wins', () => {
    // bg-red-500 from the object should override bg-blue-500 from the string
    expect(cn('bg-blue-500', { 'bg-red-500': true })).toBe('bg-red-500');
  });

  it('handles deeply nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
  });
});
