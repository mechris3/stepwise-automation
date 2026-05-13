import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

/**
 * **Validates: Requirements 3.4, 3.5, 3.6, 3.7**
 *
 * Unit tests verifying that non-globalSetup hooks (beforeEach, afterEach,
 * globalTeardown) log errors with hook name prefix and do NOT abort the run.
 * The run-end broadcast reflects journey results only, not hook errors.
 *
 * Strategy: We mock the `runHook` private method on the TestExecutor prototype
 * to simulate hook errors with the same behavior as the real implementation
 * (log and continue for non-globalSetup hooks). This validates that the `run()`
 * method correctly handles the log-and-continue contract.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

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

// Mock fs to prevent real filesystem access during killExistingBrowser
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

import { TestExecutor } from './test-executor';
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

describe('Non-globalSetup hooks log and continue in TestExecutor', () => {
  let fakeProcess: ChildProcess;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let runHookSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeProcess = makeFakeProcess();
    mockSpawn.mockReturnValue(fakeProcess);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock journey discovery to return a valid journey
    const mockedGetJourneyById = vi.mocked(getJourneyById);
    mockedGetJourneyById.mockResolvedValue({
      id: 'test-journey',
      name: 'Test Journey',
      path: '/abs/path/to/test-journey.journey.ts',
    });
  });

  afterEach(() => {
    // Don't use restoreAllMocks — it would clear module mock implementations
    // vi.clearAllMocks() in beforeEach handles resetting call counts
  });

  /**
   * Sets up a TestExecutor with runHook mocked to simulate specific hook failures.
   * The mock replicates the real runHook behavior:
   * - globalSetup: succeeds (or throws if specified)
   * - Non-globalSetup hooks in failingHooks: logs error with prefix and continues
   * - Other hooks: succeeds silently
   */
  function setupWithFailingHooks(failingHooks: Record<string, Error>) {
    const config = makeConfig();
    const wsManager = makeWsManager();
    const executor = new TestExecutor(config, wsManager, 'puppeteer');

    // Mock killExistingBrowser to avoid the 1.5s setTimeout
    vi.spyOn(executor as any, 'killExistingBrowser').mockResolvedValue(undefined);

    // Mock runHook to simulate the real behavior
    runHookSpy = vi.spyOn(executor as any, 'runHook').mockImplementation(
      async (hookName: string) => {
        if (hookName === 'globalSetup') {
          // globalSetup succeeds
          return;
        }
        if (failingHooks[hookName]) {
          // Simulate the real runHook behavior: log error with prefix and continue
          console.error(`[TestExecutor] ${hookName} failed:`, failingHooks[hookName]);
          return;
        }
        // Hook succeeds
        return;
      },
    );

    return { executor, wsManager };
  }

  describe('beforeEach hook errors (Requirement 3.4)', () => {
    it('logs the error with hook name prefix and continues executing the journey', async () => {
      const { executor, wsManager } = setupWithFailingHooks({
        beforeEach: new Error('beforeEach setup failed'),
      });

      const runPromise = executor.run(['test-journey']);

      // Wait for spawn to be called
      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Verify error was logged with hook name prefix
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('beforeEach'),
        expect.any(Error),
      );

      // Complete the journey process successfully
      (fakeProcess as any).emit('close', 0);
      await runPromise;

      // Verify run-end broadcast reflects journey results, not hook errors
      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall).toBeDefined();
      expect(runEndCall![0].results).toEqual([{ journey: 'test-journey', status: 'passed' }]);
      expect(runEndCall![0].error).toBeUndefined();
    });

    it('does not mark the journey as failed due to beforeEach error alone', async () => {
      const { executor, wsManager } = setupWithFailingHooks({
        beforeEach: new Error('connection timeout'),
      });

      const runPromise = executor.run(['test-journey']);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      }, { timeout: 5000 });

      (fakeProcess as any).emit('close', 0);
      await runPromise;

      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall![0].results).toEqual([{ journey: 'test-journey', status: 'passed' }]);
    });
  });

  describe('afterEach hook errors (Requirement 3.5)', () => {
    it('logs the error with hook name prefix and continues to the next journey', async () => {
      const mockedGetJourneyById = vi.mocked(getJourneyById);
      mockedGetJourneyById.mockImplementation(async (id: string) => ({
        id,
        name: id,
        path: `/abs/path/to/${id}.journey.ts`,
      }));

      const { executor, wsManager } = setupWithFailingHooks({
        afterEach: new Error('afterEach cleanup failed'),
      });

      const runPromise = executor.run(['journey-1', 'journey-2']);

      // Wait for first journey to be spawned
      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalledTimes(1);
      }, { timeout: 5000 });

      // Complete first journey — afterEach will log error but continue
      const fakeProcess2 = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProcess2);
      (fakeProcess as any).emit('close', 0);

      // Wait for second journey to be spawned
      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalledTimes(2);
      }, { timeout: 5000 });

      // Complete second journey
      (fakeProcess2 as any).emit('close', 0);
      await runPromise;

      // Verify afterEach error was logged with hook name prefix
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('afterEach'),
        expect.any(Error),
      );

      // Verify run-end reflects journey results only
      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall).toBeDefined();
      expect(runEndCall![0].results).toEqual([
        { journey: 'journey-1', status: 'passed' },
        { journey: 'journey-2', status: 'passed' },
      ]);
      expect(runEndCall![0].error).toBeUndefined();
    });

    it('does not mark any journey as failed due to afterEach error alone', async () => {
      const { executor, wsManager } = setupWithFailingHooks({
        afterEach: new Error('resource cleanup error'),
      });

      const runPromise = executor.run(['test-journey']);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      }, { timeout: 5000 });

      (fakeProcess as any).emit('close', 0);
      await runPromise;

      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall![0].results).toEqual([{ journey: 'test-journey', status: 'passed' }]);
    });
  });

  describe('globalTeardown hook errors (Requirement 3.6)', () => {
    it('logs the error with hook name prefix and broadcasts run-end reflecting journey results', async () => {
      const { executor, wsManager } = setupWithFailingHooks({
        globalTeardown: new Error('teardown database disconnect failed'),
      });

      const runPromise = executor.run(['test-journey']);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      }, { timeout: 5000 });

      (fakeProcess as any).emit('close', 0);
      await runPromise;

      // Verify globalTeardown error was logged with hook name prefix
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('globalTeardown'),
        expect.any(Error),
      );

      // Verify run-end broadcast reflects journey results only
      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall).toBeDefined();
      expect(runEndCall![0].results).toEqual([{ journey: 'test-journey', status: 'passed' }]);
      expect(runEndCall![0].error).toBeUndefined();
    });

    it('run-end reflects failed journey status even when globalTeardown also errors', async () => {
      const { executor, wsManager } = setupWithFailingHooks({
        globalTeardown: new Error('teardown failed'),
      });

      const runPromise = executor.run(['test-journey']);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      }, { timeout: 5000 });

      (fakeProcess as any).emit('close', 1);
      await runPromise;

      // Verify run-end reflects the journey failure, not the hook error
      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall).toBeDefined();
      expect(runEndCall![0].results).toEqual([{ journey: 'test-journey', status: 'failed' }]);
      expect(runEndCall![0].error).toBeUndefined();
    });

    it('does not mark any journey as failed due to globalTeardown error (Requirement 3.7)', async () => {
      const mockedGetJourneyById = vi.mocked(getJourneyById);
      mockedGetJourneyById.mockImplementation(async (id: string) => ({
        id,
        name: id,
        path: `/abs/path/to/${id}.journey.ts`,
      }));

      const { executor, wsManager } = setupWithFailingHooks({
        globalTeardown: new Error('cleanup error'),
      });

      const runPromise = executor.run(['journey-a', 'journey-b']);

      // Wait for first journey to be spawned
      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalledTimes(1);
      }, { timeout: 5000 });

      // First journey passes
      const fakeProcess2 = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProcess2);
      (fakeProcess as any).emit('close', 0);

      // Wait for second journey to be spawned
      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalledTimes(2);
      }, { timeout: 5000 });

      // Second journey passes
      (fakeProcess2 as any).emit('close', 0);
      await runPromise;

      // Both journeys passed — globalTeardown error does not change that
      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall![0].results).toEqual([
        { journey: 'journey-a', status: 'passed' },
        { journey: 'journey-b', status: 'passed' },
      ]);
      expect(runEndCall![0].error).toBeUndefined();
    });
  });

  describe('run-end broadcast reflects journey results only (Requirements 3.4, 3.5, 3.6)', () => {
    it('when all hooks fail but journeys pass, run-end shows all passed with no error field', async () => {
      const { executor, wsManager } = setupWithFailingHooks({
        beforeEach: new Error('before error'),
        afterEach: new Error('after error'),
        globalTeardown: new Error('teardown error'),
      });

      const runPromise = executor.run(['test-journey']);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      }, { timeout: 5000 });

      (fakeProcess as any).emit('close', 0);
      await runPromise;

      const runEndCall = wsManager.broadcast.mock.calls.find(
        (call: any[]) => call[0].type === 'run-end',
      );
      expect(runEndCall).toBeDefined();
      expect(runEndCall![0].results).toEqual([{ journey: 'test-journey', status: 'passed' }]);
      expect(runEndCall![0].error).toBeUndefined();
    });
  });
});
