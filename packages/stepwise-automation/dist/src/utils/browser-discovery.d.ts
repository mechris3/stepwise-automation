/**
 * Represents a discovered Chromium-based browser on the system.
 */
export interface DiscoveredBrowser {
    name: string;
    executablePath: string;
    userDataDir?: string;
}
/**
 * Auto-detect installed Chromium-based browsers at common OS paths.
 * Probes macOS, Windows, and Linux paths for Chrome, Brave, Edge, and Chromium.
 * Falls back to Puppeteer's bundled Chromium if no system browsers are found.
 *
 * @returns Array of discovered browsers, ordered by platform preference
 */
export declare function discoverBrowsers(): DiscoveredBrowser[];
//# sourceMappingURL=browser-discovery.d.ts.map