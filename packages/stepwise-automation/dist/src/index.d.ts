/**
 * @mechris3/stepwise-automation
 *
 * Debugger-style browser automation test runner with live execution control,
 * breakpoints, pause/resume/step-through, and a visual web dashboard.
 * Dual engine support: Puppeteer + Playwright via adapter pattern.
 */
export { defineConfig, loadConfig, detectEngines } from './config';
export type { StepwiseConfig, ResolvedConfig, BrowserConfig } from './config';
export type { BrowserAdapter, DownloadResult } from './adapters/browser-adapter.interface';
export { BaseAdapter } from './adapters/base-adapter';
export { PuppeteerAdapter } from './adapters/puppeteer-adapter';
export { PlaywrightAdapter } from './adapters/playwright-adapter';
export { BasePage } from './page-objects/base.page';
export { BrowserContextPage } from './page-objects/browser-context.page';
export { waitForCondition } from './utils/wait-utils';
export { formatTestError, getErrorSummary } from './utils/error-formatter';
export { withErrorContext } from './utils/page-object-error';
export { writeCommand, readCommand, clearCommands } from './utils/ipc';
export type { IpcCommand } from './utils/ipc';
export { findReduxDevToolsExtension } from './utils/redux-devtools';
//# sourceMappingURL=index.d.ts.map