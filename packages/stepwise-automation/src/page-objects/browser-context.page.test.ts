import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserContextPage } from './browser-context.page';
import { BasePage } from './base.page';
import { BrowserAdapter } from '../adapters/browser-adapter.interface';

function createMockAdapter(): BrowserAdapter {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    getText: vi.fn().mockResolvedValue('hello'),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(true),
    waitForHidden: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    clickAndWaitForNavigation: vi.fn().mockResolvedValue(undefined),
    isDisabled: vi.fn().mockResolvedValue(false),
    getInputValue: vi.fn().mockResolvedValue('value'),
    countElements: vi.fn().mockResolvedValue(3),
    getAttribute: vi.fn().mockResolvedValue('attr-value'),
    getCurrentUrl: vi.fn().mockResolvedValue('http://localhost'),
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(42),
    readClipboard: vi.fn().mockResolvedValue('clipboard-text'),
    clearSession: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    selectByIndex: vi.fn().mockResolvedValue(undefined),
  };
}

describe('BrowserContextPage', () => {
  let adapter: BrowserAdapter;
  let page: BrowserContextPage;

  beforeEach(() => {
    adapter = createMockAdapter();
    page = new BrowserContextPage(adapter);
  });

  it('extends BasePage', () => {
    expect(page).toBeInstanceOf(BasePage);
  });

  it('delegates clearSession to adapter', async () => {
    await page.clearSession();
    expect(adapter.clearSession).toHaveBeenCalled();
  });

  it('delegates readClipboard to adapter', async () => {
    const result = await page.readClipboard();
    expect(adapter.readClipboard).toHaveBeenCalled();
    expect(result).toBe('clipboard-text');
  });

  it('delegates uploadFile to adapter', async () => {
    await page.uploadFile('#file-input', '/path/to/file.png');
    expect(adapter.uploadFile).toHaveBeenCalledWith('#file-input', '/path/to/file.png');
  });

  it('delegates selectByIndex to adapter', async () => {
    await page.selectByIndex('#dropdown', 2);
    expect(adapter.selectByIndex).toHaveBeenCalledWith('#dropdown', 2);
  });

  it('inherits BasePage methods', async () => {
    await page.click('.btn');
    expect(adapter.click).toHaveBeenCalledWith('.btn');
  });
});
