import { BaseAdapter } from './base-adapter';
import type { DownloadResult } from './browser-adapter.interface';
/**
 * Puppeteer implementation of the BrowserAdapter interface.
 *
 * Uses Puppeteer-specific utilities for Angular/React/Vue compatibility
 * via DOM event dispatching. Each action is wrapped with logAndCheckAction()
 * (before) and logActionComplete() + addSlowModeDelay() (after) for
 * breakpoint, pause/resume, and slow-mode support.
 *
 * Puppeteer is an optional peer dependency — the Page type is used as `any`
 * to avoid requiring puppeteer as a direct dependency at compile time.
 * The consuming project must have puppeteer installed at runtime.
 */
export declare class PuppeteerAdapter extends BaseAdapter {
    private page;
    /**
     * @param page - A Puppeteer `Page` instance (typed as `any` to avoid peer dep at compile time)
     */
    constructor(page: any);
    click(selector: string): Promise<void>;
    fill(selector: string, value: string): Promise<void>;
    waitForSelector(selector: string): Promise<void>;
    isVisible(selector: string): Promise<boolean>;
    clickAndWaitForNavigation(selector: string): Promise<void>;
    waitForTimeout(ms: number): Promise<void>;
    isDisabled(selector: string): Promise<boolean>;
    getText(selector: string): Promise<string>;
    getInputValue(selector: string): Promise<string>;
    countElements(selector: string): Promise<number>;
    readClipboard(): Promise<string>;
    getCurrentUrl(): Promise<string>;
    waitForHidden(selector: string): Promise<void>;
    getAttribute(selector: string, attribute: string): Promise<string | null>;
    evaluate(script: string): Promise<any>;
    evaluate<T>(script: () => T): Promise<T>;
    goto(url: string): Promise<void>;
    clearSession(origin?: string): Promise<void>;
    uploadFile(selector: string, filePath: string): Promise<void>;
    selectByIndex(selector: string, index: number): Promise<void>;
    selectByValue(selector: string, value: string): Promise<void>;
    selectByText(selector: string, text: string, exact?: boolean): Promise<void>;
    clickAndDownload(selector: string): Promise<DownloadResult>;
    clearDownloads(): Promise<void>;
}
//# sourceMappingURL=puppeteer-adapter.d.ts.map