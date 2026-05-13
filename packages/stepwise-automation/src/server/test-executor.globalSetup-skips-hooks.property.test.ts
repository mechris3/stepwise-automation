import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 2.1, 2.4**
 *
 * Property 2: Dashboard globalSetup failure aborts all journeys, per-journey hooks, and teardown
 *
 * For any list of journeys and for any error thrown by the globalSetup hook,
 * the TestExecutor SHALL execute zero journeys, invoke zero beforeEach/afterEach
 * hooks, and SHALL NOT invoke the globalTeardown hook.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock child_process.spawn to detect if any journey child process is spawned
const mockSpawn = vi.fn();
const mockExecSync = vi.fn();
vi.mock('child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('child_process')>();
  return {
    ...original,
    spawn: (...args: any[]) => mockSpawn(...args),
    execSync: (...args: any[]) => mockExecSync(...args),
  };
});

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

// Track which hooks are called via jiti mock
const hookCallTracker = {
  globalSetup: 0,
  beforeEach: 0,
  afterEach: 0,
  globalTeardown: 0,
};

// The error that globalSetup should throw (set per test iteration)
let globalSetupError: unknown = new Error('default error');

// Mock jiti so we can control hook behavior without real file I/O
vi.mock('jiti', () => ({
  createJiti: () => (modulePath: string) => {
    // Determine which hook is being loaded based on the path
    if (modulePath.includes('globalSetup')) {
      hookCallTracker.globalSetup++;
      return {
        default: () => {
          throw globalSetupError;
        },
      };
    }
    if (modulePath.includes('beforeEach')) {
      hookCallTracker.beforeEach++;
      return { default: () => {} };
    }
    if (modulePath.includes('afterEach')) {
      hookCallTracker.afterEach++;
      return { default: () => {} };
    }
    if (modulePath.includes('globalTeardown')) {
      hookCallTracker.globalTeardown++;
      return { default: () => {} };
    }
    return { default: () => {} };
  },
}));

import { TestExecutor } from './test-executor';
import { ResolvedConfig } from '../config';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    journeys: '/abs/path/to/journeys/**/*.journey.ts',
    browser: { defaultViewport: { width: 1280, height: 720 }, headless: false },
    server: { port: 3001 },
    testData: {
      globalSetup: '/hooks/globalSetup.ts',
      beforeEach: '/hooks/beforeEach.ts',
      afterEach: '/hooks/afterEach.ts',
      globalTeardown: '/hooks/globalTeardown.ts',
    },
    ...overrides,
  };
}

function makeWsManager() {
  return { broadcast: vi.fn() } as any;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 2: Dashboard globalSetup failure aborts all journeys, per-journey hooks, and teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    hookCallTracker.globalSetup = 0;
    hookCallTracker.beforeEach = 0;
    hookCallTracker.afterEach = 0;
    hookCallTracker.globalTeardown = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('for any journey list and any error, globalSetup failure skips all hooks and journeys', { timeout: 120000 }, async () => {
    // Arbitrary non-empty journey ID arrays
    const journeyIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/).filter(s => s.length > 0);
    const journeyListArb = fc.array(journeyIdArb, { minLength: 1, maxLength: 10 });

    // Arbitrary error values: Error objects with messages, or primitive thrown values
    const errorArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 100 }).map(msg => new Error(msg)),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.integer(),
    );

    await fc.assert(
      fc.asyncProperty(journeyListArb, errorArb, async (journeys, error) => {
        // Reset trackers for this iteration
        hookCallTracker.globalSetup = 0;
        hookCallTracker.beforeEach = 0;
        hookCallTracker.afterEach = 0;
        hookCallTracker.globalTeardown = 0;
        mockSpawn.mockClear();

        // Set the error that globalSetup will throw
        globalSetupError = error;

        const config = makeConfig();
        const wsManager = makeWsManager();
        const executor = new TestExecutor(config, wsManager, 'puppeteer');

        // Run the executor — globalSetup will throw, should abort
        // Use a promise + advanceTimersByTimeAsync to handle the setTimeout in killExistingBrowser
        const runPromise = executor.run(journeys);
        await vi.advanceTimersByTimeAsync(2000);
        await runPromise;

        // Property assertions:

        // 1. Zero journeys executed (no child processes spawned)
        expect(mockSpawn).not.toHaveBeenCalled();

        // 2. Zero beforeEach hooks called
        expect(hookCallTracker.beforeEach).toBe(0);

        // 3. Zero afterEach hooks called
        expect(hookCallTracker.afterEach).toBe(0);

        // 4. globalTeardown is NOT called
        expect(hookCallTracker.globalTeardown).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
