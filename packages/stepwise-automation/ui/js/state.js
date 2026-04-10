/* global State */
/* eslint-disable no-unused-vars */

/**
 * Single source of truth for all dashboard state.
 * Exposed as a global — no imports, no modules.
 *
 * @typedef {Object} TestResult
 * @property {string} journey - Journey identifier.
 * @property {string} status - 'passed' | 'failed' | 'running'.
 * @property {number} [duration] - Elapsed time in ms.
 *
 * @typedef {Object} Action
 * @property {number} index - Zero-based action index within the journey.
 * @property {string} description - Human-readable action description.
 * @property {string} status - 'running' | 'complete' | 'breakpoint'.
 *
 * @typedef {Object} Journey
 * @property {string} id - Unique journey identifier (file-derived).
 * @property {string} name - Display name.
 *
 * @typedef {Object} Settings
 * @property {string} targetUrl - Base URL for the test target.
 * @property {string} browserPath - Custom browser executable path.
 * @property {string} userDataDir - Chrome user-data directory override.
 * @property {number} actionDelay - Delay between actions in ms.
 * @property {number} viewportWidth - Browser viewport width in px.
 * @property {number} viewportHeight - Browser viewport height in px.
 * @property {boolean} devtools - Open DevTools on launch.
 * @property {boolean} keepBrowserOpen - Keep browser open after run.
 * @property {boolean} settingsPanelOpen - Whether the settings panel is expanded.
 * @property {string} selectedTool - Active automation engine ('puppeteer' | 'playwright').
 * @property {string} activeTab - ID of the active tab panel.
 * @property {string[]} selectedJourneyIds - Persisted set of selected journey IDs.
 * @property {number|null} sidebarWidth - Persisted sidebar width in px.
 * @property {string[]} targetUrlHistory - MRU list of target URLs.
 */
const State = {
  /** @type {WebSocket|null} Active WebSocket connection. */
  ws: null,

  /** @type {Journey[]} Discovered journeys from the server. */
  journeys: [],

  /** @type {Set<string>} Currently selected journey IDs. */
  selectedJourneys: new Set(),

  /** @type {TestResult[]} Results collected during the current run. */
  testResults: [],

  /** @type {string} Current FSM state (idle | running | paused | stepping | completed | errored). */
  fsmState: 'idle',

  /** @type {Action[]} Actions for the currently executing journey. */
  actions: [],

  /** @type {Record<string, Set<number>>} Breakpoints keyed by journey ID. */
  breakpoints: {},

  /** @type {number} Index of the action currently being executed. */
  currentActionIndex: 0,

  /** @type {string|null} ID of the journey currently running. */
  currentJourney: null,

  /** @type {string} Selected automation engine. */
  currentTool: 'puppeteer',

  /** @type {Settings} Persisted user settings. */
  settings: {
    targetUrl: '',
    browserPath: '',
    userDataDir: '',
    actionDelay: 0,
    viewportWidth: 1280,
    viewportHeight: 720,
    devtools: false,
    keepBrowserOpen: false,
    settingsPanelOpen: false,
    selectedTool: 'puppeteer',
    activeTab: 'panel-actions',
    selectedJourneyIds: [],
    sidebarWidth: null,
    targetUrlHistory: [],
  },
};
