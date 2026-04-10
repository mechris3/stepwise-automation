/**
 * Batch Puppeteer journey runner for headless CLI mode.
 *
 * This is the script used by `npx @mechris3/stepwise-automation run`.
 * It loads config, discovers all journeys (or filters by names from process.argv),
 * runs them sequentially by spawning run-journey.ts for each one,
 * calls cleanup between journeys if configured, stops on first failure,
 * and exits with code 0 if all pass, 1 if any fail.
 */

import { spawn } from 'child_process';
import { loadConfig } from '../../config';
import { discoverJourneys, Journey } from '../../server/journey-discovery';

// ── Parse args ──────────────────────────────────────────────────────────
// Journey names to filter by (optional). If none provided, run all.
const requestedJourneys = process.argv.slice(2);

// ── Types ───────────────────────────────────────────────────────────────
/** Result of a single journey execution. */
interface JourneyResult {
  /** The journey identifier. */
  journey: string;
  /** Whether the journey passed or failed. */
  status: 'passed' | 'failed';
  /** Elapsed time in seconds (formatted to 2 decimal places). */
  duration: string;
}

/**
 * Spawns a child process to run a single journey via `run-journey.ts`.
 * Uses `tsx` loaders for TypeScript support.
 *
 * @param journeyId - The journey identifier to execute
 * @returns Result containing pass/fail status and elapsed duration
 */
function runJourney(journeyId: string): Promise<JourneyResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const runnerPath = require('path').join(__dirname, 'run-journey.ts');
    const tsxEsmPath = 'file://' + require.resolve('tsx/esm');

    const child = spawn(process.execPath, [
      '--require', require.resolve('tsx/cjs'),
      '--import', tsxEsmPath,
      runnerPath,
      journeyId,
    ], {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        KEEP_BROWSER_OPEN: 'false',
      },
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      resolve({
        journey: journeyId,
        status: code === 0 ? 'passed' : 'failed',
        duration,
      });
    });

    child.on('error', (err) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ Failed to spawn process for "${journeyId}":`, err.message);
      resolve({
        journey: journeyId,
        status: 'failed',
        duration,
      });
    });
  });
}

/**
 * Runs a configured test data lifecycle hook by name.
 * Logs errors but does not stop the batch run.
 *
 * @param hookPath - Absolute path to the hook module
 * @param hookName - Display name for logging
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

/**
 * Prints a formatted summary table of journey results to stdout.
 *
 * @param results - Array of journey results collected during the run
 * @param totalJourneys - Total number of journeys that were scheduled
 */
function printSummary(results: JourneyResult[], totalJourneys: number): void {
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = totalJourneys - results.length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Results Summary');
  console.log('='.repeat(60));

  for (const result of results) {
    const icon = result.status === 'passed' ? '✅' : '❌';
    console.log(`  ${icon} ${result.journey} (${result.duration}s)`);
  }

  if (skipped > 0) {
    console.log(`  ⏭️  ${skipped} journey(s) skipped`);
  }

  console.log('─'.repeat(60));
  console.log(`  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`);
  console.log('='.repeat(60));
}

/**
 * Main entry point: loads config, discovers journeys, runs them sequentially,
 * and exits with code 0 (all passed) or 1 (any failed).
 */
async function main(): Promise<void> {
  const config = await loadConfig();
  const allJourneys = await discoverJourneys(config);

  if (allJourneys.length === 0) {
    console.error('❌ No journeys found matching the configured glob pattern.');
    process.exit(1);
  }

  // Filter journeys if specific names were requested
  let journeysToRun: Journey[];
  if (requestedJourneys.length > 0) {
    journeysToRun = allJourneys.filter((j) => requestedJourneys.includes(j.id));
    const notFound = requestedJourneys.filter(
      (name) => !allJourneys.some((j) => j.id === name),
    );
    if (notFound.length > 0) {
      console.error(`❌ Journey(s) not found: ${notFound.join(', ')}`);
      console.error(`   Available: ${allJourneys.map((j) => j.id).join(', ')}`);
      process.exit(1);
    }
  } else {
    journeysToRun = allJourneys;
  }

  console.log(`🚀 Running ${journeysToRun.length} journey(s) with Puppeteer\n`);

  // Run globalSetup once before all journeys
  if (config.testData?.globalSetup) {
    await runHook(config.testData.globalSetup, 'globalSetup');
  }

  const results: JourneyResult[] = [];

  for (let i = 0; i < journeysToRun.length; i++) {
    const journey = journeysToRun[i];

    // Run beforeEach before every journey
    if (config.testData?.beforeEach) {
      await runHook(config.testData.beforeEach, 'beforeEach');
    }

    console.log(`▶️  [${i + 1}/${journeysToRun.length}] ${journey.name}`);

    const result = await runJourney(journey.id);
    results.push(result);

    // Run afterEach after every journey (even on failure)
    if (config.testData?.afterEach) {
      await runHook(config.testData.afterEach, 'afterEach');
    }

    if (result.status === 'failed') {
      console.error(`❌ Journey "${journey.name}" failed — stopping run.`);
      break; // Stop on first failure
    }
  }

  // Run globalTeardown once after all journeys
  if (config.testData?.globalTeardown) {
    await runHook(config.testData.globalTeardown, 'globalTeardown');
  }

  printSummary(results, journeysToRun.length);

  const anyFailed = results.some((r) => r.status === 'failed');
  process.exit(anyFailed ? 1 : 0);
}

main().catch((error) => {
  console.error('\n❌ Batch runner failed:\n');
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
