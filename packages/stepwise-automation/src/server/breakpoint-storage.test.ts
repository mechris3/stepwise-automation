import { describe, it, expect, beforeEach } from 'vitest';
import { setBreakpoints, getBreakpoints, clearBreakpoints, clearAll } from './breakpoint-storage';

describe('breakpoint-storage', () => {
  beforeEach(() => {
    clearAll();
  });

  it('returns empty array for unknown journey', () => {
    expect(getBreakpoints('unknown')).toEqual([]);
  });

  it('stores and retrieves breakpoints for a journey', () => {
    setBreakpoints('login', [1, 5, 10]);
    expect(getBreakpoints('login')).toEqual([1, 5, 10]);
  });

  it('overwrites breakpoints on subsequent set', () => {
    setBreakpoints('login', [1, 2]);
    setBreakpoints('login', [3, 4]);
    expect(getBreakpoints('login')).toEqual([3, 4]);
  });

  it('stores breakpoints independently per journey', () => {
    setBreakpoints('login', [1, 2]);
    setBreakpoints('checkout', [5, 6]);
    expect(getBreakpoints('login')).toEqual([1, 2]);
    expect(getBreakpoints('checkout')).toEqual([5, 6]);
  });

  it('clears breakpoints for a specific journey', () => {
    setBreakpoints('login', [1, 2]);
    setBreakpoints('checkout', [5, 6]);
    clearBreakpoints('login');
    expect(getBreakpoints('login')).toEqual([]);
    expect(getBreakpoints('checkout')).toEqual([5, 6]);
  });

  it('clearAll removes all journey breakpoints', () => {
    setBreakpoints('login', [1, 2]);
    setBreakpoints('checkout', [5, 6]);
    clearAll();
    expect(getBreakpoints('login')).toEqual([]);
    expect(getBreakpoints('checkout')).toEqual([]);
  });

  it('does not share reference with caller', () => {
    const indices = [1, 2, 3];
    setBreakpoints('login', indices);
    indices.push(99);
    expect(getBreakpoints('login')).toEqual([1, 2, 3]);
  });
});
