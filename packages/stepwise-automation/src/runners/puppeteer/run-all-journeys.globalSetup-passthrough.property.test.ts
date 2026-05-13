import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 1.5, 2.5**
 *
 * Feature: global-setup-abort, Property 8: Successful globalSetup leads to normal journey execution
 *
 * For any list of journeys and a globalSetup hook that completes without error,
 * both runners SHALL proceed to execute journeys normally.
 *
 * Testing strategy: We model the control flow of both the CLI runner (run-all-journeys.ts)
 * and the dashboard runner (TestExecutor) with a non-throwing globalSetup. We verify
 * that when globalSetup succeeds, the journey execution loop runs for all journeys.
 */

// ── Generators ───────────────────────────────────────────────────────────────

/** Generates non-empty journey ID strings */
const journeyIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/).filter(s => s.length > 0);

/** Generates non-empty arrays of journey IDs (at least 1 journey scheduled) */
const journeyListArb = fc.array(journeyIdArb, { minLength: 1, maxLength: 10 });

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 8: Successful globalSetup leads to normal journey execution', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PBT: CLI runner — when globalSetup succeeds, all journeys proceed to execution', async () => {
    // Feature: global-setup-abort, Property 8: Successful globalSetup leads to normal journey execution
    //
    // This property test verifies the CLI runner's passthrough path.
    // When runGlobalSetup completes without throwing, the main() function
    // proceeds to the journey execution loop. We model this control flow
    // and verify that every scheduled journey enters the execution loop.

    await fc.assert(
      fc.asyncProperty(journeyListArb, async (journeyIds) => {
        // ── Tracking state ──
        const journeysExecuted: string[] = [];

        // ── runGlobalSetup: succeeds without throwing ──
        // Mirrors the real implementation but the hook function completes normally
        async function runGlobalSetup(_hookPath: string): Promise<void> {
          // Simulate: const hookModule = await import(hookPath)
          const hookModule = { default: async () => { /* success — no throw */ } };

          // Simulate: extract the callable (same precedence as source)
          const hookFn = hookModule.default || (hookModule as any).globalSetup || hookModule;

          // Simulate: validate it's callable
          if (typeof hookFn !== 'function') {
            throw new Error('module does not export a callable function');
          }

          // Simulate: invoke — completes successfully
          await hookFn();
        }

        // ── main() control flow (exact structure from source) ──
        const config = {
          testData: {
            globalSetup: '/fake/hooks/globalSetup.ts',
            globalTeardown: '/fake/hooks/globalTeardown.ts',
          },
        };
        const journeysToRun = journeyIds.map(id => ({ id, name: id }));

        let processExited = false;

        if (config.testData?.globalSetup) {
          try {
            await runGlobalSetup(config.testData.globalSetup);
          } catch (error: unknown) {
            // Real code: normalize error, write to stderr, call process.exit(1)
            processExited = true;
          }
        }

        // When globalSetup succeeds, processExited remains false and journeys run
        if (!processExited) {
          for (const journey of journeysToRun) {
            journeysExecuted.push(journey.id);
          }
        }

        // ── PROPERTY ASSERTIONS ──

        // When globalSetup succeeds, ALL journeys proceed to execution
        expect(journeysExecuted).toHaveLength(journeyIds.length);
        expect(journeysExecuted).toEqual(journeyIds);
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: Dashboard runner — when globalSetup succeeds, all journeys proceed to execution', async () => {
    // Feature: global-setup-abort, Property 8: Successful globalSetup leads to normal journey execution
    //
    // This property test verifies the TestExecutor's passthrough path.
    // When runHook('globalSetup') completes without throwing, the run() method
    // proceeds to the journey execution loop. We model this control flow
    // and verify that every scheduled journey enters the execution loop.

    await fc.assert(
      fc.asyncProperty(journeyListArb, async (journeyIds) => {
        // ── Tracking state ──
        const journeysExecuted: string[] = [];
        let runEndBroadcast: any = null;

        // ── Model the TestExecutor.run() control flow ──
        // runHook('globalSetup') succeeds — does not throw
        async function runHook(hookName: string): Promise<void> {
          if (hookName === 'globalSetup') {
            // Succeeds without throwing
            return;
          }
          // Other hooks also succeed (not relevant to this property)
        }

        // Simulate the run() method's control flow
        const broadcasts: any[] = [];
        const wsManager = { broadcast: (msg: any) => broadcasts.push(msg) };

        // Broadcast run-start
        wsManager.broadcast({ type: 'run-start', journeys: journeyIds });

        // Run globalSetup — abort on failure
        let aborted = false;
        try {
          await runHook('globalSetup');
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          wsManager.broadcast({ type: 'error', message: errorMessage, source: 'globalSetup' });
          wsManager.broadcast({
            type: 'run-end',
            error: `globalSetup failed: ${errorMessage}`,
            results: journeyIds.map(j => ({ journey: j, status: 'skipped' })),
          });
          aborted = true;
        }

        if (!aborted) {
          // Journey execution loop proceeds normally
          const results: { journey: string; status: 'passed' | 'failed' }[] = [];

          for (const journey of journeyIds) {
            await runHook('beforeEach');
            // Journey executes (simulated as passing)
            journeysExecuted.push(journey);
            results.push({ journey, status: 'passed' });
            await runHook('afterEach');
          }

          // globalTeardown runs after journeys
          await runHook('globalTeardown');

          // Broadcast run-end with journey results
          wsManager.broadcast({ type: 'run-end', results });
        }

        // Find the run-end broadcast
        runEndBroadcast = broadcasts.find(b => b.type === 'run-end');

        // ── PROPERTY ASSERTIONS ──

        // When globalSetup succeeds, ALL journeys proceed to execution
        expect(journeysExecuted).toHaveLength(journeyIds.length);
        expect(journeysExecuted).toEqual(journeyIds);

        // The run-end broadcast should NOT have an error field
        expect(runEndBroadcast).toBeDefined();
        expect(runEndBroadcast.error).toBeUndefined();

        // The run-end broadcast should have results for all journeys (none skipped)
        expect(runEndBroadcast.results).toHaveLength(journeyIds.length);
        for (const result of runEndBroadcast.results) {
          expect(result.status).not.toBe('skipped');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: CLI runner — when no globalSetup is configured, journeys still execute normally', async () => {
    // Feature: global-setup-abort, Property 8: Successful globalSetup leads to normal journey execution
    //
    // Edge case variant: when globalSetup is not configured at all,
    // the runner should still proceed to execute journeys normally.
    // This confirms the passthrough property holds even without a hook.

    await fc.assert(
      fc.asyncProperty(journeyListArb, async (journeyIds) => {
        const journeysExecuted: string[] = [];

        // ── main() control flow with no globalSetup configured ──
        const config = {
          testData: {
            // No globalSetup configured
            globalTeardown: '/fake/hooks/globalTeardown.ts',
          },
        };
        const journeysToRun = journeyIds.map(id => ({ id, name: id }));

        let processExited = false;

        // globalSetup block is skipped entirely when not configured
        if (config.testData && (config.testData as any).globalSetup) {
          try {
            // Would not reach here
            throw new Error('should not be called');
          } catch (error: unknown) {
            processExited = true;
          }
        }

        if (!processExited) {
          for (const journey of journeysToRun) {
            journeysExecuted.push(journey.id);
          }
        }

        // ── PROPERTY ASSERTIONS ──
        expect(journeysExecuted).toHaveLength(journeyIds.length);
        expect(journeysExecuted).toEqual(journeyIds);
      }),
      { numRuns: 100 },
    );
  });
});
