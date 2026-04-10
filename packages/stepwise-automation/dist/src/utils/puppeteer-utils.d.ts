/**
 * Puppeteer-specific utility functions for Angular-aware browser automation.
 *
 * These helpers dispatch standard DOM events (input, change) to ensure
 * compatibility with Angular reactive forms, React, and Vue.
 *
 * Note: Uses `any` for Page type to avoid requiring puppeteer as a direct dependency.
 * The actual Puppeteer Page type is enforced at the adapter level.
 *
 * Functions passed to page.evaluate() and page.waitForFunction() execute in the
 * browser context where DOM globals (document, getComputedStyle, etc.) are available.
 */
/**
 * Clicks an element with Angular-aware event handling.
 * Waits for element to be visible and clickable (pointer-events !== 'none').
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the element to click
 */
export declare function clickWithAngularSupport(page: any, selector: string): Promise<void>;
/**
 * Fills an input field with Angular reactive forms support.
 * Dispatches both 'input' and 'change' events to trigger form validation.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the input element
 * @param value - Text value to set
 */
export declare function fillWithAngularEvents(page: any, selector: string, value: string): Promise<void>;
/**
 * Waits for an element with standard Puppeteer timeout.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector to wait for
 */
export declare function waitForElement(page: any, selector: string): Promise<void>;
/**
 * Selects an option from a dropdown by index with Angular support.
 * Dispatches 'change' event to trigger Angular form handling.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the `<select>` element
 * @param index - Zero-based index of the option to select
 */
export declare function selectByIndex(page: any, selector: string, index: number): Promise<void>;
/**
 * Selects a `<select>` option by its value attribute.
 * Dispatches 'change' event to trigger framework form handling.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the `<select>` element
 * @param value - The `value` attribute of the option to select
 */
export declare function selectByValue(page: any, selector: string, value: string): Promise<void>;
/**
 * Selects a `<select>` option by its visible text content.
 * Dispatches 'change' event to trigger framework form handling.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the `<select>` element
 * @param text - Text to match against option labels
 * @param exact - If true, requires exact match; if false, matches options containing the text
 */
export declare function selectByText(page: any, selector: string, text: string, exact: boolean): Promise<void>;
//# sourceMappingURL=puppeteer-utils.d.ts.map