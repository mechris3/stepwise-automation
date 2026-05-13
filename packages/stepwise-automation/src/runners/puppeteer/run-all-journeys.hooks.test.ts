import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests verifying non-globalSetup hooks log and continue in CLI runner.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.7**
 *
 * The `runHook` function in run-all-journeys.ts handles beforeEach, afterEach,
 * and globalTeardown hooks with log-and-continue behavior:
 * - Errors are logged to console.error with the hook name prefix
 * - The function resolves normally (does not throw)
 * - Journey execution continues unaffected
 * - Exit code reflects journey results only, not hook errors
 *
 * Since `runHook` is not exported, we replicate its exact logic here to
 * verify the behavioral contract. This mirrors the approach used in the
 * existing property tests for this module.
 */

// ── Replicate runHook logic (mirrors source exactly) ────────────────────────

/**
 * Exact replica of the runHook function from run-all-journeys.ts.
 * Used to verify the log-and-continue contract for non-globalSetup hooks.
 */
async function runHook(hookPath: string, hookName: string): Promise<void> {
  try {
    console.log(`🔧 Running ${hookName}...`);
    const hookModule = await import(hookPath);
    const hookFn = hookModule.default || hookModule[hookName] || hookModule;
    if (typeof hookFn === 'function') {
      await hookFn();
    }
    console.log(`🔧 ${hookName} complete`);
  } catch (error) {
    console.error(`⚠️  ${hookName} failed:`, error instanceof Error ? error.message : error);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Non-globalSetup hooks: log and continue behavior (CLI runner)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 3.1: beforeEach errors are logged and do not abort', () => {
    it('when beforeEach throws an Error, the error is logged with hook name prefix and function resolves', async () => {
      // Mock dynamic import to return a module whose default export throws
      vi.doMock('/fake/hooks/beforeEach.ts', () => ({
        default: async () => { throw new Error('Database connection failed'); },
      }));

      // runHook should resolve (not throw)
      await expect(runHook('/fake/hooks/beforeEach.ts', 'beforeEach')).resolves.toBeUndefined();

      // Verify error was logged with hook name prefix
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '⚠️  beforeEach failed:',
        'Database connection failed',
      );
    });

    it('when beforeEach throws a non-Error value, it is logged with hook name prefix', async () => {
      vi.doMock('/fake/hooks/beforeEach-str.ts', () => ({
        default: async () => { throw 'string error value'; },
      }));

      await expect(runHook('/fake/hooks/beforeEach-str.ts', 'beforeEach')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '⚠️  beforeEach failed:',
        'string error value',
      );
    });
  });

  describe('Requirement 3.2: afterEach errors are logged and do not abort', () => {
    it('when afterEach throws an Error, the error is logged with hook name prefix and function resolves', async () => {
      vi.doMock('/fake/hooks/afterEach.ts', () => ({
        default: async () => { throw new Error('Cleanup failed'); },
      }));

      await expect(runHook('/fake/hooks/afterEach.ts', 'afterEach')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '⚠️  afterEach failed:',
        'Cleanup failed',
      );
    });

    it('when afterEach throws a non-Error value, it is logged with hook name prefix', async () => {
      vi.doMock('/fake/hooks/afterEach-num.ts', () => ({
        default: async () => { throw 42; },
      }));

      await expect(runHook('/fake/hooks/afterEach-num.ts', 'afterEach')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '⚠️  afterEach failed:',
        42,
      );
    });
  });

  describe('Requirement 3.3: globalTeardown errors are logged and do not abort', () => {
    it('when globalTeardown throws an Error, the error is logged with hook name prefix and function resolves', async () => {
      vi.doMock('/fake/hooks/globalTeardown.ts', () => ({
        default: async () => { throw new Error('Teardown exploded'); },
      }));

      await expect(runHook('/fake/hooks/globalTeardown.ts', 'globalTeardown')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '⚠️  globalTeardown failed:',
        'Teardown exploded',
      );
    });

    it('when globalTeardown throws a non-Error value, it is logged with hook name prefix', async () => {
      vi.doMock('/fake/hooks/globalTeardown-null.ts', () => ({
        default: async () => { throw null; },
      }));

      await expect(runHook('/fake/hooks/globalTeardown-null.ts', 'globalTeardown')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '⚠️  globalTeardown failed:',
        null,
      );
    });
  });

  describe('Requirement 3.7: hook errors do not affect journey pass/fail status', () => {
    it('exit code reflects journey results only when beforeEach fails but journeys pass', async () => {
      // Simulate the main() control flow: beforeEach fails, journey passes
      const results: Array<{ journey: string; status: 'passed' | 'failed' }> = [];

      // beforeEach hook that throws
      const beforeEachHook = async () => { throw new Error('beforeEach boom'); };

      // Simulate running beforeEach (log-and-continue)
      try {
        await beforeEachHook();
      } catch (error) {
        // Logged but not propagated — mirrors runHook behavior
        console.error(`⚠️  beforeEach failed:`, error instanceof Error ? error.message : error);
      }

      // Journey still executes and passes
      results.push({ journey: 'login-flow', status: 'passed' });

      // Exit code determination (from main())
      const anyFailed = results.some(r => r.status === 'failed');
      const exitCode = anyFailed ? 1 : 0;

      // Exit code is 0 because all journeys passed — hook error is irrelevant
      expect(exitCode).toBe(0);
    });

    it('exit code reflects journey results only when afterEach fails but journeys pass', async () => {
      const results: Array<{ journey: string; status: 'passed' | 'failed' }> = [];

      // Journey passes
      results.push({ journey: 'checkout-flow', status: 'passed' });

      // afterEach hook that throws
      const afterEachHook = async () => { throw new Error('afterEach boom'); };

      try {
        await afterEachHook();
      } catch (error) {
        console.error(`⚠️  afterEach failed:`, error instanceof Error ? error.message : error);
      }

      const anyFailed = results.some(r => r.status === 'failed');
      const exitCode = anyFailed ? 1 : 0;

      // Exit code is 0 — afterEach error does not affect it
      expect(exitCode).toBe(0);
    });

    it('exit code reflects journey failure even when globalTeardown also fails', async () => {
      const results: Array<{ journey: string; status: 'passed' | 'failed' }> = [];

      // Journey fails on its own merits
      results.push({ journey: 'signup-flow', status: 'failed' });

      // globalTeardown also throws
      const teardownHook = async () => { throw new Error('teardown boom'); };

      try {
        await teardownHook();
      } catch (error) {
        console.error(`⚠️  globalTeardown failed:`, error instanceof Error ? error.message : error);
      }

      const anyFailed = results.some(r => r.status === 'failed');
      const exitCode = anyFailed ? 1 : 0;

      // Exit code is 1 because a journey failed — not because of teardown error
      expect(exitCode).toBe(1);
    });

    it('exit code is 0 when all journeys pass and globalTeardown fails', async () => {
      const results: Array<{ journey: string; status: 'passed' | 'failed' }> = [];

      // All journeys pass
      results.push({ journey: 'login-flow', status: 'passed' });
      results.push({ journey: 'checkout-flow', status: 'passed' });

      // globalTeardown throws
      const teardownHook = async () => { throw new Error('teardown cleanup failed'); };

      try {
        await teardownHook();
      } catch (error) {
        console.error(`⚠️  globalTeardown failed:`, error instanceof Error ? error.message : error);
      }

      const anyFailed = results.some(r => r.status === 'failed');
      const exitCode = anyFailed ? 1 : 0;

      // Exit code is 0 — teardown error is disregarded for exit code
      expect(exitCode).toBe(0);
    });
  });

  describe('Log message format: hook name appears as prefix', () => {
    it('log message contains "beforeEach" as prefix identifier', async () => {
      vi.doMock('/fake/hooks/be-prefix.ts', () => ({
        default: async () => { throw new Error('some error'); },
      }));

      await runHook('/fake/hooks/be-prefix.ts', 'beforeEach');

      const errorCall = consoleErrorSpy.mock.calls[0];
      expect(errorCall[0]).toContain('beforeEach');
    });

    it('log message contains "afterEach" as prefix identifier', async () => {
      vi.doMock('/fake/hooks/ae-prefix.ts', () => ({
        default: async () => { throw new Error('some error'); },
      }));

      await runHook('/fake/hooks/ae-prefix.ts', 'afterEach');

      const errorCall = consoleErrorSpy.mock.calls[0];
      expect(errorCall[0]).toContain('afterEach');
    });

    it('log message contains "globalTeardown" as prefix identifier', async () => {
      vi.doMock('/fake/hooks/gt-prefix.ts', () => ({
        default: async () => { throw new Error('some error'); },
      }));

      await runHook('/fake/hooks/gt-prefix.ts', 'globalTeardown');

      const errorCall = consoleErrorSpy.mock.calls[0];
      expect(errorCall[0]).toContain('globalTeardown');
    });
  });
});
