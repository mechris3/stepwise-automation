/**
 * File-based settings storage for the dashboard UI.
 *
 * Persists all mutable UI state (viewport, devtools, action delay, selected
 * journeys, breakpoints, etc.) to `.stepwise/settings.json` in the consuming
 * project's working directory. This replaces localStorage so settings are
 * project-scoped and survive browser/domain changes.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Shape of the persisted settings file. */
export interface PersistedSettings {
  targetUrl?: string;
  browserPath?: string;
  userDataDir?: string;
  actionDelay?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devtools?: boolean;
  keepBrowserOpen?: boolean;
  settingsPanelOpen?: boolean;
  selectedTool?: string;
  activeTab?: string;
  selectedJourneyIds?: string[];
  breakpoints?: Record<string, number[]>;
  /** Sidebar width in pixels */
  sidebarWidth?: number;
  /** Previously entered Target URL strings (MRU order) */
  targetUrlHistory?: string[];
}

const SETTINGS_DIR = '.stepwise';
const SETTINGS_FILE = 'settings.json';

let settingsDir: string;
let settingsPath: string;

/**
 * Initialize the settings storage directory.
 * Must be called once at server startup.
 *
 * @param cwd - The consuming project's working directory
 */
export function initSettingsStorage(cwd: string): void {
  settingsDir = path.join(cwd, SETTINGS_DIR);
  settingsPath = path.join(settingsDir, SETTINGS_FILE);
}

/**
 * Read all settings from disk.
 * Returns empty object if file doesn't exist.
 */
export function readSettings(): PersistedSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Settings] Failed to read settings:', err);
  }
  return {};
}

/**
 * Write settings to disk, merging with existing values.
 * Creates the .stepwise directory if it doesn't exist.
 *
 * @param updates - Partial settings to merge
 */
export function writeSettings(updates: Partial<PersistedSettings>): void {
  try {
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    const current = readSettings();
    const merged = { ...current, ...updates };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.error('[Settings] Failed to write settings:', err);
  }
}

/**
 * Get breakpoints for a specific journey from the settings file.
 */
export function getFileBreakpoints(journeyId: string): number[] {
  const settings = readSettings();
  return settings.breakpoints?.[journeyId] ?? [];
}

/**
 * Set breakpoints for a specific journey in the settings file.
 */
export function setFileBreakpoints(journeyId: string, indices: number[]): void {
  const settings = readSettings();
  const breakpoints = settings.breakpoints ?? {};
  breakpoints[journeyId] = [...indices];
  writeSettings({ breakpoints });
}

/**
 * Clear all breakpoints for a specific journey from the settings file.
 */
export function clearFileBreakpoints(journeyId: string): void {
  const settings = readSettings();
  const { [journeyId]: _, ...breakpoints } = settings.breakpoints ?? {};
  writeSettings({ breakpoints });
}
