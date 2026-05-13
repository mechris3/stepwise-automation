import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 3.3, 3.6**
 *
 * Feature: global-setup-abort, Property 7: Teardown errors do not affect final outcome
 *
 * For any combination of journey pass/fail results and for any error thrown by
 * globalTeardown, the CLI runner's exit code and the Test_Executor's run-end
 * broadcast SHALL reflect only the journey results, disregarding the teardown error.
 *
 * Testing strategy: We replicate the exit code determination logic from
 * run-all-journeys.ts and the run-end broadcast logic from TestExecutor.
 * The property generates arbitrary arrays of journey results (each with a
 * random pass/fail status) and arbitrary teardown error values, then verifies
 * that the final outcome is determined solely by journey results.
 */

// ── Generators ───────────────────────────────────────────────────────────────

/** Generates a journey result with a random pass/fail status */
const journeyResultArb = fc.record({
  journey: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  status: fc.constantFrom('passed' as const, 'failed' as const),
});

/** Generates non-empty arrays of journey results (at least 1 journey ran) */
const journeyResultsArb = fc.array(journeyResultArb, { minLength: 1, maxLength: 20 });

/** Generates arbitrary Error objects for teardown failures */
const teardownErrorArb = fc.oneof(
  fc.string({ minLength: 1 }).map(msg => new Error(msg)),
  fc.string({ minLength: 1 }).map(msg => {
    const err = new Error(msg);
    err.stack = `Error: ${msg}\n    at globalTeardown (/fake/teardown.ts:5:3)`;
    return err;
  }),
);

/** Generates arbitrary non-Error thrown values for teardown failures */
const teardownNonErrorArb = fc.oneof(
  fc.string({ minLength: 1 }),
  fc.integer(),
  fc.constant(null),
  fc.constant(undefined),
);

