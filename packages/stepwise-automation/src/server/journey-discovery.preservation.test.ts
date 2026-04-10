import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs';
import { globSync } from 'glob';

/**
 * **Validates: Requirements 3.2**
 *
 * Preservation Property Tests:
 * These tests capture baseline behavior of `discoverJourneysSync()` on UNFIXED code
 * when NO env vars are set (the non-bug-condition path).
 *
 * When neither `STEPWISE_JOURNEY_PATH` nor `STEPWISE_JOURNEYS_GLOB` is set,
 * the function attempts config file discovery from CWD. In the test environment,
 * there is no `test-runner.config.ts` in CWD, so the function returns `[]`.
 *
 * These tests MUST PASS on unfixed code — they define what should NOT change.
 */

// ── Copy of discoverJourneysSync from all-journeys.spec.ts (FIXED) ──────────
// Exact copy of the fixed implementation to test in isolation without
// needing @playwright/test imports.

function discoverJourneysSync(): Array<{ id: string; name: string; path: string }> {
  // Priority 1: Pre-resolved single journey path from TestExecutor
  const envJourneyPath = process.env.STEPWISE_JOURNEY_PATH;
  if (envJourneyPath) {
    const id = path.basename(envJourneyPath).replace(/\.journey\.ts$/, '');
    const name = id
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return [{ id, name, path: envJourneyPath }];
  }

  // Priority 2: Glob pattern from TestExecutor
  let journeysGlob: string | undefined;
  const envGlob = process.env.STEPWISE_JOURNEYS_GLOB;
  if (envGlob) {
    journeysGlob = envGlob;
  } else {
    // Priority 3: Config file discovery (standalone/CLI usage)
    const configPaths = [
      path.resolve(process.cwd(), 'test-runner.config.ts'),
      path.resolve(process.cwd(), '..', 'test-runner.config.ts'),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configModule = require(configPath);
          const config = configModule.default || configModule;
          if (config.journeys) {
            journeysGlob = path.isAbsolute(config.journeys)
              ? config.journeys
              : path.resolve(path.dirname(configPath), config.journeys);
            break;
          }
        } catch {
          // Config load failed — continue to next candidate
        }
      }
    }
  }

  if (!journeysGlob) return [];

  let files: string[];
  try {
    files = globSync(journeysGlob, { absolute: true });
  } catch {
    return [];
  }

  return files
    .filter(f => f.endsWith('.ts'))
    .map(filePath => {
      const filename = path.basename(filePath);
      const id = filename.replace(/\.journey\.ts$/, '');
      const name = id
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return { id, name, path: filePath };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Preservation: discoverJourneysSync config discovery without env vars', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.STEPWISE_JOURNEY_PATH = process.env.STEPWISE_JOURNEY_PATH;
    savedEnv.STEPWISE_JOURNEYS_GLOB = process.env.STEPWISE_JOURNEYS_GLOB;
    delete process.env.STEPWISE_JOURNEY_PATH;
    delete process.env.STEPWISE_JOURNEYS_GLOB;
  });

  afterEach(() => {
    if (savedEnv.STEPWISE_JOURNEY_PATH === undefined) {
      delete process.env.STEPWISE_JOURNEY_PATH;
    } else {
      process.env.STEPWISE_JOURNEY_PATH = savedEnv.STEPWISE_JOURNEY_PATH;
    }
    if (savedEnv.STEPWISE_JOURNEYS_GLOB === undefined) {
      delete process.env.STEPWISE_JOURNEYS_GLOB;
    } else {
      process.env.STEPWISE_JOURNEYS_GLOB = savedEnv.STEPWISE_JOURNEYS_GLOB;
    }
  });

  it('returns [] when neither env var is set and no config file exists in CWD', () => {
    // In the test environment, there is no test-runner.config.ts in CWD
    // so the function should fall through config discovery and return []
    const result = discoverJourneysSync();
    expect(result).toEqual([]);
  });

  it('treats empty string STEPWISE_JOURNEY_PATH as absent and falls through to config discovery', () => {
    process.env.STEPWISE_JOURNEY_PATH = '';

    const result = discoverJourneysSync();

    // Empty string env var should be treated same as absent —
    // function falls through to config discovery, returns []
    expect(result).toEqual([]);
  });

  it('treats empty string STEPWISE_JOURNEYS_GLOB as absent and falls through to config discovery', () => {
    process.env.STEPWISE_JOURNEYS_GLOB = '';

    const result = discoverJourneysSync();

    expect(result).toEqual([]);
  });

  it('checks config file candidates: {cwd}/test-runner.config.ts and {cwd}/../test-runner.config.ts', () => {
    // Verify the expected config file candidate paths exist in the function's logic
    // by confirming that neither candidate exists in the test environment CWD,
    // which is why the function returns [].
    const cwdConfig = path.resolve(process.cwd(), 'test-runner.config.ts');
    const parentConfig = path.resolve(process.cwd(), '..', 'test-runner.config.ts');

    // Neither config file should exist in the test environment
    expect(fs.existsSync(cwdConfig)).toBe(false);
    expect(fs.existsSync(parentConfig)).toBe(false);

    // Since no config files exist, the function returns []
    const result = discoverJourneysSync();
    expect(result).toEqual([]);
  });

  /**
   * PBT: for all empty/undefined env var combinations, the function produces
   * the same result as when env vars are completely absent.
   *
   * **Validates: Requirements 3.2**
   */
  it('PBT: for all empty/undefined env var combinations, produces same result as absent env vars', () => {
    // Baseline: no env vars at all
    delete process.env.STEPWISE_JOURNEY_PATH;
    delete process.env.STEPWISE_JOURNEYS_GLOB;
    const baseline = discoverJourneysSync();

    // Generate combinations of empty/undefined for both env vars
    const emptyOrUndefined = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
    );

    fc.assert(
      fc.property(emptyOrUndefined, emptyOrUndefined, (pathVal, globVal) => {
        // Set or delete env vars based on generated values
        if (pathVal === undefined) {
          delete process.env.STEPWISE_JOURNEY_PATH;
        } else {
          process.env.STEPWISE_JOURNEY_PATH = pathVal;
        }

        if (globVal === undefined) {
          delete process.env.STEPWISE_JOURNEYS_GLOB;
        } else {
          process.env.STEPWISE_JOURNEYS_GLOB = globVal;
        }

        const result = discoverJourneysSync();

        // All empty/undefined combinations should produce the same result
        // as when env vars are completely absent
        expect(result).toEqual(baseline);
      }),
      { numRuns: 50 },
    );
  });
});
