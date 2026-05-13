import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 4.4**
 *
 * Property 5: Dashboard error broadcast identifies source as globalSetup
 *
 * For any error thrown by the globalSetup hook, the TestExecutor SHALL broadcast
 * an error-type message with the `source` field set to "globalSetup" and the
 * `message` field containing the error's message string.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock child_process to prevent actual process spawning
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock journey-discovery
vi.mock('./journey-discovery', () => ({
  getJourneyById: vi.fn(),
}));

// Mock breakpoint-storage
vi.mock('./breakpoint-storage', () => ({
  getBreakpoints: vi.fn().mockReturnValue([]),
  setBreakpoints: vi.fn(),
}));

// Mock settings-storage
vi.mock('./settings-storage', () => ({
  getFileBreakpoints: vi.fn().mockReturnValue([]),
}));

// Mock ipc utils
vi.mock('../utils/ipc', () => ({
  writeCommand: vi.fn(),
  clearCommands: vi.fn(),
}));

// Mock browser-discovery
vi.mock('../utils/browser-discovery', () => ({
  discoverBrowsers: () => [{ executablePath: '/usr/bin/fake-browser', userDataDir: undefined }],
}));

// Mock fs to prevent real filesystem access during killExistingBrowser
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

import { TestExecutor } from './test-executor';
import type { ResolvedConfig } from '../config';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(): ResolvedConfig {
  return {
    journeys: '/abs/path/to/journeys/**/*.journey.ts',
    browser: { defaultViewport: { width: 1280, height: 720 }, headless: false },
    server: { port: 3001 },
    testData: {
      globalSetup: '/hooks/globalSetup.ts',
    },
  };
}

function makeWsManager() {
  return { broadcast: vi.fn() } as any;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 5: Dashboard error broadcast identifies source as globalSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('for any error message thrown by globalSetup, broadcast includes type "error", source "globalSetup", and the error message', { timeout: 60000 }, async () => {
    // Generate non-empty error message strings
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMessage) => {
        vi.clearAllMocks();

        const wsManager = makeWsManager();
        const config = makeConfig();

        const executor = new TestExecutor(config, wsManager, 'puppeteer');

        // Spy on the private runHook method to make globalSetup throw
        vi.spyOn(executor as any, 'runHook').mockImplementation(
          async (hookName: string) => {
            if (hookName === 'globalSetup') {
              throw new Error(errorMessage);
            }
          },
        );

        // Mock killExistingBrowser to avoid side effects
        vi.spyOn(executor as any, 'killExistingBrowser').mockResolvedValue(undefined);

        // Run with at least one journey so the abort path is exercised
        await executor.run(['some-journey']);

        // Find the error-type broadcast call
        const broadcastCalls = wsManager.broadcast.mock.calls;
        const errorBroadcasts = broadcastCalls.filter(
          (call: any[]) => call[0].type === 'error'
        );

        // There should be at least one error broadcast
        expect(errorBroadcasts.length).toBeGreaterThanOrEqual(1);

        // The error broadcast should have source: 'globalSetup' and contain the error message
        const errorBroadcast = errorBroadcasts[0][0];
        expect(errorBroadcast.type).toBe('error');
        expect(errorBroadcast.source).toBe('globalSetup');
        expect(errorBroadcast.message).toContain(errorMessage);
      }),
      { numRuns: 100 },
    );
  });
});
