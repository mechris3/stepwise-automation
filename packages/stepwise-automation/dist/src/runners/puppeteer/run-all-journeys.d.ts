/**
 * Batch Puppeteer journey runner for headless CLI mode.
 *
 * This is the script used by `npx @mechris3/stepwise-automation run`.
 * It loads config, discovers all journeys (or filters by names from process.argv),
 * runs them sequentially by spawning run-journey.ts for each one,
 * calls cleanup between journeys if configured, stops on first failure,
 * and exits with code 0 if all pass, 1 if any fail.
 */
export {};
//# sourceMappingURL=run-all-journeys.d.ts.map