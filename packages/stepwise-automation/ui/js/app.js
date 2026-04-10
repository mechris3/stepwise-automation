/* global App, State, UI, WebSocketClient, API, TestRunner, ActionLog, Breakpoints, UrlHistory */
/* eslint-disable no-unused-vars */

/**
 * Application initialization — module wiring, event binding, engine selector.
 * Exposed as a global — no imports, no modules.
 *
 * UX: Postel's Law — handle missing elements gracefully, don't crash on null.
 */
const App = {
  /**
   * Check whether the test runner is in an active state where live
   * config updates should be pushed to the server.
   * @returns {boolean}
   */
  _isRunning() {
    return State.fsmState === 'running' ||
           State.fsmState === 'paused' ||
           State.fsmState === 'stepping';
  },

  /**
   * Reload and sync breakpoints for every discovered journey.
   * Used when the target URL changes (breakpoints are scoped per domain).
   */
  _reloadAllBreakpoints() {
    State.journeys.forEach((j) => {
      Breakpoints.load(j.id);
      Breakpoints.sync(j.id);
    });
  },

  /**
   * Push the current settings to the server if tests are actively running.
   * Silently catches and logs errors.
   */
  _pushConfigIfRunning() {
    if (!App._isRunning()) return;
    API.updateConfig(State.settings).catch((err) => {
      console.error('Failed to send config update:', err);
    });
  },

  /**
   * Reconcile fetched journey data with the current selection state.
   * Updates State.journeys and prunes any selected IDs that no longer
   * exist in the project. Saves settings if any selections were pruned.
   * No-ops if the response is missing or has no journeys array.
   * @param {Object} [data] - Response from API.getJourneys().
   */
  _reconcileJourneys(data) {
    if (!data?.journeys) return;

    State.journeys = data.journeys;

    const validIds = new Set(data.journeys.map((j) => j.id));
    const sizeBefore = State.selectedJourneys.size;

    State.selectedJourneys = new Set(
      [...State.selectedJourneys].filter((id) => validIds.has(id))
    );

    if (State.selectedJourneys.size < sizeBefore) {
      UI.saveSettings();
    }
  },

  /**
   * Merge saved settings into State.settings, only overwriting keys
   * that already exist in the defaults. No-ops if saved is not a valid object.
   * @param {Object} [saved] - Settings object from the server.
   */
  _mergeSettings(saved) {
    if (!saved || typeof saved !== 'object') return;

    Object.keys(State.settings)
      .filter((key) => saved[key] !== undefined)
      .forEach((key) => {
        State.settings[key] = saved[key];
      });
  },

  /**
   * Apply auto-detected browser path and user data dir to empty inputs.
   * Uses the first (highest-priority) browser from the discovery response.
   * No-ops if no browsers were found or inputs already have values.
   * @param {Object} [browsersData] - Response from /api/config/browsers.
   */
  _applyDetectedBrowser(browsersData) {
    if (!browsersData?.browsers?.length) return;

    const best = browsersData.browsers[0];
    const browserPathInput = document.getElementById('browserPath');
    const userDataDirInput = document.getElementById('userDataDir');

    if (browserPathInput && !browserPathInput.value) {
      browserPathInput.value = best.executablePath;
      State.settings.browserPath = best.executablePath;
    }
    if (userDataDirInput && !userDataDirInput.value && best.userDataDir) {
      userDataDirInput.value = best.userDataDir;
      State.settings.userDataDir = best.userDataDir;
    }
    UI.saveSettings();
  },

  /**
   * Bootstrap the application.
   * Loads persisted settings, migrates URL history, initialises all UI
   * subsystems, connects the WebSocket, fetches journeys, auto-detects
   * the browser, wires up event handlers, and performs the initial render.
   */
  async init() {
    // ── Load persisted settings ──────────────────────────────────────
    try {
      const saved = await API.getSettings();
      App._mergeSettings(saved);
    } catch (err) {
      console.error('Failed to load settings from server:', err);
    }

    // ── Migrate URL history ──────────────────────────────────────────
    if (typeof UrlHistory !== 'undefined' && UrlHistory.migrateSettings) {
      const { settings, migrated } = UrlHistory.migrateSettings(State.settings);
      if (migrated) {
        State.settings = settings;
        API.saveSettings(State.settings).catch((err) => {
          console.error('Failed to save migrated settings:', err);
        });
      }
    }

    // ── Initialise UI subsystems ─────────────────────────────────────
    UI.loadSettings();
    UI.initComboBox();
    UI.renderComboBoxDropdown();
    UI.initTabs();
    UI.initSettingsPanel();
    UI.initResizeHandle();

    // ── Connect WebSocket ────────────────────────────────────────────
    WebSocketClient.connect();

    // ── Fetch and reconcile journeys ─────────────────────────────────
    try {
      const data = await API.getJourneys();
      App._reconcileJourneys(data);
    } catch (err) {
      console.error('Failed to fetch journeys:', err);
    }

    UI.renderJourneys();

    // ── Auto-detect browser path ─────────────────────────────────────
    try {
      const browsersData = await API._request('GET', '/api/config/browsers');
      App._applyDetectedBrowser(browsersData);
    } catch (err) {
      console.warn('Browser discovery unavailable:', err);
    }

    // ── Final DOM sync ───────────────────────────────────────────────
    UI._applySettingsToDOM();
    UI.renderComboBoxDropdown();
    App.bindEvents();
    UI.refresh();
  },

  /**
   * Wire up all DOM event handlers — toolbar buttons, settings inputs,
   * engine selector, viewport presets, and keyboard shortcuts.
   */
  bindEvents() {
    // ── Execution control buttons ────────────────────────────────────
    const controlButtons = {
      runBtn:   () => TestRunner.run(),
      stopBtn:  () => TestRunner.stop(),
      pauseBtn: () => TestRunner.pause(),
      resumeBtn: () => TestRunner.resume(),
      stepBtn:  () => TestRunner.step(),
    };
    Object.entries(controlButtons).forEach(([id, handler]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    });

    // ── Clear all breakpoints ────────────────────────────────────────
    const clearBreakpointsBtn = document.getElementById('clearBreakpointsBtn');
    if (clearBreakpointsBtn) {
      clearBreakpointsBtn.addEventListener('click', () => {
        if (State.currentJourney) {
          Breakpoints.clearAll(State.currentJourney);
        }
      });
    }

    // ── Engine selector ──────────────────────────────────────────────
    const engineSelect = document.getElementById('engineSelect');
    if (engineSelect) {
      engineSelect.addEventListener('change', (e) => {
        State.currentTool = e.target.value;
        UI.saveSettings();
      });
    }

    // ── Select All checkbox ──────────────────────────────────────────
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        if (selectAll.checked) {
          State.journeys.forEach((j) => State.selectedJourneys.add(j.id));
        } else {
          State.selectedJourneys.clear();
        }
        UI.renderJourneys();
        UI.saveSettings();
      });
    }

    // ── Copy button — copies active panel content to clipboard ───────
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const activePanel = document.querySelector('.tab-panel.active');
        if (!activePanel) return;

        const text = activePanel.textContent || '';
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).catch((err) => {
            console.error('Failed to copy to clipboard:', err);
          });
        }
      });
    }

    // ── Clear button — clears active panel content ───────────────────
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const activePanel = document.querySelector('.tab-panel.active');
        if (!activePanel) return;

        if (activePanel.id === 'panel-actions') {
          State.actions = [];
          if (typeof ActionLog !== 'undefined') ActionLog.clear();
        } else if (activePanel.id === 'panel-console') {
          const consoleEl = document.getElementById('console-output');
          if (consoleEl) consoleEl.textContent = '';
        }
      });
    }

    // ── Settings change handlers ─────────────────────────────────────
    const settingsInputIds = [
      'targetUrl', 'browserPath', 'userDataDir', 'actionDelay',
      'viewportWidth', 'viewportHeight',
      'devtoolsToggle', 'keepBrowserOpenToggle',
    ];

    settingsInputIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const eventType = (el.type === 'checkbox' || el.type === 'range') ? 'change' : 'input';
      el.addEventListener(eventType, () => {
        UI.saveSettings();

        if (id === 'viewportWidth' || id === 'viewportHeight') {
          App._syncViewportPreset();
        }
        if (id === 'targetUrl') {
          App._reloadAllBreakpoints();
        }
        App._pushConfigIfRunning();
      });
    });

    // ── Viewport preset dropdown ─────────────────────────────────────
    const viewportPreset = document.getElementById('viewportPreset');
    if (viewportPreset) {
      viewportPreset.addEventListener('change', () => {
        const val = viewportPreset.value;
        if (val === 'custom') return;

        const [w, h] = val.split('x').map((n) => parseInt(n, 10));
        const wEl = document.getElementById('viewportWidth');
        const hEl = document.getElementById('viewportHeight');
        if (wEl) wEl.value = w;
        if (hEl) hEl.value = h;

        UI.saveSettings();
        App._pushConfigIfRunning();
      });
    }

    // ── Action delay slider label ────────────────────────────────────
    const actionDelay = document.getElementById('actionDelay');
    const actionDelayValue = document.getElementById('actionDelayValue');
    if (actionDelay && actionDelayValue) {
      actionDelay.addEventListener('input', () => {
        const ms = Math.round(Math.pow(actionDelay.value / 100, 2) * 5000);
        actionDelayValue.textContent = ms + 'ms';
        actionDelay.setAttribute('aria-valuenow', String(ms));
      });
    }

    // ── Browser path — persist on blur ───────────────────────────────
    const browserPathInput = document.getElementById('browserPath');
    if (browserPathInput) {
      browserPathInput.addEventListener('change', () => UI.saveSettings());
    }

    // ── Target URL — persist + history on blur / Enter ───────────────
    const targetUrlInput = document.getElementById('targetUrl');
    if (targetUrlInput) {
      targetUrlInput.addEventListener('change', () => {
        UI.addToUrlHistory(targetUrlInput.value);
        App._reloadAllBreakpoints();
        App._pushConfigIfRunning();
      });
      targetUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          UI.addToUrlHistory(targetUrlInput.value);
        }
      });
    }

    // ── User data dir — persist on blur ──────────────────────────────
    const userDataDirInput = document.getElementById('userDataDir');
    if (userDataDirInput) {
      userDataDirInput.addEventListener('change', () => UI.saveSettings());
    }
  },

  /**
   * Sync the viewport preset dropdown to match the current width/height.
   * Selects the matching preset option, or "Custom" if none match.
   */
  _syncViewportPreset() {
    const preset = document.getElementById('viewportPreset');
    if (!preset) return;

    const w = State.settings.viewportWidth || 1280;
    const h = State.settings.viewportHeight || 720;
    const key = w + 'x' + h;
    const option = preset.querySelector('option[value="' + key + '"]');
    preset.value = option ? key : 'custom';
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
