"use strict";
/**
 * Playwright config template for stepwise-automation.
 *
 * Used by the TestExecutor when spawning `npx playwright test`.
 * Reads viewport dimensions and other settings from environment variables
 * passed by the TestExecutor.
 *
 * Sequential execution: fullyParallel false, workers 1 — journeys run
 * one at a time in a single worker to match the debugger-style model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Use `any` for defineConfig since playwright is an optional peer dep.
// When playwright IS installed in the consuming project, this resolves fine.
let defineConfig;
try {
    defineConfig = require('@playwright/test').defineConfig;
}
catch {
    // Fallback: identity function so the file can be parsed even if
    // playwright is not installed (e.g. during type-checking of the package).
    defineConfig = (config) => config;
}
const viewportWidth = parseInt(process.env.VIEWPORT_WIDTH || '1280', 10);
const viewportHeight = parseInt(process.env.VIEWPORT_HEIGHT || '720', 10);
const headless = process.env.HEADLESS === 'true';
// Chrome UI chrome offset (address bar, tabs, etc.) so the content area
// matches the requested viewport — same strategy as the Puppeteer runner.
const chromeOffset = 150;
exports.default = defineConfig({
    testDir: '.',
    testMatch: 'all-journeys.spec.ts',
    fullyParallel: false,
    workers: 1,
    timeout: 5 * 60 * 1000, // 5 minutes per test — generous for complex journeys
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: 'list',
    use: {
        viewport: { width: viewportWidth, height: viewportHeight },
        actionTimeout: 10_000,
        permissions: ['clipboard-read', 'clipboard-write'],
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                baseURL: process.env.TEST_DOMAIN || 'http://localhost:3000',
                headless,
                launchOptions: {
                    args: [
                        `--window-size=${viewportWidth},${viewportHeight + chromeOffset}`,
                    ],
                },
            },
        },
    ],
});
//# sourceMappingURL=playwright.config.js.map