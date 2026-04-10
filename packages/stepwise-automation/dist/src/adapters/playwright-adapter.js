"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightAdapter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const base_adapter_1 = require("./base-adapter");
const playwright_utils_1 = require("../utils/playwright-utils");
/**
 * Playwright implementation of the BrowserAdapter interface.
 *
 * Uses Playwright-specific utilities for Angular/React/Vue compatibility
 * via DOM event dispatching and strict mode handling (.first() for multiple matches).
 * Each action is wrapped with logAndCheckAction() (before) and logActionComplete()
 * + addSlowModeDelay() (after) for breakpoint, pause/resume, and slow-mode support.
 *
 * Playwright is an optional peer dependency — the Page type is used as `any`
 * to avoid requiring playwright as a direct dependency at compile time.
 * The consuming project must have playwright installed at runtime.
 */
class PlaywrightAdapter extends base_adapter_1.BaseAdapter {
    page;
    /**
     * @param page - A Playwright `Page` instance (typed as `any` to avoid peer dep at compile time)
     */
    constructor(page) {
        super();
        this.page = page;
    }
    async click(selector) {
        await this.logAndCheckAction(`Click: ${selector}`);
        try {
            await (0, playwright_utils_1.clickWithAngularSupport)(this.page, selector);
        }
        catch (error) {
            // If normal click fails due to viewport issues, try scroll-aware click
            if (error.message?.includes('outside of the viewport')) {
                await (0, playwright_utils_1.scrollIntoViewAndClick)(this.page, selector);
            }
            else {
                throw error;
            }
        }
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async fill(selector, value) {
        await this.logAndCheckAction(`Fill: ${selector}`);
        await (0, playwright_utils_1.fillWithAngularEvents)(this.page, selector, value);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async waitForSelector(selector) {
        await this.logAndCheckAction(`Wait for: ${selector}`);
        await (0, playwright_utils_1.waitForElement)(this.page, selector);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async getText(selector) {
        await this.logAndCheckAction(`Get text: ${selector}`);
        const text = await (0, playwright_utils_1.getText)(this.page, selector);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return text;
    }
    async isVisible(selector) {
        await this.logAndCheckAction(`Check visible: ${selector}`);
        const visible = await this.page.locator(selector).first().isVisible();
        this.logActionComplete();
        await this.addSlowModeDelay();
        return visible;
    }
    async clickAndWaitForNavigation(selector) {
        await this.logAndCheckAction(`Click and navigate: ${selector}`);
        await this.page.locator(selector).click({ timeout: 10000 });
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async waitForTimeout(ms) {
        await this.logAndCheckAction(`Wait: ${ms}ms`);
        await new Promise(resolve => setTimeout(resolve, ms));
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async isDisabled(selector) {
        await this.logAndCheckAction(`Check disabled: ${selector}`);
        const disabled = await this.page.locator(selector).isDisabled();
        this.logActionComplete();
        await this.addSlowModeDelay();
        return disabled;
    }
    async getInputValue(selector) {
        await this.logAndCheckAction(`Get input value: ${selector}`);
        const value = await this.page.locator(selector).inputValue();
        this.logActionComplete();
        await this.addSlowModeDelay();
        return value;
    }
    async countElements(selector) {
        await this.logAndCheckAction(`Count elements: ${selector}`);
        const count = await this.page.locator(selector).count();
        this.logActionComplete();
        await this.addSlowModeDelay();
        return count;
    }
    async readClipboard() {
        await this.logAndCheckAction('Read clipboard');
        // Use string form to avoid TS error — navigator.clipboard is a browser-context API
        const text = await this.page.evaluate('navigator.clipboard.readText()');
        this.logActionComplete();
        await this.addSlowModeDelay();
        return text;
    }
    async getCurrentUrl() {
        await this.logAndCheckAction('Get current URL');
        const url = this.page.url();
        this.logActionComplete();
        await this.addSlowModeDelay();
        return url;
    }
    async waitForHidden(selector) {
        await this.logAndCheckAction(`Wait for hidden: ${selector}`);
        await this.page.locator(selector).first().waitFor({ state: 'hidden', timeout: 10000 });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async getAttribute(selector, attribute) {
        await this.logAndCheckAction(`Get attribute "${attribute}": ${selector}`);
        const value = await this.page.locator(selector).getAttribute(attribute);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return value;
    }
    async evaluate(script) {
        await this.logAndCheckAction('Evaluate script');
        const result = await this.page.evaluate(script);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return result;
    }
    async goto(url) {
        const resolved = this.resolveUrl(url);
        await this.logAndCheckAction(`Navigate to: ${resolved}`);
        await this.page.goto(resolved, { waitUntil: 'networkidle' });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async clearSession(origin) {
        await this.logAndCheckAction('Clear session');
        await this.page.context().clearCookies();
        const targetOrigin = origin || this.deriveOrigin(this.page.url());
        if (targetOrigin) {
            const client = await this.page.context().newCDPSession(this.page);
            await client.send('Storage.clearDataForOrigin', {
                origin: targetOrigin,
                storageTypes: 'cookies,local_storage,session_storage,indexeddb',
            });
        }
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async uploadFile(selector, filePath) {
        await this.logAndCheckAction(`Upload file: ${selector}`);
        await this.page.locator(selector).setInputFiles(filePath);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async selectByIndex(selector, index) {
        await this.logAndCheckAction(`Select by index ${index}: ${selector}`);
        await this.page.locator(selector).selectOption({ index });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async selectByValue(selector, value) {
        await this.logAndCheckAction(`Select by value "${value}": ${selector}`);
        await this.page.locator(selector).selectOption({ value });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async selectByText(selector, text, exact = false) {
        await this.logAndCheckAction(`Select by text "${text}"${exact ? ' (exact)' : ''}: ${selector}`);
        if (exact) {
            await this.page.locator(selector).selectOption({ label: text });
        }
        else {
            // Playwright's selectOption doesn't support contains — find the matching option via string-based evaluate
            const escapedSelector = selector.replace(/'/g, "\\'");
            const escapedText = text.replace(/'/g, "\\'");
            const optionValue = await this.page.evaluate(`(function() {
        var select = document.querySelector('${escapedSelector}');
        if (!select) throw new Error('Select element not found: ${escapedSelector}');
        var match = Array.from(select.options).find(function(o) {
          return o.text.trim().toLowerCase().indexOf('${escapedText}'.toLowerCase()) !== -1;
        });
        if (!match) throw new Error('No option containing "${escapedText}" in ${escapedSelector}');
        return match.value;
      })()`);
            await this.page.locator(selector).selectOption({ value: optionValue });
        }
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async clickAndDownload(selector) {
        await this.logAndCheckAction(`Click and download: ${selector}`);
        const downloadDir = this.ensureDownloadDir();
        // Wait for download event triggered by the click
        const [download] = await Promise.all([
            this.page.waitForEvent('download', { timeout: 30_000 }),
            this.page.locator(selector).click(),
        ]);
        const suggestedFilename = download.suggestedFilename();
        const destPath = path.join(downloadDir, suggestedFilename);
        await download.saveAs(destPath);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return {
            filePath: destPath,
            suggestedFilename,
        };
    }
    async clearDownloads() {
        await this.logAndCheckAction('Clear downloads');
        const downloadDir = base_adapter_1.BaseAdapter.downloadDir;
        if (fs.existsSync(downloadDir)) {
            const files = fs.readdirSync(downloadDir);
            for (const file of files) {
                fs.unlinkSync(path.join(downloadDir, file));
            }
        }
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
}
exports.PlaywrightAdapter = PlaywrightAdapter;
//# sourceMappingURL=playwright-adapter.js.map