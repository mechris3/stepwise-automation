import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { cleanupCrashState, closeExtraTabs } from './browser';

describe('cleanupCrashState', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should fix Crashed exit_type to Normal in Preferences', () => {
    const profileDir = 'Default';
    const profilePath = path.join(tmpDir, profileDir);
    fs.mkdirSync(profilePath, { recursive: true });

    const prefs = { profile: { exit_type: 'Crashed', name: 'TestProfile' } };
    fs.writeFileSync(path.join(profilePath, 'Preferences'), JSON.stringify(prefs));

    cleanupCrashState(tmpDir, profileDir);

    const updated = JSON.parse(fs.readFileSync(path.join(profilePath, 'Preferences'), 'utf-8'));
    expect(updated.profile.exit_type).toBe('Normal');
    expect(updated.profile.name).toBe('TestProfile');
  });

  it('should not modify Preferences when exit_type is not Crashed', () => {
    const profileDir = 'Default';
    const profilePath = path.join(tmpDir, profileDir);
    fs.mkdirSync(profilePath, { recursive: true });

    const prefs = { profile: { exit_type: 'Normal' } };
    fs.writeFileSync(path.join(profilePath, 'Preferences'), JSON.stringify(prefs));

    cleanupCrashState(tmpDir, profileDir);

    const updated = JSON.parse(fs.readFileSync(path.join(profilePath, 'Preferences'), 'utf-8'));
    expect(updated.profile.exit_type).toBe('Normal');
  });

  it('should remove Sessions directory', () => {
    const profileDir = 'Default';
    const profilePath = path.join(tmpDir, profileDir);
    const sessionsPath = path.join(profilePath, 'Sessions');
    fs.mkdirSync(sessionsPath, { recursive: true });
    fs.writeFileSync(path.join(sessionsPath, 'Tabs_123'), 'data');

    cleanupCrashState(tmpDir, profileDir);

    expect(fs.existsSync(sessionsPath)).toBe(false);
  });

  it('should handle missing Preferences file gracefully', () => {
    const profileDir = 'Default';
    const profilePath = path.join(tmpDir, profileDir);
    fs.mkdirSync(profilePath, { recursive: true });

    // Should not throw
    expect(() => cleanupCrashState(tmpDir, profileDir)).not.toThrow();
  });

  it('should handle missing profile directory gracefully', () => {
    expect(() => cleanupCrashState(tmpDir, 'NonExistent')).not.toThrow();
  });

  it('should handle malformed Preferences JSON gracefully', () => {
    const profileDir = 'Default';
    const profilePath = path.join(tmpDir, profileDir);
    fs.mkdirSync(profilePath, { recursive: true });
    fs.writeFileSync(path.join(profilePath, 'Preferences'), 'not-json');

    expect(() => cleanupCrashState(tmpDir, profileDir)).not.toThrow();
  });
});

describe('closeExtraTabs', () => {
  it('should close all tabs except the first one', async () => {
    const closeFns = [vi.fn(), vi.fn(), vi.fn()];
    const mockBrowser = {
      pages: vi.fn().mockResolvedValue([
        { close: closeFns[0] },
        { close: closeFns[1] },
        { close: closeFns[2] },
      ]),
    };

    await closeExtraTabs(mockBrowser);

    expect(closeFns[0]).not.toHaveBeenCalled();
    expect(closeFns[1]).toHaveBeenCalled();
    expect(closeFns[2]).toHaveBeenCalled();
  });

  it('should handle a single tab without error', async () => {
    const closeFn = vi.fn();
    const mockBrowser = {
      pages: vi.fn().mockResolvedValue([{ close: closeFn }]),
    };

    await closeExtraTabs(mockBrowser);

    expect(closeFn).not.toHaveBeenCalled();
  });

  it('should handle empty pages array', async () => {
    const mockBrowser = {
      pages: vi.fn().mockResolvedValue([]),
    };

    await expect(closeExtraTabs(mockBrowser)).resolves.not.toThrow();
  });

  it('should handle browser.pages() failure gracefully', async () => {
    const mockBrowser = {
      pages: vi.fn().mockRejectedValue(new Error('Browser disconnected')),
    };

    await expect(closeExtraTabs(mockBrowser)).resolves.not.toThrow();
  });
});
