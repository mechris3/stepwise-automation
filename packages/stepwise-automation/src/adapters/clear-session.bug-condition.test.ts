import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 *
 * Bug Condition Exploration Test:
 * clearSession() currently uses page.evaluate() to clear localStorage/sessionStorage,
 * which fails on about:blank. The fix should use CDP Storage.clearDataForOrigin instead.
 *
 * On UNFIXED code these tests are EXPECTED TO FAIL because:
 * - clearSession() does not accept an origin parameter
 * - clearSession() calls page.evaluate() for storage clearing
 * - clearSession() does not call Storage.clearDataForOrigin
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

// We need to mock the base-adapter module to prevent constructor side effects
// (signal handlers, IPC, env var reads) that would fail in test environment.
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

describe('Bug Condition: clearSession uses page.evaluate() for storage clearing', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PuppeteerAdapter', () => {

    it('should use CDP Storage.clearDataForOrigin when origin is provided', async () => {
      const { page, client } = makeMockPuppeteerPage();
      const adapter = new PuppeteerAdapter(page as any);

      await adapter.clearSession('http://localhost:3000');

      // Assert CDP Storage.clearDataForOrigin was called with correct params
      expect(client.send).toHaveBeenCalledWith('Storage.clearDataForOrigin', {
        origin: 'http://localhost:3000',
        storageTypes: 'cookies,local_storage,session_storage,indexeddb',
      });
    });

    it('should NOT call page.evaluate() for storage clearing when origin is provided', async () => {
      const { page } = makeMockPuppeteerPage();
      const adapter = new PuppeteerAdapter(page as any);

      await adapter.clearSession('http://localhost:3000');

      // page.evaluate should NOT be called for storage clearing
      expect(page.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('PlaywrightAdapter', () => {

    it('should use CDP Storage.clearDataForOrigin via context().newCDPSession(page)', async () => {
      const { page, context, cdpClient } = makeMockPlaywrightPage();
      const adapter = new PlaywrightAdapter(page as any);

      await adapter.clearSession('http://localhost:3000');

      // Assert newCDPSession was called to get a CDP client
      expect(context.newCDPSession).toHaveBeenCalledWith(page);

      // Assert CDP Storage.clearDataForOrigin was called with correct params
      expect(cdpClient.send).toHaveBeenCalledWith('Storage.clearDataForOrigin', {
        origin: 'http://localhost:3000',
        storageTypes: 'cookies,local_storage,session_storage,indexeddb',
      });
    });

    it('should NOT call page.evaluate() for storage clearing when origin is provided', async () => {
      const { page } = makeMockPlaywrightPage();
      const adapter = new PlaywrightAdapter(page as any);

      await adapter.clearSession('http://localhost:3000');

      // page.evaluate should NOT be called for storage clearing
      expect(page.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('PBT: for all valid origins, both adapters use CDP and NOT page.evaluate()', () => {

    // Generate valid HTTP/HTTPS origin URLs
    const originArb = fc.oneof(
      fc.webUrl({ withFragments: false, withQueryParameters: false })
        .map(url => {
          try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.host}`;
          } catch {
            return 'http://localhost:3000';
          }
        }),
      fc.tuple(
        fc.constantFrom('http', 'https'),
        fc.domain(),
        fc.constantFrom('', ':3000', ':8080', ':443', ':8443'),
      ).map(([proto, domain, port]) => `${proto}://${domain}${port}`),
    );

    it('PBT: PuppeteerAdapter uses CDP Storage.clearDataForOrigin for all valid origins', async () => {
      await fc.assert(
        fc.asyncProperty(originArb, async (origin) => {
          vi.clearAllMocks();
          const { page, client } = makeMockPuppeteerPage();
          const adapter = new PuppeteerAdapter(page as any);

          await adapter.clearSession(origin);

          // Must call Storage.clearDataForOrigin with the origin
          expect(client.send).toHaveBeenCalledWith('Storage.clearDataForOrigin', {
            origin,
            storageTypes: 'cookies,local_storage,session_storage,indexeddb',
          });

          // Must NOT call page.evaluate for storage clearing
          expect(page.evaluate).not.toHaveBeenCalled();
        }),
        { numRuns: 50 },
      );
    });

    it('PBT: PlaywrightAdapter uses CDP Storage.clearDataForOrigin for all valid origins', async () => {
      await fc.assert(
        fc.asyncProperty(originArb, async (origin) => {
          vi.clearAllMocks();
          const { page, context, cdpClient } = makeMockPlaywrightPage();
          const adapter = new PlaywrightAdapter(page as any);

          await adapter.clearSession(origin);

          // Must use newCDPSession to get CDP client
          expect(context.newCDPSession).toHaveBeenCalledWith(page);

          // Must call Storage.clearDataForOrigin with the origin
          expect(cdpClient.send).toHaveBeenCalledWith('Storage.clearDataForOrigin', {
            origin,
            storageTypes: 'cookies,local_storage,session_storage,indexeddb',
          });

          // Must NOT call page.evaluate for storage clearing
          expect(page.evaluate).not.toHaveBeenCalled();
        }),
        { numRuns: 50 },
      );
    });
  });
});
