import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 1.2, 1.3, 2.1, 3.1**
 *
 * Feature: evaluate-method, Property 1: Evaluate type dispatch and delegation
 *
 * For any adapter (PuppeteerAdapter or PlaywrightAdapter) and for any input
 * that is either a string or a function, calling evaluate(input) should
 * delegate to this.page.evaluate(input) and return the same result that
 * page.evaluate returns.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock Puppeteer page with a spied evaluate */
function makeMockPuppeteerPage() {
  return {
    evaluate: vi.fn(),
    url: vi.fn().mockReturnValue('about:blank'),
    createCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
  };
}

/** Creates a mock Playwright page with a spied evaluate */
function makeMockPlaywrightPage() {
  return {
    evaluate: vi.fn(),
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

/** Generates random JS expression strings */
const jsStringArb = fc.oneof(
  fc.stringMatching(/^[a-zA-Z0-9+\-*/ '.()]+$/),
  fc.constantFrom("1+1", "'hello'", "document.title", "42", "true", "null", "Math.PI"),
);

/** Generates random primitive values that page.evaluate might return */
const primitiveArb = fc.oneof(
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.string(),
  fc.boolean(),
  fc.constant(null),
);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 1: Evaluate type dispatch and delegation', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── PuppeteerAdapter: string input ─────────────────────────────────────

  describe('PuppeteerAdapter', () => {

    it('PBT: string input delegates to page.evaluate and returns the same result', async () => {
      // Feature: evaluate-method, Property 1: Evaluate type dispatch and delegation
      await fc.assert(
        fc.asyncProperty(jsStringArb, primitiveArb, async (script, returnValue) => {
          const page = makeMockPuppeteerPage();
          page.evaluate.mockResolvedValue(returnValue);
          const adapter = new PuppeteerAdapter(page as any);

          const result = await adapter.evaluate(script);

          expect(page.evaluate).toHaveBeenCalledWith(script);
          expect(result).toEqual(returnValue);
        }),
        { numRuns: 100 },
      );
    });

    it('PBT: function input delegates to page.evaluate and returns the same result', async () => {
      // Feature: evaluate-method, Property 1: Evaluate type dispatch and delegation
      await fc.assert(
        fc.asyncProperty(primitiveArb, async (returnValue) => {
          const page = makeMockPuppeteerPage();
          page.evaluate.mockResolvedValue(returnValue);
          const adapter = new PuppeteerAdapter(page as any);
          const fn = () => returnValue;

          const result = await adapter.evaluate(fn);

          expect(page.evaluate).toHaveBeenCalledWith(fn);
          expect(result).toEqual(returnValue);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── PlaywrightAdapter: string input ────────────────────────────────────

  describe('PlaywrightAdapter', () => {

    it('PBT: string input delegates to page.evaluate and returns the same result', async () => {
      // Feature: evaluate-method, Property 1: Evaluate type dispatch and delegation
      await fc.assert(
        fc.asyncProperty(jsStringArb, primitiveArb, async (script, returnValue) => {
          const page = makeMockPlaywrightPage();
          page.evaluate.mockResolvedValue(returnValue);
          const adapter = new PlaywrightAdapter(page as any);

          const result = await adapter.evaluate(script);

          expect(page.evaluate).toHaveBeenCalledWith(script);
          expect(result).toEqual(returnValue);
        }),
        { numRuns: 100 },
      );
    });

    it('PBT: function input delegates to page.evaluate and returns the same result', async () => {
      // Feature: evaluate-method, Property 1: Evaluate type dispatch and delegation
      await fc.assert(
        fc.asyncProperty(primitiveArb, async (returnValue) => {
          const page = makeMockPlaywrightPage();
          page.evaluate.mockResolvedValue(returnValue);
          const adapter = new PlaywrightAdapter(page as any);
          const fn = () => returnValue;

          const result = await adapter.evaluate(fn);

          expect(page.evaluate).toHaveBeenCalledWith(fn);
          expect(result).toEqual(returnValue);
        }),
        { numRuns: 100 },
      );
    });
  });
});
