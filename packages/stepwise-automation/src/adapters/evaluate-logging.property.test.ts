import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 2.2, 3.2**
 *
 * Feature: evaluate-method, Property 2: Action logging wraps all evaluate calls
 *
 * For any adapter (PuppeteerAdapter or PlaywrightAdapter) and for any evaluate
 * call (whether string or function), the adapter should call logAndCheckAction
 * before execution, logActionComplete after execution, and addSlowModeDelay
 * after completion — in that exact order.
 */

// ── Call order tracking ──────────────────────────────────────────────────────

/** Shared call log to track the order of method invocations */
let callLog: string[];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock Puppeteer page with a spied evaluate */
function makeMockPuppeteerPage() {
  return {
    evaluate: vi.fn().mockImplementation(() => {
      callLog.push('page.evaluate');
      return Promise.resolve(undefined);
    }),
    url: vi.fn().mockReturnValue('about:blank'),
    createCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
  };
}

/** Creates a mock Playwright page with a spied evaluate */
function makeMockPlaywrightPage() {
  return {
    evaluate: vi.fn().mockImplementation(() => {
      callLog.push('page.evaluate');
      return Promise.resolve(undefined);
    }),
    url: vi.fn().mockReturnValue('about:blank'),
    context: vi.fn().mockReturnValue({
      clearCookies: vi.fn(),
      newCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
    }),
  };
}

// ── Mock BaseAdapter to spy on logging methods ───────────────────────────────

vi.mock('./base-adapter', () => {
  class MockBaseAdapter {
    protected async logAndCheckAction(_desc: string): Promise<void> {
      callLog.push('logAndCheckAction');
    }
    protected logActionComplete(): void {
      callLog.push('logActionComplete');
    }
    protected async addSlowModeDelay(): Promise<void> {
      callLog.push('addSlowModeDelay');
    }
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

describe('Property 2: Action logging wraps all evaluate calls', () => {

  beforeEach(() => {
    callLog = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── PuppeteerAdapter ───────────────────────────────────────────────────

  describe('PuppeteerAdapter', () => {

    it('PBT: string evaluate calls logAndCheckAction, page.evaluate, logActionComplete, addSlowModeDelay in order', async () => {
      // Feature: evaluate-method, Property 2: Action logging wraps all evaluate calls
      await fc.assert(
        fc.asyncProperty(jsStringArb, async (script) => {
          callLog = [];
          const page = makeMockPuppeteerPage();
          const adapter = new PuppeteerAdapter(page as any);

          await adapter.evaluate(script);

          expect(callLog).toEqual([
            'logAndCheckAction',
            'page.evaluate',
            'logActionComplete',
            'addSlowModeDelay',
          ]);
        }),
        { numRuns: 100 },
      );
    });

    it('PBT: function evaluate calls logAndCheckAction, page.evaluate, logActionComplete, addSlowModeDelay in order', async () => {
      // Feature: evaluate-method, Property 2: Action logging wraps all evaluate calls
      await fc.assert(
        fc.asyncProperty(primitiveArb, async (returnValue) => {
          callLog = [];
          const page = makeMockPuppeteerPage();
          const adapter = new PuppeteerAdapter(page as any);
          const fn = () => returnValue;

          await adapter.evaluate(fn);

          expect(callLog).toEqual([
            'logAndCheckAction',
            'page.evaluate',
            'logActionComplete',
            'addSlowModeDelay',
          ]);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── PlaywrightAdapter ──────────────────────────────────────────────────

  describe('PlaywrightAdapter', () => {

    it('PBT: string evaluate calls logAndCheckAction, page.evaluate, logActionComplete, addSlowModeDelay in order', async () => {
      // Feature: evaluate-method, Property 2: Action logging wraps all evaluate calls
      await fc.assert(
        fc.asyncProperty(jsStringArb, async (script) => {
          callLog = [];
          const page = makeMockPlaywrightPage();
          const adapter = new PlaywrightAdapter(page as any);

          await adapter.evaluate(script);

          expect(callLog).toEqual([
            'logAndCheckAction',
            'page.evaluate',
            'logActionComplete',
            'addSlowModeDelay',
          ]);
        }),
        { numRuns: 100 },
      );
    });

    it('PBT: function evaluate calls logAndCheckAction, page.evaluate, logActionComplete, addSlowModeDelay in order', async () => {
      // Feature: evaluate-method, Property 2: Action logging wraps all evaluate calls
      await fc.assert(
        fc.asyncProperty(primitiveArb, async (returnValue) => {
          callLog = [];
          const page = makeMockPlaywrightPage();
          const adapter = new PlaywrightAdapter(page as any);
          const fn = () => returnValue;

          await adapter.evaluate(fn);

          expect(callLog).toEqual([
            'logAndCheckAction',
            'page.evaluate',
            'logActionComplete',
            'addSlowModeDelay',
          ]);
        }),
        { numRuns: 100 },
      );
    });
  });
});
