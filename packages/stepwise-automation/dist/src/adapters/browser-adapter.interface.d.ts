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
/**
 * Result of a completed file download triggered by `clickAndDownload`.
 */
export interface DownloadResult {
    /** Absolute path to the downloaded file on disk */
    filePath: string;
    /** Filename suggested by the browser/server (Content-Disposition or URL-derived) */
    suggestedFilename: string;
}
export interface BrowserAdapter {
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
     * Clicks an element and waits for navigation to complete.
     * @param selector - CSS selector of element to click
     */
    clickAndWaitForNavigation(selector: string): Promise<void>;
    /**
     * Waits for a specified amount of time.
     * @param ms - Milliseconds to wait
     */
    waitForTimeout(ms: number): Promise<void>;
    /**
     * Checks if an element is disabled.
     * @param selector - CSS selector to check
     * @returns True if element is disabled, false otherwise
     */
    isDisabled(selector: string): Promise<boolean>;
    /**
     * Gets the text content of an element.
     * @param selector - CSS selector of element
     * @returns Text content of the element
     */
    getText(selector: string): Promise<string>;
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
     * Reads text from the system clipboard.
     * @returns Clipboard text content
     */
    readClipboard(): Promise<string>;
    /**
     * Gets the current page URL.
     * @returns Current URL as string
     */
    getCurrentUrl(): Promise<string>;
    /**
     * Waits for an element to be hidden or removed from DOM.
     * @param selector - CSS selector to wait for
     */
    waitForHidden(selector: string): Promise<void>;
    /**
     * Gets an attribute value from an element.
     * @param selector - CSS selector of element
     * @param attribute - Attribute name to get
     * @returns Attribute value or null if not found
     */
    getAttribute(selector: string, attribute: string): Promise<string | null>;
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
     * Navigates to a URL.
     * @param url - URL to navigate to
     */
    goto(url: string): Promise<void>;
    /**
     * Clears all cookies, cache, localStorage, sessionStorage, and indexedDB.
     * Always clears cookies and cache browser-wide. Uses CDP Storage.clearDataForOrigin
     * to clear origin-specific storage (localStorage, sessionStorage, indexedDB).
     * When an origin is provided, clears storage for that origin — safe to call on about:blank.
     * When no origin is provided, derives the origin from the current page URL.
     * On about:blank with no origin, cookies/cache are still cleared but storage clearing is skipped.
     * @param origin - Optional origin URL (e.g. 'http://localhost:3000') whose storage to clear
     */
    clearSession(origin?: string): Promise<void>;
    /**
     * Uploads a file to a file input element.
     * @param selector - CSS selector of file input element
     * @param filePath - Absolute path to the file to upload
     */
    uploadFile(selector: string, filePath: string): Promise<void>;
    /**
     * Selects an option from a dropdown by index.
     * @param selector - CSS selector of select element
     * @param index - Index of option to select (0-based)
     */
    selectByIndex(selector: string, index: number): Promise<void>;
    /**
     * Selects an option from a dropdown by its value attribute.
     * @param selector - CSS selector of select element
     * @param value - The `value` attribute of the option to select
     */
    selectByValue(selector: string, value: string): Promise<void>;
    /**
     * Selects an option from a dropdown by its visible text.
     * @param selector - CSS selector of select element
     * @param text - Text to match against option labels
     * @param exact - If true, requires an exact match; if false (default), matches options that contain the text
     */
    selectByText(selector: string, text: string, exact?: boolean): Promise<void>;
    /**
     * Clicks an element that triggers a file download and waits for the download to complete.
     * Returns the file path and suggested filename.
     * @param selector - CSS selector of the element that triggers the download
     * @returns The downloaded file's path and suggested filename
     */
    clickAndDownload(selector: string): Promise<DownloadResult>;
    /**
     * Removes all downloaded files from the download directory.
     * Safe to call when no downloads exist.
     */
    clearDownloads(): Promise<void>;
}
//# sourceMappingURL=browser-adapter.interface.d.ts.map