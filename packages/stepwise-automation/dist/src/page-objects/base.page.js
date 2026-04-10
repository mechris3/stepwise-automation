"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePage = void 0;
const page_object_error_1 = require("../utils/page-object-error");
/**
 * Base page object class providing common functionality for all page objects.
 *
 * All page objects should extend this class to inherit convenience methods
 * for element interaction, waiting, and visibility checks. The underlying
 * BrowserAdapter is exposed as a protected property so subclasses can
 * access it directly for advanced operations.
 *
 * All methods are decorated with @withErrorContext so errors include
 * the page object class name and method name for easier debugging.
 *
 * @example
 * ```typescript
 * class LoginPage extends BasePage {
 *   private selectors = {
 *     usernameInput: '[data-testid="username"]',
 *     passwordInput: '[data-testid="password"]',
 *     submitButton: '[data-testid="submit"]',
 *   };
 *
 *   @withErrorContext
 *   async login(username: string, password: string): Promise<void> {
 *     await this.fill(this.selectors.usernameInput, username);
 *     await this.fill(this.selectors.passwordInput, password);
 *     await this.click(this.selectors.submitButton);
 *   }
 * }
 * ```
 */
class BasePage {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    /**
     * Clicks an element on the page.
     * @param selector - CSS selector of element to click
     */
    async click(selector) {
        await this.adapter.click(selector);
    }
    /**
     * Fills an input field with text.
     * @param selector - CSS selector of input element
     * @param value - Text to enter
     */
    async fill(selector, value) {
        await this.adapter.fill(selector, value);
    }
    /**
     * Gets the text content of an element.
     * @param selector - CSS selector of element
     * @returns Text content of the element
     */
    async getText(selector) {
        return this.adapter.getText(selector);
    }
    /**
     * Waits for an element to appear in the DOM.
     * @param selector - CSS selector to wait for
     */
    async waitForSelector(selector) {
        await this.adapter.waitForSelector(selector);
    }
    /**
     * Checks if an element is visible on the page.
     * @param selector - CSS selector to check
     * @returns True if element is visible, false otherwise
     */
    async isVisible(selector) {
        return this.adapter.isVisible(selector);
    }
    /**
     * Waits for an element to be hidden or removed from the DOM.
     * @param selector - CSS selector of the element to wait for
     */
    async waitForHidden(selector) {
        await this.adapter.waitForHidden(selector);
    }
    /**
     * Waits for a specified amount of time.
     * Use sparingly — prefer waiting for specific elements when possible.
     * @param ms - Milliseconds to wait
     */
    async waitForTimeout(ms) {
        await this.adapter.waitForTimeout(ms);
    }
    /**
     * Clicks an element and waits for navigation to complete.
     * @param selector - CSS selector of element to click
     */
    async clickAndWaitForNavigation(selector) {
        await this.adapter.clickAndWaitForNavigation(selector);
    }
    /**
     * Checks if an element is disabled.
     * @param selector - CSS selector to check
     * @returns True if element is disabled, false otherwise
     */
    async isDisabled(selector) {
        return this.adapter.isDisabled(selector);
    }
    /**
     * Gets the value of an input field.
     * @param selector - CSS selector of input element
     * @returns Current value of the input
     */
    async getInputValue(selector) {
        return this.adapter.getInputValue(selector);
    }
    /**
     * Counts the number of elements matching a selector.
     * @param selector - CSS selector to count
     * @returns Number of matching elements
     */
    async countElements(selector) {
        return this.adapter.countElements(selector);
    }
    /**
     * Gets an attribute value from an element.
     * @param selector - CSS selector of element
     * @param attribute - Attribute name to get
     * @returns Attribute value or null if not found
     */
    async getAttribute(selector, attribute) {
        return this.adapter.getAttribute(selector, attribute);
    }
    /**
     * Gets the current page URL.
     * @returns Current URL as string
     */
    async getCurrentUrl() {
        return this.adapter.getCurrentUrl();
    }
    /**
     * Navigates to the application's base URL.
     * Reads the target URL from the TEST_DOMAIN environment variable
     * (set by the runner from settings). Call this at the start of a
     * journey to load the app before interacting with it.
     */
    async navigateToApp() {
        const targetUrl = process.env.TEST_DOMAIN || '';
        if (!targetUrl) {
            throw new Error('No target URL configured. Set targetUrl in the dashboard settings or pass TEST_DOMAIN env var.');
        }
        await this.adapter.goto(targetUrl);
    }
    /**
     * Navigates to a URL.
     * @param url - URL to navigate to
     */
    async goto(url) {
        await this.adapter.goto(url);
    }
    async evaluate(script) {
        return this.adapter.evaluate(script);
    }
    /**
     * Clicks an element that triggers a file download and waits for the download to complete.
     * @param selector - CSS selector of the element that triggers the download
     * @returns The downloaded file's path and suggested filename
     */
    async clickAndDownload(selector) {
        return this.adapter.clickAndDownload(selector);
    }
    /**
     * Removes all downloaded files from the download directory.
     * Safe to call when no downloads exist.
     */
    async clearDownloads() {
        await this.adapter.clearDownloads();
    }
    /**
     * Clears all session data (cookies, localStorage, sessionStorage).
     * When an origin is provided, uses browser-level CDP APIs to clear storage
     * without requiring page context — safe to call on about:blank before navigation.
     * @param origin - Optional origin URL (e.g. 'http://localhost:3000') whose storage to clear
     */
    async clearSession(origin) {
        await this.adapter.clearSession(origin);
    }
}
exports.BasePage = BasePage;
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "click", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "fill", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "getText", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "waitForSelector", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "isVisible", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "waitForHidden", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "waitForTimeout", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "clickAndWaitForNavigation", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "isDisabled", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "getInputValue", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "countElements", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "getAttribute", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "getCurrentUrl", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "navigateToApp", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "goto", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "evaluate", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "clickAndDownload", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "clearDownloads", null);
__decorate([
    page_object_error_1.withErrorContext
], BasePage.prototype, "clearSession", null);
//# sourceMappingURL=base.page.js.map