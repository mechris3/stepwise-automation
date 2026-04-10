/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import * as fs from 'fs';
import * as path from 'path';
import { BaseAdapter } from './base-adapter';
import type { DownloadResult } from './browser-adapter.interface';
import {
  clickWithAngularSupport,
  fillWithAngularEvents,
  waitForElement,
  getText as getTextUtil,
  scrollIntoViewAndClick,
} from '../utils/playwright-utils';

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
export class PlaywrightAdapter extends BaseAdapter {
  private page: any;

  /**
   * @param page - A Playwright `Page` instance (typed as `any` to avoid peer dep at compile time)
   */
  constructor(page: any) {
    super();
    this.page = page;
  }

  async click(selector: string): Promise<void> {
    await this.logAndCheckAction(`Click: ${selector}`);
    try {
      await clickWithAngularSupport(this.page, selector);
    } catch (error: any) {
      // If normal click fails due to viewport issues, try scroll-aware click
      if (error.message?.includes('outside of the viewport')) {
        await scrollIntoViewAndClick(this.page, selector);
      } else {
        throw error;
      }
    }
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.logAndCheckAction(`Fill: ${selector}`);
    await fillWithAngularEvents(this.page, selector, value);
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async waitForSelector(selector: string): Promise<void> {
    await this.logAndCheckAction(`Wait for: ${selector}`);
    await waitForElement(this.page, selector);
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async getText(selector: string): Promise<string> {
    await this.logAndCheckAction(`Get text: ${selector}`);
    const text = await getTextUtil(this.page, selector);
    this.logActionComplete();
    await this.addSlowModeDelay();
    return text;
  }

  async isVisible(selector: string): Promise<boolean> {
    await this.logAndCheckAction(`Check visible: ${selector}`);
    const visible = await this.page.locator(selector).first().isVisible();
    this.logActionComplete();
    await this.addSlowModeDelay();
    return visible;
  }

  async clickAndWaitForNavigation(selector: string): Promise<void> {
    await this.logAndCheckAction(`Click and navigate: ${selector}`);
    await this.page.locator(selector).click({ timeout: 10000 });
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.logAndCheckAction(`Wait: ${ms}ms`);
    await new Promise(resolve => setTimeout(resolve, ms));
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async isDisabled(selector: string): Promise<boolean> {
    await this.logAndCheckAction(`Check disabled: ${selector}`);
    const disabled = await this.page.locator(selector).isDisabled();
    this.logActionComplete();
    await this.addSlowModeDelay();
    return disabled;
  }

  async getInputValue(selector: string): Promise<string> {
    await this.logAndCheckAction(`Get input value: ${selector}`);
    const value = await this.page.locator(selector).inputValue();
    this.logActionComplete();
    await this.addSlowModeDelay();
    return value;
  }

  async countElements(selector: string): Promise<number> {
    await this.logAndCheckAction(`Count elements: ${selector}`);
    const count = await this.page.locator(selector).count();
    this.logActionComplete();
    await this.addSlowModeDelay();
    return count;
  }

  async readClipboard(): Promise<string> {
    await this.logAndCheckAction('Read clipboard');
    // Use string form to avoid TS error — navigator.clipboard is a browser-context API
    const text = await this.page.evaluate('navigator.clipboard.readText()');
    this.logActionComplete();
    await this.addSlowModeDelay();
    return text;
  }

  async getCurrentUrl(): Promise<string> {
    await this.logAndCheckAction('Get current URL');
    const url = this.page.url();
    this.logActionComplete();
    await this.addSlowModeDelay();
    return url;
  }

  async waitForHidden(selector: string): Promise<void> {
    await this.logAndCheckAction(`Wait for hidden: ${selector}`);
    await this.page.locator(selector).first().waitFor({ state: 'hidden', timeout: 10000 });
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    await this.logAndCheckAction(`Get attribute "${attribute}": ${selector}`);
    const value = await this.page.locator(selector).getAttribute(attribute);
    this.logActionComplete();
    await this.addSlowModeDelay();
    return value;
  }

  async evaluate(script: string): Promise<any>;
  async evaluate<T>(script: () => T): Promise<T>;
  async evaluate(script: string | (() => any)): Promise<any> {
    await this.logAndCheckAction('Evaluate script');
    const result = await this.page.evaluate(script);
    this.logActionComplete();
    await this.addSlowModeDelay();
    return result;
  }

  async goto(url: string): Promise<void> {
    const resolved = this.resolveUrl(url);
    await this.logAndCheckAction(`Navigate to: ${resolved}`);
    await this.page.goto(resolved, { waitUntil: 'networkidle' });
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async clearSession(origin?: string): Promise<void> {
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

  async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.logAndCheckAction(`Upload file: ${selector}`);
    await this.page.locator(selector).setInputFiles(filePath);
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async selectByIndex(selector: string, index: number): Promise<void> {
    await this.logAndCheckAction(`Select by index ${index}: ${selector}`);
    await this.page.locator(selector).selectOption({ index });
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async selectByValue(selector: string, value: string): Promise<void> {
    await this.logAndCheckAction(`Select by value "${value}": ${selector}`);
    await this.page.locator(selector).selectOption({ value });
    this.logActionComplete();
    await this.addSlowModeDelay();
  }

  async selectByText(selector: string, text: string, exact: boolean = false): Promise<void> {
    await this.logAndCheckAction(`Select by text "${text}"${exact ? ' (exact)' : ''}: ${selector}`);
    if (exact) {
      await this.page.locator(selector).selectOption({ label: text });
    } else {
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

  async clickAndDownload(selector: string): Promise<DownloadResult> {
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

  async clearDownloads(): Promise<void> {
    await this.logAndCheckAction('Clear downloads');
    const downloadDir = BaseAdapter.downloadDir;

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
