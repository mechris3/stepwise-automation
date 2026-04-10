import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { defineConfig, detectEngines, loadConfig, StepwiseConfig } from './config';

const mockEngines = (engines: ('puppeteer' | 'playwright')[]) => () => engines;

describe('defineConfig', () => {
  it('returns the config object unchanged', () => {
    const config: StepwiseConfig = {
      journeys: './journeys/**/*.journey.ts',
    };
    expect(defineConfig(config)).toBe(config);
  });

  it('preserves all optional fields', () => {
    const config: StepwiseConfig = {
      journeys: './tests/**/*.journey.ts',
      browser: {
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
        profileDir: 'TestProfile',
      },
      adapters: ['puppeteer'],
      server: { port: 5000 },
      testData: { beforeEach: './cleanup.ts' },
      devtools: { redux: true },
    };
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it('accepts empty config', () => {
    const config: StepwiseConfig = {};
    expect(defineConfig(config)).toBe(config);
  });
});

describe('detectEngines', () => {
  it('returns an array', () => {
    const engines = detectEngines();
    expect(Array.isArray(engines)).toBe(true);
  });

  it('never throws', () => {
    expect(() => detectEngines()).not.toThrow();
  });

  it('only contains valid engine names', () => {
    const engines = detectEngines();
    for (const engine of engines) {
      expect(['puppeteer', 'playwright']).toContain(engine);
    }
  });

  it('returns engines in deterministic order (puppeteer before playwright)', () => {
    const engines = detectEngines();
    if (engines.includes('puppeteer') && engines.includes('playwright')) {
      expect(engines.indexOf('puppeteer')).toBeLessThan(engines.indexOf('playwright'));
    }
  });
});

describe('loadConfig', () => {
  const fixturesDir = path.join(__dirname, '__test_fixtures__');
  const cleanupFilePath = path.join(fixturesDir, 'cleanup.ts');

  beforeEach(() => {
    fs.mkdirSync(fixturesDir, { recursive: true });
    fs.writeFileSync(cleanupFilePath, 'export default function cleanup() {}');
  });

  afterEach(() => {
    fs.rmSync(fixturesDir, { recursive: true, force: true });
  });

  function writeConfig(obj: Record<string, unknown>): string {
    const filePath = path.join(fixturesDir, `config-${Date.now()}-${Math.random().toString(36).slice(2)}.js`);
    fs.writeFileSync(filePath, `module.exports = ${JSON.stringify(obj)};`);
    return filePath;
  }

  const withPuppeteer = mockEngines(['puppeteer']);
  const withBoth = mockEngines(['puppeteer', 'playwright']);
  const withNone = mockEngines([]);

  // --- Explicit path: must exist ---
  it('throws when explicit config path not found', async () => {
    await expect(loadConfig('/nonexistent/path/config.ts', withPuppeteer))
      .rejects.toThrow('Config file not found');
  });

  // --- journeys: optional with convention default ---
  it('defaults journeys to convention pattern when not provided', async () => {
    const p = writeConfig({});
    const config = await loadConfig(p, withPuppeteer);
    expect(config.journeys).toBe(path.resolve(fixturesDir, './journeys/**/*.journey.ts'));
  });

  it('throws when journeys is empty string', async () => {
    const p = writeConfig({ journeys: '' });
    await expect(loadConfig(p, withPuppeteer)).rejects.toThrow('journeys must be a non-empty string');
  });

  it('throws when journeys is whitespace only', async () => {
    const p = writeConfig({ journeys: '   ' });
    await expect(loadConfig(p, withPuppeteer)).rejects.toThrow('journeys must be a non-empty string');
  });

  // --- Zero-config: empty config file works ---
  it('works with empty config object', async () => {
    const p = writeConfig({});
    const config = await loadConfig(p, withPuppeteer);
    expect(config.journeys).toBe(path.resolve(fixturesDir, './journeys/**/*.journey.ts'));
    expect(config.adapters).toEqual(['puppeteer']);
    expect(config.browser?.defaultViewport).toEqual({ width: 1280, height: 720 });
    expect(config.server?.port).toBe(3001);
  });

  // --- Defaults ---
  it('merges default viewport 1280x720', async () => {
    const p = writeConfig({ journeys: './j/**/*.journey.ts' });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.browser?.defaultViewport).toEqual({ width: 1280, height: 720 });
  });

  it('merges default headless false', async () => {
    const p = writeConfig({ journeys: './j/**/*.journey.ts' });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.browser?.headless).toBe(false);
  });

  it('merges default profileDir "Default"', async () => {
    const p = writeConfig({ journeys: './j/**/*.journey.ts' });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.browser?.profileDir).toBe('Default');
  });

  it('merges default port 3001', async () => {
    const p = writeConfig({ journeys: './j/**/*.journey.ts' });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.server?.port).toBe(3001);
  });

  // --- Explicit overrides preserved ---
  it('preserves explicit browser config values', async () => {
    const p = writeConfig({
      journeys: './j/**/*.journey.ts',
      browser: { headless: true, defaultViewport: { width: 1920, height: 1080 }, profileDir: 'TestProfile' },
    });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.browser?.headless).toBe(true);
    expect(config.browser?.defaultViewport).toEqual({ width: 1920, height: 1080 });
    expect(config.browser?.profileDir).toBe('TestProfile');
  });

  it('preserves explicit server port', async () => {
    const p = writeConfig({
      journeys: './j/**/*.journey.ts',
      server: { port: 5000 },
    });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.server?.port).toBe(5000);
  });

  // --- Path resolution ---
  it('resolves relative journeys path relative to config dir', async () => {
    const p = writeConfig({ journeys: './journeys/**/*.journey.ts' });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.journeys).toBe(path.resolve(fixturesDir, './journeys/**/*.journey.ts'));
    expect(path.isAbsolute(config.journeys!)).toBe(true);
  });

  it('resolves relative hook paths relative to config dir', async () => {
    const p = writeConfig({
      journeys: './j/**/*.journey.ts',
      testData: { beforeEach: './cleanup.ts' },
    });
    const config = await loadConfig(p, withPuppeteer);
    expect(config.testData?.beforeEach).toBe(path.resolve(fixturesDir, './cleanup.ts'));
    expect(path.isAbsolute(config.testData!.beforeEach!)).toBe(true);
  });

  it('throws when hook file does not exist', async () => {
    const p = writeConfig({
      journeys: './j/**/*.journey.ts',
      testData: { globalSetup: './nonexistent.ts' },
    });
    await expect(loadConfig(p, withPuppeteer)).rejects.toThrow('testData.globalSetup file not found');
  });

  // --- Adapter detection ---
  it('filters adapters against installed engines', async () => {
    const p = writeConfig({
      journeys: './j/**/*.journey.ts',
      adapters: ['puppeteer', 'playwright'],
    });
    const config = await loadConfig(p, withBoth);
    expect(config.adapters).toEqual(['puppeteer', 'playwright']);
  });

  it('filters out non-installed adapters', async () => {
    const p = writeConfig({
      journeys: './j/**/*.journey.ts',
      adapters: ['puppeteer', 'playwright'],
    });
    const config = await loadConfig(p, mockEngines(['puppeteer']));
    expect(config.adapters).toEqual(['puppeteer']);
  });

  it('defaults adapters to all installed engines when not specified', async () => {
    const p = writeConfig({ journeys: './j/**/*.journey.ts' });
    const config = await loadConfig(p, withBoth);
    expect(config.adapters).toEqual(['puppeteer', 'playwright']);
  });

  it('throws when no engines are installed', async () => {
    const p = writeConfig({ journeys: './j/**/*.journey.ts' });
    await expect(loadConfig(p, withNone))
      .rejects.toThrow('No browser engine found. Install puppeteer or playwright.');
  });

  it('throws when configured adapters are not installed', async () => {
    const p = writeConfig({
      journeys: './j/**/*.journey.ts',
      adapters: ['playwright'],
    });
    await expect(loadConfig(p, mockEngines(['puppeteer'])))
      .rejects.toThrow('Configured adapters');
  });
});
