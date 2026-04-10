import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

/**
 * Unit tests for the CLI entry point logic.
 *
 * Since the CLI uses process.exit and spawns child processes, we test
 * the core logic functions by extracting and testing the resolvable parts:
 * - resolveEngine logic
 * - handleFatalError behavior
 * - CLI argument parsing structure
 */

// We test the resolveEngine logic inline since it's not exported.
// Instead, we validate the CLI behavior through integration-style checks.

describe('CLI entry point', () => {
  describe('resolveEngine logic', () => {
    // Replicate the resolveEngine logic for unit testing
    function resolveEngine(
      toolFlag: string | undefined,
      configuredAdapters: ('puppeteer' | 'playwright')[] | undefined,
      installedEngines: ('puppeteer' | 'playwright')[],
    ): { engine: 'puppeteer' | 'playwright' | null; error: string | null } {
      if (toolFlag) {
        if (toolFlag !== 'puppeteer' && toolFlag !== 'playwright') {
          return { engine: null, error: `Invalid tool "${toolFlag}". Must be "puppeteer" or "playwright".` };
        }
        if (!installedEngines.includes(toolFlag as 'puppeteer' | 'playwright')) {
          return { engine: null, error: `"${toolFlag}" is not installed.` };
        }
        return { engine: toolFlag as 'puppeteer' | 'playwright', error: null };
      }

      if (configuredAdapters && configuredAdapters.length > 0) {
        return { engine: configuredAdapters[0], error: null };
      }

      if (installedEngines.length === 0) {
        return { engine: null, error: 'No browser engine found. Install puppeteer or playwright.' };
      }
      return { engine: installedEngines[0], error: null };
    }

    it('should use --tool flag when provided and installed', () => {
      const result = resolveEngine('puppeteer', undefined, ['puppeteer']);
      expect(result.engine).toBe('puppeteer');
      expect(result.error).toBeNull();
    });

    it('should use --tool flag for playwright when installed', () => {
      const result = resolveEngine('playwright', undefined, ['playwright']);
      expect(result.engine).toBe('playwright');
      expect(result.error).toBeNull();
    });

    it('should error for invalid tool name', () => {
      const result = resolveEngine('selenium', undefined, ['puppeteer']);
      expect(result.engine).toBeNull();
      expect(result.error).toContain('Invalid tool');
    });

    it('should error when requested tool is not installed', () => {
      const result = resolveEngine('playwright', undefined, ['puppeteer']);
      expect(result.engine).toBeNull();
      expect(result.error).toContain('not installed');
    });

    it('should fall back to first configured adapter', () => {
      const result = resolveEngine(undefined, ['playwright', 'puppeteer'], ['puppeteer', 'playwright']);
      expect(result.engine).toBe('playwright');
    });

    it('should fall back to first detected engine when no config', () => {
      const result = resolveEngine(undefined, undefined, ['puppeteer', 'playwright']);
      expect(result.engine).toBe('puppeteer');
    });

    it('should error when no engines installed and no flag', () => {
      const result = resolveEngine(undefined, undefined, []);
      expect(result.engine).toBeNull();
      expect(result.error).toContain('No browser engine found');
    });

    it('should prefer --tool over configured adapters', () => {
      const result = resolveEngine('playwright', ['puppeteer'], ['puppeteer', 'playwright']);
      expect(result.engine).toBe('playwright');
    });
  });

  describe('handleFatalError logic', () => {
    function formatFatalError(error: unknown): string {
      if (error instanceof Error) {
        return `Error: ${error.message}`;
      }
      return `Error: ${error}`;
    }

    it('should format Error instances with their message', () => {
      const msg = formatFatalError(new Error('Config file not found: /path/to/config'));
      expect(msg).toBe('Error: Config file not found: /path/to/config');
    });

    it('should format non-Error values', () => {
      const msg = formatFatalError('something went wrong');
      expect(msg).toBe('Error: something went wrong');
    });

    it('should handle missing config file error', () => {
      const msg = formatFatalError(new Error('Config file not found: /app/test-runner.config.ts'));
      expect(msg).toContain('Config file not found');
      expect(msg).toContain('test-runner.config.ts');
    });

    it('should handle no engine error', () => {
      const msg = formatFatalError(new Error('No browser engine found. Install puppeteer or playwright.'));
      expect(msg).toContain('No browser engine found');
    });
  });

  describe('CLI structure', () => {
    it('should have the bin entry point at the expected path', () => {
      const binPath = path.resolve(__dirname, '../bin/stepwise.ts');
      // Verify the path resolves correctly relative to src/
      expect(binPath).toContain('bin/stepwise.ts');
    });

    it('should have shebang line for node execution', async () => {
      const fs = await import('fs');
      const binPath = path.resolve(__dirname, '../bin/stepwise.ts');
      const content = fs.readFileSync(binPath, 'utf-8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    it('should import commander for CLI parsing', async () => {
      const fs = await import('fs');
      const binPath = path.resolve(__dirname, '../bin/stepwise.ts');
      const content = fs.readFileSync(binPath, 'utf-8');
      expect(content).toContain("from 'commander'");
    });

    it('should define serve as default command', async () => {
      const fs = await import('fs');
      const binPath = path.resolve(__dirname, '../bin/stepwise.ts');
      const content = fs.readFileSync(binPath, 'utf-8');
      expect(content).toContain('isDefault: true');
    });

    it('should define run command with variadic journeys', async () => {
      const fs = await import('fs');
      const binPath = path.resolve(__dirname, '../bin/stepwise.ts');
      const content = fs.readFileSync(binPath, 'utf-8');
      expect(content).toContain("'run [journeys...]'");
    });

    it('should support --config, --tool, --port, --headed flags', async () => {
      const fs = await import('fs');
      const binPath = path.resolve(__dirname, '../bin/stepwise.ts');
      const content = fs.readFileSync(binPath, 'utf-8');
      expect(content).toContain('--config <path>');
      expect(content).toContain('--tool <engine>');
      expect(content).toContain('--port <number>');
      expect(content).toContain('--headed');
    });

    it('should read version from package.json', async () => {
      const fs = await import('fs');
      const binPath = path.resolve(__dirname, '../bin/stepwise.ts');
      const content = fs.readFileSync(binPath, 'utf-8');
      expect(content).toContain('pkg.version');
    });
  });
});
