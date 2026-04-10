import { BrowserAdapter } from '../adapters/browser-adapter.interface';
import type { DownloadResult } from '../adapters/browser-adapter.interface';
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
export declare class BasePage {
    protected adapter: BrowserAdapter;
    constructor(adapter: BrowserAdapter);
    /**
     * Clicks an element on the page.
     * @param selector - CSS selector of element to click
     */
    click(selector: string): Promise<void>;
    /**
     * Fills an input field with text.
     * @param selector - CSS selector of input element
     * @param value - Text to enter
     */
    fill(selector: string, value: string): Promise<void>;
    /**
     * Gets the text content of an element.
     * @param selector - CSS selector of element
     * @returns Text content of the element
     */
    getText(selector: string): Promise<string>;
    /**
     * Waits for an element to appear in the DOM.
     * @param selector - CSS selector to wait for
     */
    waitForSelector(selector: string): Promise<void>;
    /**
     * Checks if an element is visible on the page.
     * @param selector - CSS selector to check
     * @returns True if element is visible, false otherwise
     */
    isVisible(selector: string): Promise<boolean>;
    /**
     * Waits for an element to be hidden or removed from the DOM.
     * @param selector - CSS selector of the element to wait for
     */
    waitForHidden(selector: string): Promise<void>;
    /**
     * Waits for a specified amount of time.
     * Use sparingly — prefer waiting for specific elements when possible.
     * @param ms - Milliseconds to wait
     */
    waitForTimeout(ms: number): Promise<void>;
    /**
     * Clicks an element and waits for navigation to complete.
     * @param selector - CSS selector of element to click
     */
    clickAndWaitForNavigation(selector: string): Promise<void>;
    /**
     * Checks if an element is disabled.
     * @param selector - CSS selector to check
     * @returns True if element is disabled, false otherwise
     */
    isDisabled(selector: string): Promise<boolean>;
    /**
     * Gets the value of an input field.
     * @param selector - CSS selector of input element
     * @returns Current value of the input
     */
    getInputValue(selector: string): Promise<string>;
    /**
     * Counts the number of elements matching a selector.
     * @param selector - CSS selector to count
     * @returns Number of matching elements
     */
    countElements(selector: string): Promise<number>;
    /**
     * Gets an attribute value from an element.
     * @param selector - CSS selector of element
     * @param attribute - Attribute name to get
     * @returns Attribute value or null if not found
     */
    getAttribute(selector: string, attribute: string): Promise<string | null>;
    /**
     * Gets the current page URL.
     * @returns Current URL as string
     */
    getCurrentUrl(): Promise<string>;
    /**
     * Navigates to the application's base URL.
     * Reads the target URL from the TEST_DOMAIN environment variable
     * (set by the runner from settings). Call this at the start of a
     * journey to load the app before interacting with it.
     */
    navigateToApp(): Promise<void>;
    /**
     * Navigates to a URL.
     * @param url - URL to navigate to
     */
    goto(url: string): Promise<void>;
    /**
     * Executes a JavaScript string expression in the page context.
     * @param script - JavaScript expression as a string
     * @returns Result of the expression evaluation
     */
    evaluate(script: string): Promise<any>;
    /**
     * Executes a JavaScript function in the page context.
     * @param script - JavaScript function to execute
     * @returns Result of the script execution
     */
    evaluate<T>(script: () => T): Promise<T>;
    /**
     * Clicks an element that triggers a file download and waits for the download to complete.
     * @param selector - CSS selector of the element that triggers the download
     * @returns The downloaded file's path and suggested filename
     */
    clickAndDownload(selector: string): Promise<DownloadResult>;
    /**
     * Removes all downloaded files from the download directory.
     * Safe to call when no downloads exist.
     */
    clearDownloads(): Promise<void>;
    /**
     * Clears all session data (cookies, localStorage, sessionStorage).
     * When an origin is provided, uses browser-level CDP APIs to clear storage
     * without requiring page context — safe to call on about:blank before navigation.
     * @param origin - Optional origin URL (e.g. 'http://localhost:3000') whose storage to clear
     */
    clearSession(origin?: string): Promise<void>;
}
//# sourceMappingURL=base.page.d.ts.map