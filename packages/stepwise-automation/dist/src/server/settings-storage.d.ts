/**
 * File-based settings storage for the dashboard UI.
 *
 * Persists all mutable UI state (viewport, devtools, action delay, selected
 * journeys, breakpoints, etc.) to `.stepwise/settings.json` in the consuming
 * project's working directory. This replaces localStorage so settings are
 * project-scoped and survive browser/domain changes.
 */
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
/**
 * Initialize the settings storage directory.
 * Must be called once at server startup.
 *
 * @param cwd - The consuming project's working directory
 */
export declare function initSettingsStorage(cwd: string): void;
/**
 * Read all settings from disk.
 * Returns empty object if file doesn't exist.
 */
export declare function readSettings(): PersistedSettings;
/**
 * Write settings to disk, merging with existing values.
 * Creates the .stepwise directory if it doesn't exist.
 *
 * @param updates - Partial settings to merge
 */
export declare function writeSettings(updates: Partial<PersistedSettings>): void;
/**
 * Get breakpoints for a specific journey from the settings file.
 */
export declare function getFileBreakpoints(journeyId: string): number[];
/**
 * Set breakpoints for a specific journey in the settings file.
 */
export declare function setFileBreakpoints(journeyId: string, indices: number[]): void;
/**
 * Clear all breakpoints for a specific journey from the settings file.
 */
export declare function clearFileBreakpoints(journeyId: string): void;
//# sourceMappingURL=settings-storage.d.ts.map