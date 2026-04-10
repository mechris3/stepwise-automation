import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Bug Condition Exploration Test:
 * When TestExecutor.runSingleJourney() spawns a child process, the env passed
 * to spawn() must contain STEPWISE_JOURNEY_PATH set to the absolute path of
 * the journey file. On UNFIXED code this test is EXPECTED TO FAIL because the
 * current implementation does not set STEPWISE_JOURNEY_PATH.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock child_process.spawn to capture the env argument
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

// Mock journey-discovery to return a known journey
vi.mock('./journey-discovery', () => ({
  getJourneyById: vi.fn(),
}));

// Mock breakpoint-storage
vi.mock('./breakpoint-storage', () => ({
  getBreakpoints: vi.fn().mockReturnValue([]),
}));

// Mock ipc utils
vi.mock('../utils/ipc', () => ({
  writeCommand: vi.fn(),
  clearCommands: vi.fn(),
}));

// Mock browser-discovery — return a valid array with a fake browser
vi.mock('../utils/browser-discovery', () => {
  return {
    discoverBrowsers: () => [{ executablePath: '/usr/bin/fake-browser', userDataDir: undefined }],
  };
});

import { TestExecutor, RunConfig } from './test-executor';
import { ResolvedConfig } from '../config';
import { getJourneyById } from './journey-discovery';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    journeys: '/abs/path/to/journeys/**/*.journey.ts',
    browser: { defaultViewport: { width: 1280, height: 720 }, headless: false },
    server: { port: 3001 },
    ...overrides,
  };
}

function makeFakeProcess(): ChildProcess {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { writable: true, write: vi.fn() };
  proc.pid = 12345;
  proc.kill = vi.fn();
  return proc as ChildProcess;
}

function makeWsManager() {
  return { broadcast: vi.fn() } as any;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Bug Condition: Child Process Journey Resolution Fails Without Pre-Resolved Path', () => {
  let fakeProcess: ChildProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeProcess = makeFakeProcess();
    mockSpawn.mockReturnValue(fakeProcess);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set STEPWISE_JOURNEY_PATH in spawned child env for a known journey', async () => {
    const journeyPath = '/abs/path/to/login.journey.ts';
    const mockedGetJourneyById = vi.mocked(getJourneyById);
    mockedGetJourneyById.mockResolvedValue({
      id: 'login',
      name: 'Login',
      path: journeyPath,
    });

    const config = makeConfig();
    const wsManager = makeWsManager();
    const executor = new TestExecutor(config, wsManager, 'puppeteer');

    // Start the run — it will call runSingleJourney internally
    const runPromise = executor.run(['login']);

    // Wait for spawn to be called (killExistingBrowser runs first, then runSingleJourney)
    await vi.waitFor(() => {
      expect(mockSpawn).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Inspect the env passed to spawn
    const spawnCall = mockSpawn.mock.calls[0];
    const spawnOptions = spawnCall[2]; // spawn(command, args, options)
    const spawnEnv = spawnOptions.env;

    expect(spawnEnv).toBeDefined();
    expect(spawnEnv.STEPWISE_JOURNEY_PATH).toBe(journeyPath);

    // Complete the process so the promise resolves
    (fakeProcess as any).emit('close', 0);
    await runPromise;
  });

  /**
   * Property-based test: for all valid journey IDs where the parent has a
   * resolved config, the spawned env must include STEPWISE_JOURNEY_PATH
   * matching the discovered journey's absolute path.
   */
  it('PBT: for all valid journey IDs, spawned env includes STEPWISE_JOURNEY_PATH', { timeout: 60000 }, async () => {
    const journeyIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/).filter(s => s.length > 0);
    const journeyPathArb = fc.stringMatching(/^\/[a-z][a-z0-9/.-]{0,80}\.journey\.ts$/).filter(s => s.length > 5);

    await fc.assert(
      fc.asyncProperty(journeyIdArb, journeyPathArb, async (journeyId, journeyAbsPath) => {
        vi.clearAllMocks();
        fakeProcess = makeFakeProcess();
        mockSpawn.mockReturnValue(fakeProcess);

        const mockedGetJourneyById = vi.mocked(getJourneyById);
        mockedGetJourneyById.mockResolvedValue({
          id: journeyId,
          name: journeyId.charAt(0).toUpperCase() + journeyId.slice(1),
          path: journeyAbsPath,
        });

        const config = makeConfig();
        const wsManager = makeWsManager();
        const executor = new TestExecutor(config, wsManager, 'puppeteer');

        const runPromise = executor.run([journeyId]);

        await vi.waitFor(() => {
          expect(mockSpawn).toHaveBeenCalled();
        }, { timeout: 5000 });

        const spawnCall = mockSpawn.mock.calls[0];
        const spawnOptions = spawnCall[2];
        const spawnEnv = spawnOptions.env;

        expect(spawnEnv).toBeDefined();
        expect(spawnEnv.STEPWISE_JOURNEY_PATH).toBe(journeyAbsPath);

        // Clean up: complete the process
        (fakeProcess as any).emit('close', 0);
        await runPromise;
      }),
      { numRuns: 20 },
    );
  });
});
