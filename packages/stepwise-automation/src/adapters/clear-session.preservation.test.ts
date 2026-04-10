import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Preservation Property Tests:
 * These tests capture baseline behavior on UNFIXED code.
 * They verify that clearSession() without origin continues to:
 * - Clear cookies via CDP (Puppeteer) / context API (Playwright)
 * - Clear cache via CDP (Puppeteer)
 * - Call logAndCheckAction, logActionComplete, addSlowModeDelay in order
 *
 * These tests MUST PASS on unfixed code — they define what should NOT change.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock CDP client with a spied send() method */
function makeMockCDPClient() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

/** Creates a mock Puppeteer page object */
function makeMockPuppeteerPage() {
  const client = makeMockCDPClient();
  return {
    page: {
      createCDPSession: vi.fn().mockResolvedValue(client),
      evaluate: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('about:blank'),
    },
    client,
  };
}

/** Creates a mock Playwright page object */
function makeMockPlaywrightPage() {
  const cdpClient = makeMockCDPClient();
  const context = {
    clearCookies: vi.fn().mockResolvedValue(undefined),
    newCDPSession: vi.fn().mockResolvedValue(cdpClient),
  };
  return {
    page: {
      context: vi.fn().mockReturnValue(context),
      evaluate: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('about:blank'),
    },
    context,
    cdpClient,
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

// Mock puppeteer-utils and playwright-utils to avoid import errors
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Preservation: clearSession baseline behavior (UNFIXED code)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── PuppeteerAdapter cookie/cache clearing ─────────────────────────────

  describe('PuppeteerAdapter: cookie and cache clearing preserved', () => {

    it('clearSession() without origin calls Network.clearBrowserCookies', async () => {
      const { page, client } = makeMockPuppeteerPage();
      const adapter = new PuppeteerAdapter(page as any);

      await adapter.clearSession();

      expect(client.send).toHaveBeenCalledWith('Network.clearBrowserCookies');
    });

    it('clearSession() without origin calls Network.clearBrowserCache', async () => {
      const { page, client } = makeMockPuppeteerPage();
      const adapter = new PuppeteerAdapter(page as any);

      await adapter.clearSession();

      expect(client.send).toHaveBeenCalledWith('Network.clearBrowserCache');
    });

    it('PBT: for all calls without origin, PuppeteerAdapter sends cookie and cache CDP commands', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(undefined), async () => {
          vi.clearAllMocks();
          const { page, client } = makeMockPuppeteerPage();
          const adapter = new PuppeteerAdapter(page as any);

          await adapter.clearSession();

          const sendCalls = client.send.mock.calls.map((c: any[]) => c[0]);
          expect(sendCalls).toContain('Network.clearBrowserCookies');
          expect(sendCalls).toContain('Network.clearBrowserCache');
        }),
        { numRuns: 20 },
      );
    });
  });

  // ── PlaywrightAdapter cookie clearing ──────────────────────────────────

  describe('PlaywrightAdapter: cookie clearing preserved', () => {

    it('clearSession() without origin calls context().clearCookies()', async () => {
      const { page, context } = makeMockPlaywrightPage();
      const adapter = new PlaywrightAdapter(page as any);

      await adapter.clearSession();

      expect(context.clearCookies).toHaveBeenCalled();
    });

    it('PBT: for all calls without origin, PlaywrightAdapter calls context().clearCookies()', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(undefined), async () => {
          vi.clearAllMocks();
          const { page, context } = makeMockPlaywrightPage();
          const adapter = new PlaywrightAdapter(page as any);

          await adapter.clearSession();

          expect(context.clearCookies).toHaveBeenCalled();
        }),
        { numRuns: 20 },
      );
    });
  });

  // ── Logging order preservation ─────────────────────────────────────────

  describe('Both adapters: logging order preserved', () => {

    it('PuppeteerAdapter calls logAndCheckAction, logActionComplete, addSlowModeDelay in order', async () => {
      const { page } = makeMockPuppeteerPage();
      const adapter = new PuppeteerAdapter(page as any);

      const callOrder: string[] = [];
      const logAndCheckSpy = vi.spyOn(adapter as any, 'logAndCheckAction').mockImplementation(async () => {
        callOrder.push('logAndCheckAction');
      });
      const logCompleteSpy = vi.spyOn(adapter as any, 'logActionComplete').mockImplementation(() => {
        callOrder.push('logActionComplete');
      });
      const slowModeSpy = vi.spyOn(adapter as any, 'addSlowModeDelay').mockImplementation(async () => {
        callOrder.push('addSlowModeDelay');
      });

      await adapter.clearSession();

      expect(logAndCheckSpy).toHaveBeenCalledWith('Clear session');
      expect(logCompleteSpy).toHaveBeenCalled();
      expect(slowModeSpy).toHaveBeenCalled();
      expect(callOrder).toEqual(['logAndCheckAction', 'logActionComplete', 'addSlowModeDelay']);
    });

    it('PlaywrightAdapter calls logAndCheckAction, logActionComplete, addSlowModeDelay in order', async () => {
      const { page } = makeMockPlaywrightPage();
      const adapter = new PlaywrightAdapter(page as any);

      const callOrder: string[] = [];
      const logAndCheckSpy = vi.spyOn(adapter as any, 'logAndCheckAction').mockImplementation(async () => {
        callOrder.push('logAndCheckAction');
      });
      const logCompleteSpy = vi.spyOn(adapter as any, 'logActionComplete').mockImplementation(() => {
        callOrder.push('logActionComplete');
      });
      const slowModeSpy = vi.spyOn(adapter as any, 'addSlowModeDelay').mockImplementation(async () => {
        callOrder.push('addSlowModeDelay');
      });

      await adapter.clearSession();

      expect(logAndCheckSpy).toHaveBeenCalledWith('Clear session');
      expect(logCompleteSpy).toHaveBeenCalled();
      expect(slowModeSpy).toHaveBeenCalled();
      expect(callOrder).toEqual(['logAndCheckAction', 'logActionComplete', 'addSlowModeDelay']);
    });

    it('PBT: for all calls, PuppeteerAdapter preserves logging order', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(undefined), async () => {
          vi.clearAllMocks();
          const { page } = makeMockPuppeteerPage();
          const adapter = new PuppeteerAdapter(page as any);

          const callOrder: string[] = [];
          vi.spyOn(adapter as any, 'logAndCheckAction').mockImplementation(async () => {
            callOrder.push('logAndCheckAction');
          });
          vi.spyOn(adapter as any, 'logActionComplete').mockImplementation(() => {
            callOrder.push('logActionComplete');
          });
          vi.spyOn(adapter as any, 'addSlowModeDelay').mockImplementation(async () => {
            callOrder.push('addSlowModeDelay');
          });

          await adapter.clearSession();

          expect(callOrder).toEqual(['logAndCheckAction', 'logActionComplete', 'addSlowModeDelay']);
        }),
        { numRuns: 20 },
      );
    });

    it('PBT: for all calls, PlaywrightAdapter preserves logging order', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(undefined), async () => {
          vi.clearAllMocks();
          const { page } = makeMockPlaywrightPage();
          const adapter = new PlaywrightAdapter(page as any);

          const callOrder: string[] = [];
          vi.spyOn(adapter as any, 'logAndCheckAction').mockImplementation(async () => {
            callOrder.push('logAndCheckAction');
          });
          vi.spyOn(adapter as any, 'logActionComplete').mockImplementation(() => {
            callOrder.push('logActionComplete');
          });
          vi.spyOn(adapter as any, 'addSlowModeDelay').mockImplementation(async () => {
            callOrder.push('addSlowModeDelay');
          });

          await adapter.clearSession();

          expect(callOrder).toEqual(['logAndCheckAction', 'logActionComplete', 'addSlowModeDelay']);
        }),
        { numRuns: 20 },
      );
    });
  });
});
