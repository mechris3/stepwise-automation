import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 1.2, 4.1, 4.2, 4.3**
 *
 * Feature: global-setup-abort, Property 3: CLI error output contains hook name
 * prefix and conditional stack trace
 *
 * For any thrown value from globalSetup, the CLI runner's stderr output SHALL
 * contain the text "globalSetup" and the error's message. Additionally, if the
 * thrown value has a `stack` property, the stack SHALL appear in stderr; if it
 * does not have a `stack` property, no stack trace SHALL appear.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulates the CLI runner's globalSetup error handling path.
 * This mirrors the catch block in main() of run-all-journeys.ts.
 */
function handleGlobalSetupError(
  error: unknown,
  stderrWrite: (chunk: string) => boolean,
): void {
  const message = error instanceof Error ? error.message : String(error);
  stderrWrite(`❌ globalSetup failed: ${message}\n`);
  if (error instanceof Error && error.stack) {
    stderrWrite(`${error.stack}\n`);
  }
}

// ── Generators ───────────────────────────────────────────────────────────────

/** Generates arbitrary non-empty error message strings */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.trim().length > 0,
);

/** Generates arbitrary stack trace strings (multi-line, realistic-ish) */
const stackTraceArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 100 }),
  fc.array(
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.nat({ max: 9999 }),
      fc.nat({ max: 999 }),
    ),
    { minLength: 1, maxLength: 5 },
  ),
).map(([msg, frames]) => {
  const frameLines = frames.map(
    ([file, line, col]) => `    at ${file}:${line}:${col}`,
  );
  return `Error: ${msg}\n${frameLines.join('\n')}`;
});

/** Generates arbitrary non-Error thrown values (strings, numbers, objects) */
const nonErrorValueArb = fc.oneof(
  fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 3: CLI error output contains hook name prefix and conditional stack trace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PBT: Error with stack — stderr contains "globalSetup", message, and stack trace', async () => {
    // Feature: global-setup-abort, Property 3
    await fc.assert(
      fc.asyncProperty(errorMessageArb, stackTraceArb, async (msg, stack) => {
        const error = new Error(msg);
        error.stack = stack;

        const stderrChunks: string[] = [];
        const mockStderrWrite = vi.fn((chunk: string) => {
          stderrChunks.push(chunk);
          return true;
        });

        handleGlobalSetupError(error, mockStderrWrite);

        const fullOutput = stderrChunks.join('');

        // stderr must contain "globalSetup"
        expect(fullOutput).toContain('globalSetup');

        // stderr must contain the error message
        expect(fullOutput).toContain(msg);

        // stderr must contain the stack trace when present
        expect(fullOutput).toContain(stack);
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: Error without stack — stderr contains "globalSetup" and message, no stack trace', async () => {
    // Feature: global-setup-abort, Property 3
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (msg) => {
        const error = new Error(msg);
        // Explicitly remove the stack property
        error.stack = undefined;

        const stderrChunks: string[] = [];
        const mockStderrWrite = vi.fn((chunk: string) => {
          stderrChunks.push(chunk);
          return true;
        });

        handleGlobalSetupError(error, mockStderrWrite);

        const fullOutput = stderrChunks.join('');

        // stderr must contain "globalSetup"
        expect(fullOutput).toContain('globalSetup');

        // stderr must contain the error message
        expect(fullOutput).toContain(msg);

        // stderrWrite should only be called once (no stack trace write)
        expect(mockStderrWrite).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: Non-Error thrown value — stderr contains "globalSetup" and stringified value, no stack', async () => {
    // Feature: global-setup-abort, Property 3
    await fc.assert(
      fc.asyncProperty(nonErrorValueArb, async (thrownValue) => {
        const stderrChunks: string[] = [];
        const mockStderrWrite = vi.fn((chunk: string) => {
          stderrChunks.push(chunk);
          return true;
        });

        handleGlobalSetupError(thrownValue, mockStderrWrite);

        const fullOutput = stderrChunks.join('');

        // stderr must contain "globalSetup"
        expect(fullOutput).toContain('globalSetup');

        // stderr must contain the stringified thrown value
        expect(fullOutput).toContain(String(thrownValue));

        // stderrWrite should only be called once (no stack trace for non-Error values)
        expect(mockStderrWrite).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: Error with empty string stack — treated as no stack (falsy)', async () => {
    // Feature: global-setup-abort, Property 3
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (msg) => {
        const error = new Error(msg);
        // Empty string is falsy, so no stack should be printed
        error.stack = '';

        const stderrChunks: string[] = [];
        const mockStderrWrite = vi.fn((chunk: string) => {
          stderrChunks.push(chunk);
          return true;
        });

        handleGlobalSetupError(error, mockStderrWrite);

        const fullOutput = stderrChunks.join('');

        // stderr must contain "globalSetup"
        expect(fullOutput).toContain('globalSetup');

        // stderr must contain the error message
        expect(fullOutput).toContain(msg);

        // stderrWrite should only be called once (empty stack is falsy)
        expect(mockStderrWrite).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 },
    );
  });
});
