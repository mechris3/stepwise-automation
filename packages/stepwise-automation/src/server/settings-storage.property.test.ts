import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initSettingsStorage, writeSettings, readSettings } from './settings-storage';

// Feature: target-url-combobox, Property 3: URL history settings round-trip
describe('Property 3: URL history settings round-trip', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-roundtrip-'));
    initSettingsStorage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * **Validates: Requirements 3.3, 3.4, 7.1, 7.2**
   *
   * For any valid targetUrlHistory string array, writing it to settings
   * storage and reading it back should produce an equivalent array.
   */
  it('writing targetUrlHistory and reading it back produces an equivalent array', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 20 }),
        (history) => {
          writeSettings({ targetUrlHistory: history });
          const restored = readSettings();

          expect(restored.targetUrlHistory).toEqual(history);
        },
      ),
      { numRuns: 100 },
    );
  });
});
