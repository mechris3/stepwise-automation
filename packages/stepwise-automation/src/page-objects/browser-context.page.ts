import { BrowserAdapter } from '../adapters/browser-adapter.interface';
import { BasePage } from './base.page';

/**
 * Page object for browser context management operations.
 *
 * Extends BasePage with methods for browser-level concerns that go beyond
 * simple page element interaction: session management, clipboard access,
 * file uploads, and dropdown selection.
 *
 * @example
 * ```typescript
 * const browserContext = new BrowserContextPage(adapter);
 * await browserContext.clearSession();
 * const clipboardText = await browserContext.readClipboard();
 * await browserContext.uploadFile('#file-input', '/path/to/file.png');
 * await browserContext.selectByIndex('#dropdown', 2);
 * ```
 */
export class BrowserContextPage extends BasePage {
  constructor(adapter: BrowserAdapter) {
    super(adapter);
  }

  /**
   * Clears all session data (cookies, localStorage, sessionStorage).
   * When an origin is provided, uses browser-level CDP APIs to clear storage
   * without requiring page context — safe to call on about:blank before navigation.
   * @param origin - Optional origin URL (e.g. 'http://localhost:3000') whose storage to clear
   */
  async clearSession(origin?: string): Promise<void> {
    await this.adapter.clearSession(origin);
  }

  /**
   * Reads text from the system clipboard.
   * @returns Clipboard text content
   */
  async readClipboard(): Promise<string> {
    return this.adapter.readClipboard();
  }

  /**
   * Uploads a file to a file input element.
   * @param selector - CSS selector of file input element
   * @param filePath - Absolute path to the file to upload
   */
  async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.adapter.uploadFile(selector, filePath);
  }

  /**
   * Selects an option from a dropdown by index.
   * @param selector - CSS selector of select element
   * @param index - Index of option to select (0-based)
   */
  async selectByIndex(selector: string, index: number): Promise<void> {
    await this.adapter.selectByIndex(selector, index);
  }

  /**
   * Selects an option from a dropdown by its value attribute.
   * @param selector - CSS selector of select element
   * @param value - The `value` attribute of the option to select
   */
  async selectByValue(selector: string, value: string): Promise<void> {
    await this.adapter.selectByValue(selector, value);
  }

  /**
   * Selects an option from a dropdown by its visible text.
   * @param selector - CSS selector of select element
   * @param text - Text to match against option labels
   * @param exact - If true, requires exact match; if false (default), matches options containing the text
   */
  async selectByText(selector: string, text: string, exact?: boolean): Promise<void> {
    await this.adapter.selectByText(selector, text, exact);
  }
}
