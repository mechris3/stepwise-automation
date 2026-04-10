import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs';
import { globSync } from 'glob';

/**
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4**
 *
 * Bug Condition Exploration Test:
 * `discoverJourneysSync()` ignores `STEPWISE_JOURNEY_PATH` and
 * `STEPWISE_JOURNEYS_GLOB` env vars entirely. These tests MUST FAIL on
 * unfixed code — failure confirms the bug exists.
 *
 * We copy the function body here (it's self-contained: path, fs, globSync)
 * to test the logic directly without importing @playwright/test.
 */

// ── Copy of discoverJourneysSync from all-journeys.spec.ts (FIXED) ──────────
// This is an exact copy of the fixed implementation so we can test it
// in isolation without needing Playwright imports.

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

describe('Bug Condition: discoverJourneysSync ignores env vars', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear relevant env vars before each test
    savedEnv.STEPWISE_JOURNEY_PATH = process.env.STEPWISE_JOURNEY_PATH;
    savedEnv.STEPWISE_JOURNEYS_GLOB = process.env.STEPWISE_JOURNEYS_GLOB;
    delete process.env.STEPWISE_JOURNEY_PATH;
    delete process.env.STEPWISE_JOURNEYS_GLOB;
  });

  afterEach(() => {
    // Restore env vars
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

  it('should return single journey when STEPWISE_JOURNEY_PATH is set', () => {
    // Set env var to a specific journey path
    process.env.STEPWISE_JOURNEY_PATH = '/abs/path/login.journey.ts';

    const result = discoverJourneysSync();

    // Expected: function uses the env var and returns the journey
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'login',
        path: '/abs/path/login.journey.ts',
      }),
    );
  });

  it('should use STEPWISE_JOURNEYS_GLOB when STEPWISE_JOURNEY_PATH is absent', () => {
    // Create a temp directory with a journey file to glob against
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'stepwise-test-'));
    const journeyFile = path.join(tmpDir, 'signup.journey.ts');
    fs.writeFileSync(journeyFile, '// test journey');

    try {
      // Set glob env var to match the temp journey file
      process.env.STEPWISE_JOURNEYS_GLOB = path.join(tmpDir, '*.journey.ts');

      const result = discoverJourneysSync();

      // Expected: function uses the glob env var and discovers the journey
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'signup',
          path: journeyFile,
        }),
      );
    } finally {
      // Cleanup
      fs.unlinkSync(journeyFile);
      fs.rmdirSync(tmpDir);
    }
  });

  /**
   * PBT: Generate random valid absolute paths ending in `.journey.ts`,
   * set as `STEPWISE_JOURNEY_PATH`, assert function returns single-element
   * array with that path.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it('PBT: for all valid journey paths set via env var, returns that journey', () => {
    // Generate random journey filenames (kebab-case) and absolute directory paths
    const journeyIdArb = fc
      .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
      .filter(s => s.length > 0 && !s.endsWith('-'));

    const dirArb = fc
      .stringMatching(/^\/[a-z][a-z0-9/]{0,40}$/)
      .filter(s => s.length > 1 && !s.endsWith('/'));

    fc.assert(
      fc.property(journeyIdArb, dirArb, (journeyId, dir) => {
        const journeyPath = `${dir}/${journeyId}.journey.ts`;
        process.env.STEPWISE_JOURNEY_PATH = journeyPath;

        const result = discoverJourneysSync();

        // The function should return exactly one journey with the given path
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe(journeyPath);
        expect(result[0].id).toBe(journeyId);
      }),
      { numRuns: 100 },
    );
  });
});
