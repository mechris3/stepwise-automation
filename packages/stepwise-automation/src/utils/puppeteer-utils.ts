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

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

/**
 * Clicks an element with Angular-aware event handling.
 * Waits for element to be visible and clickable (pointer-events !== 'none').
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the element to click
 */
export async function clickWithAngularSupport(page: any, selector: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  // waitForFunction callback runs in browser context
  await page.waitForFunction(
    `(function() {
      var el = document.querySelector('${selector.replace(/'/g, "\\'")}');
      return el && getComputedStyle(el).pointerEvents !== 'none';
    })()`,
    { timeout: 5000 },
  );
  await page.click(selector);
}

/**
 * Fills an input field with Angular reactive forms support.
 * Dispatches both 'input' and 'change' events to trigger form validation.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the input element
 * @param value - Text value to set
 */
export async function fillWithAngularEvents(
  page: any,
  selector: string,
  value: string,
): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  // evaluate callback runs in browser context
  const escapedSelector = selector.replace(/'/g, "\\'");
  const escapedValue = value.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
  await page.evaluate(`(function() {
    var el = document.querySelector('${escapedSelector}');
    if (el) {
      el.value = '${escapedValue}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
}

/**
 * Waits for an element with standard Puppeteer timeout.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector to wait for
 */
export async function waitForElement(page: any, selector: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
}

/**
 * Selects an option from a dropdown by index with Angular support.
 * Dispatches 'change' event to trigger Angular form handling.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the `<select>` element
 * @param index - Zero-based index of the option to select
 */
export async function selectByIndex(
  page: any,
  selector: string,
  index: number,
): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  const escapedSelector = selector.replace(/'/g, "\\'");
  await page.evaluate(`(function() {
    var select = document.querySelector('${escapedSelector}');
    if (select && select.options.length > ${index}) {
      select.selectedIndex = ${index};
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
}

/**
 * Selects a `<select>` option by its value attribute.
 * Dispatches 'change' event to trigger framework form handling.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the `<select>` element
 * @param value - The `value` attribute of the option to select
 */
export async function selectByValue(
  page: any,
  selector: string,
  value: string,
): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  const escapedSelector = selector.replace(/'/g, "\\'");
  const escapedValue = value.replace(/'/g, "\\'");
  await page.evaluate(`(function() {
    var select = document.querySelector('${escapedSelector}');
    if (!select) throw new Error('Select element not found: ${escapedSelector}');
    select.value = '${escapedValue}';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

/**
 * Selects a `<select>` option by its visible text content.
 * Dispatches 'change' event to trigger framework form handling.
 *
 * @param page - Puppeteer Page instance
 * @param selector - CSS selector of the `<select>` element
 * @param text - Text to match against option labels
 * @param exact - If true, requires exact match; if false, matches options containing the text
 */
export async function selectByText(
  page: any,
  selector: string,
  text: string,
  exact: boolean,
): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  const escapedSelector = selector.replace(/'/g, "\\'");
  const escapedText = text.replace(/'/g, "\\'");
  await page.evaluate(`(function() {
    var select = document.querySelector('${escapedSelector}');
    if (!select) throw new Error('Select element not found: ${escapedSelector}');
    var options = Array.from(select.options);
    var match = ${exact}
      ? options.find(function(o) { return o.text.trim() === '${escapedText}'; })
      : options.find(function(o) { return o.text.trim().toLowerCase().indexOf('${escapedText}'.toLowerCase()) !== -1; });
    if (!match) throw new Error('No option ${exact ? 'matching' : 'containing'} "${escapedText}" in ${escapedSelector}');
    select.value = match.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}
