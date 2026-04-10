"use strict";
/**
 * File-based settings storage for the dashboard UI.
 *
 * Persists all mutable UI state (viewport, devtools, action delay, selected
 * journeys, breakpoints, etc.) to `.stepwise/settings.json` in the consuming
 * project's working directory. This replaces localStorage so settings are
 * project-scoped and survive browser/domain changes.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSettingsStorage = initSettingsStorage;
exports.readSettings = readSettings;
exports.writeSettings = writeSettings;
exports.getFileBreakpoints = getFileBreakpoints;
exports.setFileBreakpoints = setFileBreakpoints;
exports.clearFileBreakpoints = clearFileBreakpoints;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SETTINGS_DIR = '.stepwise';
const SETTINGS_FILE = 'settings.json';
let settingsDir;
let settingsPath;
/**
 * Initialize the settings storage directory.
 * Must be called once at server startup.
 *
 * @param cwd - The consuming project's working directory
 */
function initSettingsStorage(cwd) {
    settingsDir = path.join(cwd, SETTINGS_DIR);
    settingsPath = path.join(settingsDir, SETTINGS_FILE);
}
/**
 * Read all settings from disk.
 * Returns empty object if file doesn't exist.
 */
function readSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(raw);
        }
    }
    catch (err) {
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
function writeSettings(updates) {
    try {
        if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
        }
        const current = readSettings();
        const merged = { ...current, ...updates };
        fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    }
    catch (err) {
        console.error('[Settings] Failed to write settings:', err);
    }
}
/**
 * Get breakpoints for a specific journey from the settings file.
 */
function getFileBreakpoints(journeyId) {
    const settings = readSettings();
    return settings.breakpoints?.[journeyId] ?? [];
}
/**
 * Set breakpoints for a specific journey in the settings file.
 */
function setFileBreakpoints(journeyId, indices) {
    const settings = readSettings();
    const breakpoints = settings.breakpoints ?? {};
    breakpoints[journeyId] = [...indices];
    writeSettings({ breakpoints });
}
/**
 * Clear all breakpoints for a specific journey from the settings file.
 */
function clearFileBreakpoints(journeyId) {
    const settings = readSettings();
    const { [journeyId]: _, ...breakpoints } = settings.breakpoints ?? {};
    writeSettings({ breakpoints });
}
//# sourceMappingURL=settings-storage.js.map