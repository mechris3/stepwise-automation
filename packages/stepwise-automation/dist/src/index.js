"use strict";
/**
 * @mechris3/stepwise-automation
 *
 * Debugger-style browser automation test runner with live execution control,
 * breakpoints, pause/resume/step-through, and a visual web dashboard.
 * Dual engine support: Puppeteer + Playwright via adapter pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findReduxDevToolsExtension = exports.clearCommands = exports.readCommand = exports.writeCommand = exports.withErrorContext = exports.getErrorSummary = exports.formatTestError = exports.waitForCondition = exports.BrowserContextPage = exports.BasePage = exports.PlaywrightAdapter = exports.PuppeteerAdapter = exports.BaseAdapter = exports.detectEngines = exports.loadConfig = exports.defineConfig = void 0;
// ── Configuration ───────────────────────────────────────────────────────────
var config_1 = require("./config");
Object.defineProperty(exports, "defineConfig", { enumerable: true, get: function () { return config_1.defineConfig; } });
Object.defineProperty(exports, "loadConfig", { enumerable: true, get: function () { return config_1.loadConfig; } });
Object.defineProperty(exports, "detectEngines", { enumerable: true, get: function () { return config_1.detectEngines; } });
var base_adapter_1 = require("./adapters/base-adapter");
Object.defineProperty(exports, "BaseAdapter", { enumerable: true, get: function () { return base_adapter_1.BaseAdapter; } });
var puppeteer_adapter_1 = require("./adapters/puppeteer-adapter");
Object.defineProperty(exports, "PuppeteerAdapter", { enumerable: true, get: function () { return puppeteer_adapter_1.PuppeteerAdapter; } });
var playwright_adapter_1 = require("./adapters/playwright-adapter");
Object.defineProperty(exports, "PlaywrightAdapter", { enumerable: true, get: function () { return playwright_adapter_1.PlaywrightAdapter; } });
// ── Page Objects ────────────────────────────────────────────────────────────
var base_page_1 = require("./page-objects/base.page");
Object.defineProperty(exports, "BasePage", { enumerable: true, get: function () { return base_page_1.BasePage; } });
var browser_context_page_1 = require("./page-objects/browser-context.page");
Object.defineProperty(exports, "BrowserContextPage", { enumerable: true, get: function () { return browser_context_page_1.BrowserContextPage; } });
// ── Utilities ───────────────────────────────────────────────────────────────
var wait_utils_1 = require("./utils/wait-utils");
Object.defineProperty(exports, "waitForCondition", { enumerable: true, get: function () { return wait_utils_1.waitForCondition; } });
var error_formatter_1 = require("./utils/error-formatter");
Object.defineProperty(exports, "formatTestError", { enumerable: true, get: function () { return error_formatter_1.formatTestError; } });
Object.defineProperty(exports, "getErrorSummary", { enumerable: true, get: function () { return error_formatter_1.getErrorSummary; } });
var page_object_error_1 = require("./utils/page-object-error");
Object.defineProperty(exports, "withErrorContext", { enumerable: true, get: function () { return page_object_error_1.withErrorContext; } });
// ── IPC ─────────────────────────────────────────────────────────────────────
var ipc_1 = require("./utils/ipc");
Object.defineProperty(exports, "writeCommand", { enumerable: true, get: function () { return ipc_1.writeCommand; } });
Object.defineProperty(exports, "readCommand", { enumerable: true, get: function () { return ipc_1.readCommand; } });
Object.defineProperty(exports, "clearCommands", { enumerable: true, get: function () { return ipc_1.clearCommands; } });
// ── Optional Utilities ──────────────────────────────────────────────────────
var redux_devtools_1 = require("./utils/redux-devtools");
Object.defineProperty(exports, "findReduxDevToolsExtension", { enumerable: true, get: function () { return redux_devtools_1.findReduxDevToolsExtension; } });
//# sourceMappingURL=index.js.map