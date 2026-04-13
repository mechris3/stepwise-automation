/**
 * Playwright test wrapper that runs journeys via PlaywrightAdapter.
 *
 * This file is the entry point spawned by TestExecutor via `npx playwright test`.
 * It works the same way as the Puppeteer runner (`run-journey.ts`):
 *   1. Read STEPWISE_JOURNEY_PATH env var (pre-resolved by TestExecutor)
 *   2. Register a single Playwright test for that journey
 *   3. Execute the journey with PlaywrightAdapter
 *
 * Fallback: when STEPWISE_JOURNEY_PATH is not set (standalone/CLI usage),
 * discover journeys via STEPWISE_JOURNEYS_GLOB or config file, then register
 * one test per journey (filtered by --grep).
 *
 * Playwright is an optional peer dependency. This file is only executed
 * when playwright IS installed (spawned by TestExecutor or CLI).
 * The static import ensures Playwright's test runner correctly tracks
 * test registrations from this file.
 */

// @ts-ignore — playwright is an optional peer dependency
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { globSync } from 'glob';
import { BaseAdapter } from '../../adapters/base-adapter';
import { PlaywrightAdapter } from '../../adapters/playwright-adapter';

/**
 * Resolve the journey(s) to run. Mirrors the Puppeteer runner's approach:
 *   1. STEPWISE_JOURNEY_PATH — single pre-resolved path from TestExecutor
 *   2. STEPWISE_JOURNEYS_GLOB — glob pattern from TestExecutor
 *   3. Config file discovery — standalone/CLI fallback
 */
function discoverJourneysSync(): Array<{ id: string; name: string; path: string }> {
  // Priority 1: Pre-resolved single journey path from TestExecutor
  // Same as Puppeteer runner: use the path directly, no scanning needed
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

// Discover journeys at module load time (synchronous)
const journeys = discoverJourneysSync();

// Register one test per journey.
// When spawned by TestExecutor with STEPWISE_JOURNEY_PATH, there's exactly
// one journey — no --grep needed, just like Puppeteer.
test.describe.serial('Stepwise Journeys', () => {
  for (const journey of journeys) {
    test(journey.id, async ({ page }: { page: any }) => {
      // Reset action index for this journey
      BaseAdapter.resetActionIndex();

      // Create a PlaywrightAdapter with the test's page
      const adapter = new PlaywrightAdapter(page);

      // Dynamically load the journey module
      // Use require() like the reference implementation — Playwright's worker
      // runs in CJS mode, so dynamic import() fails on .ts journey files.
      const journeyModule = require(journey.path);

      // Support both class-based and function-based journeys,
      // same as the Puppeteer runner
      const defaultExport = journeyModule.default;

      if (defaultExport && typeof defaultExport === 'function') {
        if (defaultExport.prototype && typeof defaultExport.prototype.execute === 'function') {
          const instance = new defaultExport(adapter);
          await instance.execute();
        } else {
          await defaultExport(adapter);
        }
      } else {
        // No default export — look for any exported class with execute()
        const exportedClasses = Object.values(journeyModule).filter(
          (exp: any) => typeof exp === 'function' && exp.prototype && typeof exp.prototype.execute === 'function',
        );
        if (exportedClasses.length > 0) {
          const JourneyClass = exportedClasses[0] as any;
          const instance = new JourneyClass(adapter);
          await instance.execute();
        } else {
          // Fallback: try any exported function
          const exportedFns = Object.values(journeyModule).filter((exp: any) => typeof exp === 'function');
          if (exportedFns.length > 0) {
            await (exportedFns[0] as any)(adapter);
          } else {
            throw new Error(
              `Journey "${journey.id}" does not export a class with execute() or a default function. ` +
              `Available exports: ${Object.keys(journeyModule).join(', ')}`,
            );
          }
        }
      }
    });
  }
});
