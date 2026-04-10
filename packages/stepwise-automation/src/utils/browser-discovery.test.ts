import { describe, it, expect } from 'vitest';
import { discoverBrowsers, DiscoveredBrowser } from './browser-discovery';

describe('discoverBrowsers', () => {
  it('returns an array', () => {
    const result = discoverBrowsers();
    expect(Array.isArray(result)).toBe(true);
  });

  it('each entry has name and executablePath', () => {
    const result = discoverBrowsers();
    for (const browser of result) {
      expect(browser).toHaveProperty('name');
      expect(browser).toHaveProperty('executablePath');
      expect(typeof browser.name).toBe('string');
      expect(typeof browser.executablePath).toBe('string');
    }
  });
});
