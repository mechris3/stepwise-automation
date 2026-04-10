import { BrowserAdapter } from '../adapters/browser-adapter.interface';
import type { DownloadResult } from '../adapters/browser-adapter.interface';
import { withErrorContext } from '../utils/page-object-error';

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
export class BasePage {
  constructor(protected adapter: BrowserAdapter) {}

  /**
   * Clicks an element on the page.
   * @param selector - CSS selector of element to click
   */
  @withErrorContext
  async click(selector: string): Promise<void> {
    await this.adapter.click(selector);
  }

  /**
   * Fills an input field with text.
   * @param selector - CSS selector of input element
   * @param value - Text to enter
   */
  @withErrorContext
  async fill(selector: string, value: string): Promise<void> {
    await this.adapter.fill(selector, value);
  }

  /**
   * Gets the text content of an element.
   * @param selector - CSS selector of element
   * @returns Text content of the element
   */
  @withErrorContext
  async getText(selector: string): Promise<string> {
    return this.adapter.getText(selector);
  }

  /**
   * Waits for an element to appear in the DOM.
   * @param selector - CSS selector to wait for
   */
  @withErrorContext
  async waitForSelector(selector: string): Promise<void> {
    await this.adapter.waitForSelector(selector);
  }

  /**
   * Checks if an element is visible on the page.
   * @param selector - CSS selector to check
   * @returns True if element is visible, false otherwise
   */
  @withErrorContext
  async isVisible(selector: string): Promise<boolean> {
    return this.adapter.isVisible(selector);
  }

  /**
   * Waits for an element to be hidden or removed from the DOM.
   * @param selector - CSS selector of the element to wait for
   */
  @withErrorContext
  async waitForHidden(selector: string): Promise<void> {
    await this.adapter.waitForHidden(selector);
  }

  /**
   * Waits for a specified amount of time.
   * Use sparingly — prefer waiting for specific elements when possible.
   * @param ms - Milliseconds to wait
   */
  @withErrorContext
  async waitForTimeout(ms: number): Promise<void> {
    await this.adapter.waitForTimeout(ms);
  }

  /**
   * Clicks an element and waits for navigation to complete.
   * @param selector - CSS selector of element to click
   */
  @withErrorContext
  async clickAndWaitForNavigation(selector: string): Promise<void> {
    await this.adapter.clickAndWaitForNavigation(selector);
  }

  /**
   * Checks if an element is disabled.
   * @param selector - CSS selector to check
   * @returns True if element is disabled, false otherwise
   */
  @withErrorContext
  async isDisabled(selector: string): Promise<boolean> {
    return this.adapter.isDisabled(selector);
  }

  /**
   * Gets the value of an input field.
   * @param selector - CSS selector of input element
   * @returns Current value of the input
   */
  @withErrorContext
  async getInputValue(selector: string): Promise<string> {
    return this.adapter.getInputValue(selector);
  }

  /**
   * Counts the number of elements matching a selector.
   * @param selector - CSS selector to count
   * @returns Number of matching elements
   */
  @withErrorContext
  async countElements(selector: string): Promise<number> {
    return this.adapter.countElements(selector);
  }

  /**
   * Gets an attribute value from an element.
   * @param selector - CSS selector of element
   * @param attribute - Attribute name to get
   * @returns Attribute value or null if not found
   */
  @withErrorContext
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return this.adapter.getAttribute(selector, attribute);
  }

  /**
   * Gets the current page URL.
   * @returns Current URL as string
   */
  @withErrorContext
  async getCurrentUrl(): Promise<string> {
    return this.adapter.getCurrentUrl();
  }

  /**
   * Navigates to the application's base URL.
   * Reads the target URL from the TEST_DOMAIN environment variable
   * (set by the runner from settings). Call this at the start of a
   * journey to load the app before interacting with it.
   */
  @withErrorContext
  async navigateToApp(): Promise<void> {
    const targetUrl = process.env.TEST_DOMAIN || '';
    if (!targetUrl) {
      throw new Error(
        'No target URL configured. Set targetUrl in the dashboard settings or pass TEST_DOMAIN env var.',
      );
    }
    await this.adapter.goto(targetUrl);
  }

  /**
   * Navigates to a URL.
   * @param url - URL to navigate to
   */
  @withErrorContext
  async goto(url: string): Promise<void> {
    await this.adapter.goto(url);
  }

  /**
   * Executes a JavaScript string expression in the page context.
   * @param script - JavaScript expression as a string
   * @returns Result of the expression evaluation
   */
  async evaluate(script: string): Promise<any>;
  /**
   * Executes a JavaScript function in the page context.
   * @param script - JavaScript function to execute
   * @returns Result of the script execution
   */
  async evaluate<T>(script: () => T): Promise<T>;
  @withErrorContext
  async evaluate(script: string | (() => any)): Promise<any> {
    return this.adapter.evaluate(script as any);
  }

  /**
   * Clicks an element that triggers a file download and waits for the download to complete.
   * @param selector - CSS selector of the element that triggers the download
   * @returns The downloaded file's path and suggested filename
   */
  @withErrorContext
  async clickAndDownload(selector: string): Promise<DownloadResult> {
    return this.adapter.clickAndDownload(selector);
  }

  /**
   * Removes all downloaded files from the download directory.
   * Safe to call when no downloads exist.
   */
  @withErrorContext
  async clearDownloads(): Promise<void> {
    await this.adapter.clearDownloads();
  }

  /**
   * Clears all session data (cookies, localStorage, sessionStorage).
   * When an origin is provided, uses browser-level CDP APIs to clear storage
   * without requiring page context — safe to call on about:blank before navigation.
   * @param origin - Optional origin URL (e.g. 'http://localhost:3000') whose storage to clear
   */
  @withErrorContext
  async clearSession(origin?: string): Promise<void> {
    await this.adapter.clearSession(origin);
  }
}
