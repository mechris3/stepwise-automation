/**
 * Single Puppeteer journey runner.
 *
 * This is the script spawned by TestExecutor for each Puppeteer journey.
 * It reads configuration from the consuming project's config file,
 * launches a Puppeteer browser, instantiates PuppeteerAdapter, dynamically
 * imports the journey module, and calls its default export.
 *
 * Environment variables (set by TestExecutor):
 *   TEST_DOMAIN, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, ACTION_DELAY,
 *   BROWSER_PATH, KEEP_BROWSER_OPEN, DEVTOOLS, REDUX_DEVTOOLS_PATH,
 *   TEST_BREAKPOINTS
 */
export {};
//# sourceMappingURL=run-journey.d.ts.map