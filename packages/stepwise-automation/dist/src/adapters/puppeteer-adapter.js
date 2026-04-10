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
exports.PuppeteerAdapter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const base_adapter_1 = require("./base-adapter");
const puppeteer_utils_1 = require("../utils/puppeteer-utils");
/**
 * Puppeteer implementation of the BrowserAdapter interface.
 *
 * Uses Puppeteer-specific utilities for Angular/React/Vue compatibility
 * via DOM event dispatching. Each action is wrapped with logAndCheckAction()
 * (before) and logActionComplete() + addSlowModeDelay() (after) for
 * breakpoint, pause/resume, and slow-mode support.
 *
 * Puppeteer is an optional peer dependency — the Page type is used as `any`
 * to avoid requiring puppeteer as a direct dependency at compile time.
 * The consuming project must have puppeteer installed at runtime.
 */
class PuppeteerAdapter extends base_adapter_1.BaseAdapter {
    page;
    /**
     * @param page - A Puppeteer `Page` instance (typed as `any` to avoid peer dep at compile time)
     */
    constructor(page) {
        super();
        this.page = page;
    }
    async click(selector) {
        await this.logAndCheckAction(`Click: ${selector}`);
        await (0, puppeteer_utils_1.clickWithAngularSupport)(this.page, selector);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async fill(selector, value) {
        await this.logAndCheckAction(`Fill: ${selector}`);
        await (0, puppeteer_utils_1.fillWithAngularEvents)(this.page, selector, value);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async waitForSelector(selector) {
        await this.logAndCheckAction(`Wait for: ${selector}`);
        await this.page.waitForSelector(selector, { visible: true, timeout: 10000 });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async isVisible(selector) {
        await this.logAndCheckAction(`Check visible: ${selector}`);
        const element = await this.page.$(selector);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return element !== null;
    }
    async clickAndWaitForNavigation(selector) {
        await this.logAndCheckAction(`Click and navigate: ${selector}`);
        await this.page.waitForSelector(selector, { visible: true, timeout: 10000 });
        await Promise.all([
            this.page.click(selector),
            this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
        ]);
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
        await this.page.waitForSelector(selector, { visible: true, timeout: 10000 });
        const disabled = await this.page.$eval(selector, (el) => el.disabled);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return disabled;
    }
    async getText(selector) {
        await this.logAndCheckAction(`Get text: ${selector}`);
        await this.page.waitForSelector(selector, { visible: true, timeout: 10000 });
        const text = await this.page.$eval(selector, (el) => el.textContent || '');
        this.logActionComplete();
        await this.addSlowModeDelay();
        return text;
    }
    async getInputValue(selector) {
        await this.logAndCheckAction(`Get input value: ${selector}`);
        await this.page.waitForSelector(selector, { visible: true, timeout: 10000 });
        const value = await this.page.$eval(selector, (el) => el.value);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return value;
    }
    async countElements(selector) {
        await this.logAndCheckAction(`Count elements: ${selector}`);
        const elements = await this.page.$$(selector);
        this.logActionComplete();
        await this.addSlowModeDelay();
        return elements.length;
    }
    async readClipboard() {
        await this.logAndCheckAction('Read clipboard');
        const client = await this.page.createCDPSession();
        await client.send('Browser.grantPermissions', {
            permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        });
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
        await this.page.waitForSelector(selector, { hidden: true, timeout: 10000 });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async getAttribute(selector, attribute) {
        await this.logAndCheckAction(`Get attribute "${attribute}": ${selector}`);
        await this.page.waitForSelector(selector, { visible: true, timeout: 10000 });
        const value = await this.page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
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
        await this.page.goto(resolved, { waitUntil: 'networkidle0', timeout: 10000 });
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async clearSession(origin) {
        await this.logAndCheckAction('Clear session');
        const client = await this.page.createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        const targetOrigin = origin || this.deriveOrigin(this.page.url());
        if (targetOrigin) {
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
        // Don't wait for visibility since file inputs are typically hidden
        await this.page.waitForSelector(selector, { timeout: 10000 });
        const input = await this.page.$(selector);
        if (!input) {
            throw new Error(`File input not found: ${selector}`);
        }
        await input.uploadFile(filePath);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async selectByIndex(selector, index) {
        await this.logAndCheckAction(`Select by index ${index}: ${selector}`);
        await (0, puppeteer_utils_1.selectByIndex)(this.page, selector, index);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async selectByValue(selector, value) {
        await this.logAndCheckAction(`Select by value "${value}": ${selector}`);
        await (0, puppeteer_utils_1.selectByValue)(this.page, selector, value);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async selectByText(selector, text, exact = false) {
        await this.logAndCheckAction(`Select by text "${text}"${exact ? ' (exact)' : ''}: ${selector}`);
        await (0, puppeteer_utils_1.selectByText)(this.page, selector, text, exact);
        this.logActionComplete();
        await this.addSlowModeDelay();
    }
    async clickAndDownload(selector) {
        await this.logAndCheckAction(`Click and download: ${selector}`);
        const downloadDir = this.ensureDownloadDir();
        // Configure CDP to download to our directory
        const client = await this.page.createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadDir,
        });
        // Snapshot existing files before click
        const before = new Set(fs.readdirSync(downloadDir));
        // Click the element
        await this.page.click(selector);
        // Poll for a new completed file (no .crdownload extension)
        const timeout = 30_000;
        const start = Date.now();
        let newFile;
        while (Date.now() - start < timeout) {
            const after = fs.readdirSync(downloadDir);
            newFile = after.find((f) => !before.has(f) && !f.endsWith('.crdownload'));
            if (newFile)
                break;
            await new Promise(r => setTimeout(r, 200));
        }
        if (!newFile)
            throw new Error('Download timed out after 30 seconds');
        this.logActionComplete();
        await this.addSlowModeDelay();
        return {
            filePath: path.join(downloadDir, newFile),
            suggestedFilename: newFile,
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
exports.PuppeteerAdapter = PuppeteerAdapter;
//# sourceMappingURL=puppeteer-adapter.js.map