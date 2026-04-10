"use strict";
/**
 * Unified interface for browser automation tools.
 *
 * Provides a consistent API that works with both Puppeteer and Playwright,
 * allowing test logic to be written once and executed with either tool.
 *
 * @example
 * ```typescript
 * // Use with Puppeteer
 * const adapter = new PuppeteerAdapter(page);
 * await adapter.click('[data-testid="button"]');
 *
 * // Use with Playwright
 * const adapter = new PlaywrightAdapter(page);
 * await adapter.click('[data-testid="button"]');
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=browser-adapter.interface.js.map