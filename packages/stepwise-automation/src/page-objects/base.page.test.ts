import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    readClipboard: vi.fn().mockResolvedValue(''),
    clearSession: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    selectByIndex: vi.fn().mockResolvedValue(undefined),
  };
}

describe('BasePage', () => {
  let adapter: BrowserAdapter;
  let page: BasePage;

  beforeEach(() => {
    adapter = createMockAdapter();
    page = new BasePage(adapter);
  });

  it('delegates click to adapter', async () => {
    await page.click('.btn');
    expect(adapter.click).toHaveBeenCalledWith('.btn');
  });

  it('delegates fill to adapter', async () => {
    await page.fill('#input', 'text');
    expect(adapter.fill).toHaveBeenCalledWith('#input', 'text');
  });

  it('delegates getText to adapter', async () => {
    const result = await page.getText('.label');
    expect(adapter.getText).toHaveBeenCalledWith('.label');
    expect(result).toBe('hello');
  });

  it('delegates waitForSelector to adapter', async () => {
    await page.waitForSelector('.el');
    expect(adapter.waitForSelector).toHaveBeenCalledWith('.el');
  });

  it('delegates isVisible to adapter', async () => {
    const result = await page.isVisible('.el');
    expect(adapter.isVisible).toHaveBeenCalledWith('.el');
    expect(result).toBe(true);
  });

  it('delegates waitForHidden to adapter', async () => {
    await page.waitForHidden('.el');
    expect(adapter.waitForHidden).toHaveBeenCalledWith('.el');
  });

  it('delegates waitForTimeout to adapter', async () => {
    await page.waitForTimeout(500);
    expect(adapter.waitForTimeout).toHaveBeenCalledWith(500);
  });

  it('delegates clickAndWaitForNavigation to adapter', async () => {
    await page.clickAndWaitForNavigation('.link');
    expect(adapter.clickAndWaitForNavigation).toHaveBeenCalledWith('.link');
  });

  it('delegates isDisabled to adapter', async () => {
    const result = await page.isDisabled('.btn');
    expect(adapter.isDisabled).toHaveBeenCalledWith('.btn');
    expect(result).toBe(false);
  });

  it('delegates getInputValue to adapter', async () => {
    const result = await page.getInputValue('#input');
    expect(adapter.getInputValue).toHaveBeenCalledWith('#input');
    expect(result).toBe('value');
  });

  it('delegates countElements to adapter', async () => {
    const result = await page.countElements('.item');
    expect(adapter.countElements).toHaveBeenCalledWith('.item');
    expect(result).toBe(3);
  });

  it('delegates getAttribute to adapter', async () => {
    const result = await page.getAttribute('.el', 'href');
    expect(adapter.getAttribute).toHaveBeenCalledWith('.el', 'href');
    expect(result).toBe('attr-value');
  });

  it('delegates getCurrentUrl to adapter', async () => {
    const result = await page.getCurrentUrl();
    expect(adapter.getCurrentUrl).toHaveBeenCalled();
    expect(result).toBe('http://localhost');
  });

  it('delegates goto to adapter', async () => {
    await page.goto('http://example.com');
    expect(adapter.goto).toHaveBeenCalledWith('http://example.com');
  });

  it('delegates evaluate to adapter', async () => {
    const fn = () => 42;
    const result = await page.evaluate(fn);
    expect(adapter.evaluate).toHaveBeenCalledWith(fn);
    expect(result).toBe(42);
  });

  it('exposes adapter as protected property for subclasses', () => {
    class TestPage extends BasePage {
      getAdapter() {
        return this.adapter;
      }
    }
    const testPage = new TestPage(adapter);
    expect(testPage.getAdapter()).toBe(adapter);
  });
});
