/**
 * Playwright-specific utility functions for Angular-aware browser automation.
 *
 * Handles Playwright's strict mode (using .first() for multiple matches),
 * scroll-into-view fallback, and DOM event dispatching for framework compatibility.
 *
 * Note: Uses `any` for Page type to avoid requiring playwright as a direct dependency.
 * The actual Playwright Page type is enforced at the adapter level.
 *
 * Functions passed to page.evaluate() and page.waitForFunction() execute in the
 * browser context where DOM globals (document, getComputedStyle, etc.) are available.
 */
/**
 * Clicks an element with Angular-aware event handling and strict mode handling.
 * Uses `.first()` to handle Playwright's strict mode when multiple elements match.
 * Waits for pointer-events !== 'none' before clicking.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the element to click
 */
export declare function clickWithAngularSupport(page: any, selector: string): Promise<void>;
/**
 * Fills an input field with Angular reactive forms support.
 * Dispatches Angular events for form validation after filling.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the input element
 * @param value - Text value to enter
 */
export declare function fillWithAngularEvents(page: any, selector: string, value: string): Promise<void>;
/**
 * Waits for an element with standard Playwright timeout.
 * Uses `.first()` for strict mode handling.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector to wait for
 */
export declare function waitForElement(page: any, selector: string): Promise<void>;
/**
 * Gets text content from an element.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the element
 * @returns The element's text content, or empty string if null
 */
export declare function getText(page: any, selector: string): Promise<string>;
/**
 * Scrolls element into view before clicking (for viewport issues).
 * Useful when elements are outside the visible viewport.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the element to scroll to and click
 */
export declare function scrollIntoViewAndClick(page: any, selector: string): Promise<void>;
//# sourceMappingURL=playwright-utils.d.ts.map