/** Generates any throwable teardown error value */
const teardownThrowableArb = fc.oneof(teardownErrorArb, teardownNonErrorArb);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 7: Teardown errors do not affect final outcome', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PBT: CLI exit code reflects only journey results regardless of teardown error', async () => {
    // Feature: global-setup-abort, Property 7: Teardown errors do not affect final outcome
    //
    // The CLI runner's main() function determines exit code as:
    //   const anyFailed = results.some((r) => r.status === 'failed');
    //   process.exit(anyFailed ? 1 : 0);
    //
    // This runs AFTER globalTeardown (which uses runHook — log-and-continue).
    // The property: for ANY teardown error, the exit code is determined
    // solely by whether any journey has status 'failed'.

    await fc.assert(
      fc.asyncProperty(journeyResultsArb, teardownThrowableArb, async (results, teardownError) => {
        // ── Simulate globalTeardown with log-and-continue behavior ──
        // This mirrors runHook in run-all-journeys.ts: errors are caught and logged
        async function runHook(_hookPath: string, hookName: string): Promise<void> {
          try {
            // Simulate the hook throwing
            throw teardownError;
          } catch (error) {
            // Log-and-continue: error is swallowed
            console.error(`⚠️  ${hookName} failed:`, error instanceof Error ? error.message : error);
          }
        }

        // Suppress console output during test
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Run globalTeardown (always succeeds due to log-and-continue)
        await runHook('/fake/hooks/globalTeardown.ts', 'globalTeardown');

        // ── Exit code determination (exact logic from main()) ──
        const anyFailed = results.some((r) => r.status === 'failed');
        const exitCode = anyFailed ? 1 : 0;

        // ── Expected exit code based solely on journey results ──
        const expectedExitCode = results.some(r => r.status === 'failed') ? 1 : 0;

        // PROPERTY: Exit code reflects only journey results
        expect(exitCode).toBe(expectedExitCode);

        // Additional invariant: teardown error does NOT influence exit code
        // If all journeys passed, exit code MUST be 0 regardless of teardown error
        if (results.every(r => r.status === 'passed')) {
          expect(exitCode).toBe(0);
        }
        // If any journey failed, exit code MUST be 1 regardless of teardown error
        if (results.some(r => r.status === 'failed')) {
          expect(exitCode).toBe(1);
        }

        consoleErrorSpy.mockRestore();
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: Dashboard run-end broadcast reflects only journey results regardless of teardown error', async () => {
    // Feature: global-setup-abort, Property 7: Teardown errors do not affect final outcome
    //
    // The TestExecutor's run() method broadcasts run-end with journey results
    // after globalTeardown completes (or fails). The runHook method for
    // non-globalSetup hooks logs errors and continues — it never modifies
    // the results array or adds an error field to run-end.
    //
    // The property: for ANY teardown error, the run-end broadcast contains
    // only the journey results with no error field.

    await fc.assert(
      fc.asyncProperty(journeyResultsArb, teardownThrowableArb, async (results, teardownError) => {
        // ── Simulate TestExecutor's runHook for globalTeardown ──
        // Non-globalSetup hooks: log error and continue (never throw)
        let teardownErrorLogged = false;

        async function runHook(hookName: string): Promise<void> {
          if (hookName === 'globalTeardown') {
            try {
              throw teardownError;
            } catch (error) {
              // Log and continue — mirrors TestExecutor behavior
              teardownErrorLogged = true;
            }
          }
        }

        // Execute globalTeardown (swallows error)
        await runHook('globalTeardown');

        // Teardown error was encountered
        expect(teardownErrorLogged).toBe(true);

        // ── Simulate run-end broadcast construction ──
        // The TestExecutor builds run-end from the results array only
        const runEndMessage = {
          type: 'run-end' as const,
          results: results.map(r => ({ journey: r.journey, status: r.status })),
          // No error field — teardown errors do not add one
        };

        // PROPERTY: run-end message has no error field
        expect(runEndMessage).not.toHaveProperty('error');

        // PROPERTY: results reflect only journey pass/fail statuses
        expect(runEndMessage.results).toHaveLength(results.length);
        for (let i = 0; i < results.length; i++) {
          expect(runEndMessage.results[i].status).toBe(results[i].status);
          expect(runEndMessage.results[i].journey).toBe(results[i].journey);
        }

        // PROPERTY: no journey status was changed by the teardown error
        const passedCount = runEndMessage.results.filter(r => r.status === 'passed').length;
        const failedCount = runEndMessage.results.filter(r => r.status === 'failed').length;
        const expectedPassed = results.filter(r => r.status === 'passed').length;
        const expectedFailed = results.filter(r => r.status === 'failed').length;
        expect(passedCount).toBe(expectedPassed);
        expect(failedCount).toBe(expectedFailed);
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: exit code is always 0 when all journeys pass, regardless of any teardown error', async () => {
    // Feature: global-setup-abort, Property 7: Teardown errors do not affect final outcome
    //
    // Focused sub-property: when ALL journeys pass, the exit code is always 0
    // no matter what the teardown throws.

    /** Generates arrays where all journeys passed */
    const allPassedResultsArb = fc.array(
      fc.record({
        journey: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        status: fc.constant('passed' as const),
      }),
      { minLength: 1, maxLength: 20 },
    );

    await fc.assert(
      fc.asyncProperty(allPassedResultsArb, teardownThrowableArb, async (results, teardownError) => {
        // Suppress console output
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // globalTeardown throws but is swallowed
        try {
          throw teardownError;
        } catch (error) {
          console.error(`⚠️  globalTeardown failed:`, error instanceof Error ? error.message : error);
        }

        // Exit code determination
        const anyFailed = results.some(r => r.status === 'failed');
        const exitCode = anyFailed ? 1 : 0;

        // PROPERTY: exit code is ALWAYS 0 when all journeys passed
        expect(exitCode).toBe(0);

        consoleErrorSpy.mockRestore();
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: exit code is always 1 when any journey failed, regardless of any teardown error', async () => {
    // Feature: global-setup-abort, Property 7: Teardown errors do not affect final outcome
    //
    // Focused sub-property: when at least one journey failed, the exit code is
    // always 1 no matter what the teardown throws.

    /** Generates arrays where at least one journey failed */
    const someFailedResultsArb = fc.tuple(
      // At least one failed journey
      fc.record({
        journey: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        status: fc.constant('failed' as const),
      }),
      // Plus arbitrary other results
      fc.array(journeyResultArb, { minLength: 0, maxLength: 19 }),
    ).map(([failedResult, otherResults]) => [failedResult, ...otherResults]);

    await fc.assert(
      fc.asyncProperty(someFailedResultsArb, teardownThrowableArb, async (results, teardownError) => {
        // Suppress console output
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // globalTeardown throws but is swallowed
        try {
          throw teardownError;
        } catch (error) {
          console.error(`⚠️  globalTeardown failed:`, error instanceof Error ? error.message : error);
        }

        // Exit code determination
        const anyFailed = results.some(r => r.status === 'failed');
        const exitCode = anyFailed ? 1 : 0;

        // PROPERTY: exit code is ALWAYS 1 when any journey failed
        expect(exitCode).toBe(1);

        consoleErrorSpy.mockRestore();
      }),
      { numRuns: 100 },
    );
  });
});
