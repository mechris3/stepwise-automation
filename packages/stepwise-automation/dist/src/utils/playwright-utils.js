"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.clickWithAngularSupport = clickWithAngularSupport;
exports.fillWithAngularEvents = fillWithAngularEvents;
exports.waitForElement = waitForElement;
exports.getText = getText;
exports.scrollIntoViewAndClick = scrollIntoViewAndClick;
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * Clicks an element with Angular-aware event handling and strict mode handling.
 * Uses `.first()` to handle Playwright's strict mode when multiple elements match.
 * Waits for pointer-events !== 'none' before clicking.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the element to click
 */
async function clickWithAngularSupport(page, selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 });
    // waitForFunction callback runs in browser context
    await page.waitForFunction(`(function() {
      var el = document.querySelector('${selector.replace(/'/g, "\\'")}');
      return el && getComputedStyle(el).pointerEvents !== 'none';
    })()`, { timeout: 5000 });
    await page.locator(selector).first().click({ timeout: 10000 });
}
/**
 * Fills an input field with Angular reactive forms support.
 * Dispatches Angular events for form validation after filling.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the input element
 * @param value - Text value to enter
 */
async function fillWithAngularEvents(page, selector, value) {
    await page.locator(selector).fill(value, { timeout: 10000 });
    await page.locator(selector).dispatchEvent('input');
    await page.locator(selector).dispatchEvent('change');
}
/**
 * Waits for an element with standard Playwright timeout.
 * Uses `.first()` for strict mode handling.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector to wait for
 */
async function waitForElement(page, selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 });
}
/**
 * Gets text content from an element.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the element
 * @returns The element's text content, or empty string if null
 */
async function getText(page, selector) {
    return (await page.locator(selector).textContent()) || '';
}
/**
 * Scrolls element into view before clicking (for viewport issues).
 * Useful when elements are outside the visible viewport.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector of the element to scroll to and click
 */
async function scrollIntoViewAndClick(page, selector) {
    await waitForElement(page, selector);
    const escapedSelector = selector.replace(/'/g, "\\'");
    await page.evaluate(`(function() {
    var element = document.querySelector('${escapedSelector}');
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  })()`);
    await new Promise(resolve => setTimeout(resolve, 500));
    await clickWithAngularSupport(page, selector);
}
//# sourceMappingURL=playwright-utils.js.map