import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 2.2**
 *
 * Property 4: Dashboard abort broadcast contains error and all journeys as skipped
 *
 * For any list of scheduled journeys and for any error message from globalSetup,
 * the TestExecutor SHALL broadcast a run-end message where the `error` field
 * contains the error message (prefixed with "globalSetup failed:") and the
 * `results` array has one entry per scheduled journey, each with status `skipped`.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock child_process to prevent real spawning
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

function makeConfig(globalSetupPath: string): ResolvedConfig {
  return {
    journeys: '/abs/path/to/journeys/**/*.journey.ts',
    browser: { defaultViewport: { width: 1280, height: 720 }, headless: false },
    server: { port: 3001 },
    testData: {
      globalSetup: globalSetupPath,
    },
  };
}

function makeWsManager() {
  return { broadcast: vi.fn() } as any;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 4: Dashboard abort broadcast contains error and all journeys as skipped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('for any journey IDs and error message, run-end broadcast has error field and all journeys skipped', { timeout: 60000 }, async () => {
    // Arbitrary non-empty arrays of journey ID strings
    const journeyIdsArb = fc.array(
      fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/).filter(s => s.length > 0),
      { minLength: 1, maxLength: 10 },
    );

    // Arbitrary error messages (non-empty strings)
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

    await fc.assert(
      fc.asyncProperty(journeyIdsArb, errorMessageArb, async (journeyIds, errorMessage) => {
        vi.clearAllMocks();

        const wsManager = makeWsManager();

        // Create a config with a globalSetup path that we'll make throw
        // We mock jiti to throw the error when the hook is loaded and called
        const fakeGlobalSetupPath = '/fake/globalSetup.ts';
        const config = makeConfig(fakeGlobalSetupPath);

        // Mock jiti so that when runHook tries to load the globalSetup module,
        // it returns a function that throws our error
        const mockJiti = vi.fn().mockImplementation(() => {
          // Return a module whose default export throws
          return { default: () => { throw new Error(errorMessage); } };
        });

        vi.doMock('jiti', () => ({
          createJiti: () => mockJiti,
        }));

        // Re-import TestExecutor to pick up the jiti mock
        // Instead, we can directly test by creating the executor and calling run
        // The TestExecutor uses require('jiti') internally, so we need to mock it differently

        // Actually, let's use a simpler approach: mock the module at the require level
        // Since vi.mock('jiti') needs to be at the top level, let's use a different approach
        // We'll spy on the runHook method to make it throw for globalSetup

        const executor = new TestExecutor(config, wsManager, 'puppeteer');

        // Access the private runHook method and make it throw for globalSetup
        const runHookSpy = vi.spyOn(executor as any, 'runHook').mockImplementation(
          async (hookName: string) => {
            if (hookName === 'globalSetup') {
              throw new Error(errorMessage);
            }
          },
        );

        // Also mock killExistingBrowser to avoid side effects
        vi.spyOn(executor as any, 'killExistingBrowser').mockResolvedValue(undefined);

        await executor.run(journeyIds);

        // Find the run-end broadcast call
        const broadcastCalls = wsManager.broadcast.mock.calls;
        const runEndCall = broadcastCalls.find(
          (call: any[]) => call[0]?.type === 'run-end',
        );

        // Verify run-end was broadcast
        expect(runEndCall).toBeDefined();
        const runEndMessage = runEndCall![0];

        // Verify error field contains the error message with prefix
        expect(runEndMessage.error).toBeDefined();
        expect(runEndMessage.error).toContain('globalSetup failed:');
        expect(runEndMessage.error).toContain(errorMessage);

        // Verify results array has one entry per journey, all with status 'skipped'
        expect(runEndMessage.results).toHaveLength(journeyIds.length);
        for (let i = 0; i < journeyIds.length; i++) {
          expect(runEndMessage.results[i].journey).toBe(journeyIds[i]);
          expect(runEndMessage.results[i].status).toBe('skipped');
        }
      }),
      { numRuns: 100 },
    );
  });
});
