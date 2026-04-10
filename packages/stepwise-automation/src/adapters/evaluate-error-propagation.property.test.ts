import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 6.2**
 *
 * Feature: evaluate-method, Property 4: Error propagation for invalid scripts
 *
 * For any string that is not valid JavaScript (syntax errors, undefined
 * references), calling evaluate(script) should reject with an error that
 * propagates to the caller, rather than silently returning undefined or
 * swallowing the exception.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock Puppeteer page whose evaluate throws for any input */
function makeMockPuppeteerPage(error: Error) {
  return {
    evaluate: vi.fn().mockRejectedValue(error),
    url: vi.fn().mockReturnValue('about:blank'),
    createCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
  };
}

/** Creates a mock Playwright page whose evaluate throws for any input */
function makeMockPlaywrightPage(error: Error) {
  return {
    evaluate: vi.fn().mockRejectedValue(error),
    url: vi.fn().mockReturnValue('about:blank'),
    context: vi.fn().mockReturnValue({
      clearCookies: vi.fn(),
      newCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
    }),
  };
}

// ── Mock BaseAdapter to avoid signal/IPC side effects ────────────────────────

vi.mock('./base-adapter', () => {
  class MockBaseAdapter {
    protected async logAndCheckAction(_desc: string): Promise<void> {}
    protected logActionComplete(): void {}
    protected async addSlowModeDelay(): Promise<void> {}
    protected resolveUrl(url: string): string { return url; }
    protected ensureDownloadDir(): string { return '/tmp'; }
    protected deriveOrigin(url: string): string | null {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;
      } catch { /* ignore */ }
      return null;
    }
  }
  return { BaseAdapter: MockBaseAdapter };
});

vi.mock('../utils/puppeteer-utils', () => ({
  clickWithAngularSupport: vi.fn(),
  fillWithAngularEvents: vi.fn(),
  selectByIndex: vi.fn(),
  selectByValue: vi.fn(),
  selectByText: vi.fn(),
}));

vi.mock('../utils/playwright-utils', () => ({
  clickWithAngularSupport: vi.fn(),
  fillWithAngularEvents: vi.fn(),
  waitForElement: vi.fn(),
  getText: vi.fn(),
  scrollIntoViewAndClick: vi.fn(),
}));

import { PuppeteerAdapter } from './puppeteer-adapter';
import { PlaywrightAdapter } from './playwright-adapter';

// ── Generators ───────────────────────────────────────────────────────────────

/** Generates invalid JS strings that would cause syntax or runtime errors */
const invalidJsStringArb = fc.oneof(
  // Unmatched brackets/parens
  fc.constantFrom(
    '{{{',
    '(((',
    '[[[',
    'function(',
    'if {',
    'var = ;',
    'return return',
    '+++',
    '////',
  ),
  // Random strings with unmatched delimiters
  fc.stringMatching(/^[{(\[!@#$%^&*]+$/).filter(s => s.length > 0),
  // Reserved words used incorrectly
  fc.constantFrom(
    'class class',
    'const const',
    'let = >',
    'throw',
    'new new',
    'import export',
  ),
);

/** Generates random error messages */
const errorMessageArb = fc.oneof(
  fc.string({ minLength: 1 }),
  fc.constantFrom(
    'SyntaxError: Unexpected token',
    'ReferenceError: x is not defined',
    'TypeError: Cannot read properties of undefined',
    'EvalError: invalid script',
  ),
);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 4: Error propagation for invalid scripts', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── PuppeteerAdapter ───────────────────────────────────────────────────

  describe('PuppeteerAdapter', () => {

    it('PBT: invalid script errors propagate to the caller', async () => {
      // Feature: evaluate-method, Property 4: Error propagation for invalid scripts
      await fc.assert(
        fc.asyncProperty(invalidJsStringArb, errorMessageArb, async (script, errorMsg) => {
          const error = new Error(errorMsg);
          const page = makeMockPuppeteerPage(error);
          const adapter = new PuppeteerAdapter(page as any);

          await expect(adapter.evaluate(script)).rejects.toThrow(error);
          expect(page.evaluate).toHaveBeenCalledWith(script);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── PlaywrightAdapter ──────────────────────────────────────────────────

  describe('PlaywrightAdapter', () => {

    it('PBT: invalid script errors propagate to the caller', async () => {
      // Feature: evaluate-method, Property 4: Error propagation for invalid scripts
      await fc.assert(
        fc.asyncProperty(invalidJsStringArb, errorMessageArb, async (script, errorMsg) => {
          const error = new Error(errorMsg);
          const page = makeMockPlaywrightPage(error);
          const adapter = new PlaywrightAdapter(page as any);

          await expect(adapter.evaluate(script)).rejects.toThrow(error);
          expect(page.evaluate).toHaveBeenCalledWith(script);
        }),
        { numRuns: 100 },
      );
    });
  });
});
