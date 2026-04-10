import { describe, it, expect } from 'vitest';
import { formatTestError, getErrorSummary } from './error-formatter';

describe('formatTestError', () => {
  it('includes error message in output', () => {
    const error = new Error('Element not found');
    const result = formatTestError(error);
    expect(result).toContain('Element not found');
    expect(result).toContain('TEST AUTOMATION FAILURE');
  });

  it('includes journey context when provided', () => {
    const error = new Error('Timeout');
    const result = formatTestError(error, { journeyName: 'login-flow' });
    expect(result).toContain('Journey: login-flow');
  });

  it('includes timestamp and duration when provided', () => {
    const error = new Error('Timeout');
    const result = formatTestError(error, {
      timestamp: '2024-01-01T00:00:00Z',
      duration: 5000,
    });
    expect(result).toContain('Time: 2024-01-01T00:00:00Z');
    expect(result).toContain('Duration: 5000ms');
  });

  it('handles error without stack trace', () => {
    const error = new Error('No stack');
    error.stack = undefined;
    const result = formatTestError(error);
    expect(result).toContain('No stack');
  });
});

describe('getErrorSummary', () => {
  it('returns error message for errors without app code in stack', () => {
    const error = new Error('Something failed');
    error.stack = 'Error: Something failed\n    at node_modules/foo.js:1:1';
    const result = getErrorSummary(error);
    expect(result).toBe('Something failed');
  });

  it('includes method info when app code is in stack', () => {
    const error = new Error('Click failed');
    error.stack =
      'Error: Click failed\n    at LoginPage.clickSubmit (/app/login.page.ts:10:5)';
    const result = getErrorSummary(error);
    expect(result).toContain('Click failed');
    expect(result).toContain('LoginPage.clickSubmit');
  });
});
