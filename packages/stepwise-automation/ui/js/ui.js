/* global UI, State, fsmButtons, ActionLog, Breakpoints, API, UrlHistory */
/* eslint-disable no-unused-vars */

/* ── Sidebar resize constants ─────────────────────────────────────────── */
const SIDEBAR_MIN_WIDTH = 128;
const SIDEBAR_MAX_WIDTH_RATIO = 0.5;
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_KEYBOARD_STEP = 16;

/**
 * Clamp a sidebar width between the minimum and the viewport-relative maximum.
 * @param {number} width - Desired width in px.
 * @param {number} viewportWidth - Current viewport width in px.
 * @returns {number} Clamped width in px.
 */
function clampSidebarWidth(width, viewportWidth) {
  return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), Math.floor(viewportWidth * SIDEBAR_MAX_WIDTH_RATIO));
}

/**
 * Compute a new sidebar width after a keyboard arrow press.
 * @param {number} currentWidth - Current sidebar width in px.
 * @param {'left'|'right'} direction - Arrow key direction.
 * @param {number} viewportWidth - Current viewport width in px.
 * @returns {number} Clamped new width in px.
 */
function keyboardResizeWidth(currentWidth, direction, viewportWidth) {
  const delta = direction === 'left' ? -SIDEBAR_KEYBOARD_STEP : SIDEBAR_KEYBOARD_STEP;
  return clampSidebarWidth(currentWidth + delta, viewportWidth);
}

/* ── Static label/class maps for execution status badge ───────────────── */

/** @type {Record<string, string>} FSM state → human-readable label. */
const STATE_LABELS = {
  idle: 'Idle',
  running: 'Running',
  paused: 'Paused',
  stepping: 'Stepping',
  completed: 'Completed',
  errored: 'Errored',
};

/** @type {Record<string, string>} FSM state → CSS class suffix. */
const STATE_CLASSES = {
  idle: 'status-idle',
  running: 'status-running',
  paused: 'status-paused',
  stepping: 'status-stepping',
  completed: 'status-completed',
  errored: 'status-errored',
};

/**
 * DOM updates, button state rendering driven by FSM, journey list rendering,
 * settings persistence. Exposed as a global — no imports, no modules.
 *
 * UX: Doherty Threshold — refresh() is fast DOM-only updates, no heavy computation.
 * UX: Hick's Law — settings hidden by default, shown on gear icon click.
 * UX: Postel's Law — handle missing elements gracefully, never crash on null.
 */
const UI = {
  /**
   * Update all toolbar button states based on the current FSM state.
   * Disables buttons whose actions are not valid in the current state.
   */
  updateButtons() {
    const buttons = fsmButtons(State.fsmState);
    const ids = ['runBtn', 'stopBtn', 'pauseBtn', 'resumeBtn', 'stepBtn', 'stepCount'];
    const keys = ['play', 'stop', 'pause', 'resume', 'step', 'step'];

    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !buttons[keys[i]];
    });
  },

  /**
   * Update the execution status badge text and CSS class.
   * Uses the static STATE_LABELS and STATE_CLASSES maps.
   */
  updateStatus() {
    const el = document.getElementById('executionStatus');
    if (!el) return;

    el.textContent = STATE_LABELS[State.fsmState] || 'Idle';
    el.className = 'status-badge ' + (STATE_CLASSES[State.fsmState] || 'status-idle');
  },

  /**
   * Render the journey list in the sidebar from State.journeys.
   * Shows an empty-state message when no journeys are discovered.
   */
  renderJourneys() {
    const container = document.getElementById('journey-list');
    if (!container) return;

    container.textContent = '';

    if (!State.journeys || State.journeys.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';

      const icon = document.createElement('div');
      icon.className = 'empty-state-icon';
      icon.textContent = '🗺';

      const text = document.createElement('div');
      text.className = 'empty-state-text';
      text.textContent = 'No journeys discovered. Check your config glob pattern.';

      empty.appendChild(icon);
      empty.appendChild(text);
      container.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    State.journeys.forEach((journey) => {
      fragment.appendChild(UI._createJourneyElement(journey));
    });
    container.appendChild(fragment);

    UI._updateSelectAllCheckbox();
  },

  /**
   * Create a single journey list item element with checkbox, name, and status dot.
   * @param {Object} journey - Journey descriptor with `id` and `name` properties.
   * @returns {HTMLElement} The constructed journey-item div.
   */
  _createJourneyElement(journey) {
    const div = document.createElement('div');
    div.className = 'journey-item status-idle';
    div.dataset.journeyId = journey.id;
    div.setAttribute('role', 'listitem');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = State.selectedJourneys.has(journey.id);
    checkbox.setAttribute('aria-label', 'Select ' + (journey.name || journey.id));

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        State.selectedJourneys.add(journey.id);
        div.classList.add('selected');
      } else {
        State.selectedJourneys.delete(journey.id);
        div.classList.remove('selected');
      }
      UI._updateSelectAllCheckbox();
      UI.saveSettings();
    });

    if (State.selectedJourneys.has(journey.id)) {
      div.classList.add('selected');
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'journey-name';
    nameSpan.textContent = journey.name || journey.id;

    const statusDot = document.createElement('span');
    statusDot.className = 'journey-status idle';
    statusDot.dataset.journeyId = journey.id;
    statusDot.setAttribute('aria-label', 'Status: idle');

    // Clicking the row toggles the checkbox
    div.addEventListener('click', (e) => {
      if (e.target === checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });

    div.appendChild(checkbox);
    div.appendChild(nameSpan);
    div.appendChild(statusDot);

    return div;
  },

  /**
   * Update a single journey's status indicator (dot and card border).
   * @param {string} journeyId - The journey identifier.
   * @param {string} status - One of 'idle', 'running', 'passed', 'failed'.
   */
  updateJourneyStatus(journeyId, status) {
    const safeStatus = status || 'idle';
    const dot = document.querySelector(
      '.journey-status[data-journey-id="' + journeyId + '"]'
    );
    if (dot) {
      dot.className = 'journey-status ' + safeStatus;
      dot.setAttribute('aria-label', 'Status: ' + safeStatus);
    }

    const card = document.querySelector(
      '.journey-item[data-journey-id="' + journeyId + '"]'
    );
    if (card) {
      card.classList.remove('status-idle', 'status-running', 'status-passed', 'status-failed');
      card.classList.add('status-' + safeStatus);
    }
  },

  /**
   * Update the test results summary in the footer.
   * Uses a single reduce pass to count passed/failed results.
   */
  updateResultsSummary() {
    const el = document.getElementById('testResultsSummary');
    if (!el) return;

    if (!State.testResults || State.testResults.length === 0) {
      el.textContent = 'No tests run';
      return;
    }

    const { passed, failed } = State.testResults.reduce(
      (acc, r) => {
        if (r.status === 'passed') acc.passed++;
        if (r.status === 'failed') acc.failed++;
        return acc;
      },
      { passed: 0, failed: 0 }
    );
    const total = State.testResults.length;

    el.textContent = '';
    const passSpan = document.createElement('span');
    passSpan.className = 'pass-count';
    passSpan.textContent = passed + ' passed';

    const failSpan = document.createElement('span');
    failSpan.className = 'fail-count';
    failSpan.textContent = failed + ' failed';

    el.appendChild(passSpan);
    el.appendChild(document.createTextNode(' \u00b7 '));
    el.appendChild(failSpan);
    el.appendChild(document.createTextNode(' \u00b7 ' + total + ' total'));
  },

  /**
   * Update the "Select All" checkbox state based on current selections.
   * Sets checked, indeterminate, or unchecked as appropriate.
   */
  _updateSelectAllCheckbox() {
    const selectAll = document.getElementById('selectAll');
    if (!selectAll) return;

    const total = State.journeys ? State.journeys.length : 0;
    const selected = State.selectedJourneys.size;

    selectAll.checked = total > 0 && selected === total;
    selectAll.indeterminate = selected > 0 && selected < total;
  },

  /**
   * Apply settings already loaded into State.settings to the DOM.
   * Called from App.init() after settings are fetched from the server.
   */
  loadSettings() {
    UI._applySettingsToDOM();
  },

  /**
   * Apply State.settings values to DOM form elements.
   * Restores all persisted UI state: inputs, toggles, tabs, sidebar, etc.
   */
  _applySettingsToDOM() {
    const s = State.settings;

    // ── Simple text/number inputs ────────────────────────────────────
    const inputMap = {
      targetUrl:       s.targetUrl || '',
      browserPath:     s.browserPath || '',
      userDataDir:     s.userDataDir || '',
      viewportWidth:   s.viewportWidth || 1280,
      viewportHeight:  s.viewportHeight || 720,
    };
    Object.entries(inputMap).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    // ── Action delay slider (quadratic scale) ────────────────────────
    const actionDelay = document.getElementById('actionDelay');
    if (actionDelay) actionDelay.value = Math.round(Math.sqrt((s.actionDelay || 0) / 5000) * 100);

    const actionDelayValue = document.getElementById('actionDelayValue');
    if (actionDelayValue) actionDelayValue.textContent = (s.actionDelay || 0) + 'ms';

    // ── Toggle checkboxes ────────────────────────────────────────────
    const toggleMap = {
      devtoolsToggle:         !!s.devtools,
      keepBrowserOpenToggle:  !!s.keepBrowserOpen,
    };
    Object.entries(toggleMap).forEach(([id, checked]) => {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    });

    // ── Settings panel open/closed state ─────────────────────────────
    const panel = document.getElementById('settings-panel');
    const toggle = document.getElementById('settingsToggle');
    if (panel && toggle) {
      if (s.settingsPanelOpen) {
        panel.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        panel.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      }
    }

    // ── Selected engine ──────────────────────────────────────────────
    const engineSelect = document.getElementById('engineSelect');
    if (engineSelect && s.selectedTool) {
      engineSelect.value = s.selectedTool;
      State.currentTool = s.selectedTool;
    }

    // ── Active tab ───────────────────────────────────────────────────
    if (s.activeTab) {
      document.querySelectorAll('.tab[role="tab"]').forEach((tab) => {
        const panelId = tab.getAttribute('aria-controls');
        const isActive = panelId === s.activeTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });
      document.querySelectorAll('.tab-panel').forEach((p) => {
        const isActive = p.id === s.activeTab;
        p.classList.toggle('active', isActive);
        if (isActive) {
          p.removeAttribute('hidden');
        } else {
          p.setAttribute('hidden', '');
        }
      });
    }

    // ── Selected journeys ────────────────────────────────────────────
    if (Array.isArray(s.selectedJourneyIds)) {
      State.selectedJourneys = new Set(s.selectedJourneyIds);
    }

    // ── Sidebar width ────────────────────────────────────────────────
    let restoredWidth = SIDEBAR_DEFAULT_WIDTH;
    if (typeof s.sidebarWidth === 'number' && s.sidebarWidth > 0 && !isNaN(s.sidebarWidth)) {
      restoredWidth = clampSidebarWidth(s.sidebarWidth, window.innerWidth);
    }
    document.documentElement.style.setProperty('--sidebar-width', restoredWidth + 'px');
    const resizeHandle = document.querySelector('.resize-handle');
    if (resizeHandle) {
      resizeHandle.setAttribute('aria-valuenow', String(restoredWidth));
    }

    // Sync viewport preset dropdown to match restored dimensions
    if (typeof App !== 'undefined' && App._syncViewportPreset) {
      App._syncViewportPreset();
    }

    // ── URL history ──────────────────────────────────────────────────
    if (Array.isArray(s.targetUrlHistory)) {
      State.settings.targetUrlHistory = s.targetUrlHistory;
    }
    UI.renderComboBoxDropdown();
  },

  /**
   * Read current values from DOM form elements into State.settings
   * and persist to the server.
   */
  saveSettings() {
    // ── Simple text inputs ───────────────────────────────────────────
    ['targetUrl', 'browserPath', 'userDataDir'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) State.settings[id] = el.value;
    });

    // ── Action delay (quadratic scale) ───────────────────────────────
    const actionDelay = document.getElementById('actionDelay');
    if (actionDelay) State.settings.actionDelay = Math.round(Math.pow(actionDelay.value / 100, 2) * 5000);

    // ── Numeric inputs with defaults ─────────────────────────────────
    const viewportWidth = document.getElementById('viewportWidth');
    if (viewportWidth) State.settings.viewportWidth = parseInt(viewportWidth.value, 10) || 1280;

    const viewportHeight = document.getElementById('viewportHeight');
    if (viewportHeight) State.settings.viewportHeight = parseInt(viewportHeight.value, 10) || 720;

    // ── Toggle checkboxes ────────────────────────────────────────────
    const devtools = document.getElementById('devtoolsToggle');
    if (devtools) State.settings.devtools = devtools.checked;

    const keepOpen = document.getElementById('keepBrowserOpenToggle');
    if (keepOpen) State.settings.keepBrowserOpen = keepOpen.checked;

    // ── Settings panel state ─────────────────────────────────────────
    const panel = document.getElementById('settings-panel');
    if (panel) State.settings.settingsPanelOpen = !panel.hasAttribute('hidden');

    // ── Selected engine ──────────────────────────────────────────────
    const engineSelect = document.getElementById('engineSelect');
    if (engineSelect) State.settings.selectedTool = engineSelect.value;

    // ── Active tab ───────────────────────────────────────────────────
    const activeTab = document.querySelector('.tab-panel.active');
    if (activeTab) State.settings.activeTab = activeTab.id;

    // ── Selected journeys ────────────────────────────────────────────
    State.settings.selectedJourneyIds = Array.from(State.selectedJourneys);

    // ── Sidebar width ────────────────────────────────────────────────
    const sidebarWidthRaw =
      document.documentElement.style.getPropertyValue('--sidebar-width') ||
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width');
    const sidebarWidthParsed = parseInt(sidebarWidthRaw, 10);
    if (sidebarWidthParsed > 0) {
      State.settings.sidebarWidth = sidebarWidthParsed;
    }

    // ── URL history ──────────────────────────────────────────────────
    if (!Array.isArray(State.settings.targetUrlHistory)) {
      State.settings.targetUrlHistory = [];
    }

    // ── Persist to server ────────────────────────────────────────────
    if (typeof API !== 'undefined' && API.saveSettings) {
      API.saveSettings(State.settings).catch((err) => {
        console.error('Failed to save settings to server:', err);
      });
    }
  },

  /**
   * Set up tab switching behavior.
   * Clicking a tab deactivates all others and shows the associated panel.
   */
  initTabs() {
    const tabs = document.querySelectorAll('.tab[role="tab"]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab');
        if (!targetId) return;

        // Deactivate all tabs
        tabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });

        // Hide all panels
        document.querySelectorAll('.tab-panel').forEach((p) => {
          p.classList.remove('active');
          p.setAttribute('hidden', '');
        });

        // Activate clicked tab and show its panel
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        const panelId = tab.getAttribute('aria-controls');
        const panelEl = panelId ? document.getElementById(panelId) : null;
        if (panelEl) {
          panelEl.classList.add('active');
          panelEl.removeAttribute('hidden');
        }

        UI.saveSettings();
      });
    });
  },

  /**
   * Set up settings panel toggle (gear icon).
   * Toggles the hidden attribute and aria-expanded on click.
   */
  initSettingsPanel() {
    const toggle = document.getElementById('settingsToggle');
    const panel = document.getElementById('settings-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
      const isHidden = panel.hasAttribute('hidden');
      if (isHidden) {
        panel.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        panel.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      }
      UI.saveSettings();
    });
  },

  /**
   * Set up sidebar resize handle for drag and keyboard interactions.
   * Supports mouse drag and ArrowLeft/ArrowRight keyboard resizing.
   */
  initResizeHandle() {
    const handle = document.querySelector('.resize-handle');
    if (!handle) return;

    const onMouseMove = (e) => {
      const vw = window.innerWidth;
      const maxWidth = Math.floor(vw * SIDEBAR_MAX_WIDTH_RATIO);
      const newWidth = clampSidebarWidth(e.clientX, vw);
      document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
      handle.setAttribute('aria-valuenow', String(newWidth));
      handle.setAttribute('aria-valuemax', String(maxWidth));
    };

    const onMouseUp = () => {
      handle.classList.remove('active');
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      UI.saveSettings();
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      handle.classList.add('active');
      document.body.classList.add('resizing');
      handle.setAttribute('aria-valuemax', String(Math.floor(window.innerWidth * SIDEBAR_MAX_WIDTH_RATIO)));
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    handle.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();

      const vw = window.innerWidth;
      const maxWidth = Math.floor(vw * SIDEBAR_MAX_WIDTH_RATIO);
      const currentWidth = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'),
        10
      ) || SIDEBAR_DEFAULT_WIDTH;
      const direction = e.key === 'ArrowLeft' ? 'left' : 'right';
      const newWidth = keyboardResizeWidth(currentWidth, direction, vw);

      document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
      handle.setAttribute('aria-valuenow', String(newWidth));
      handle.setAttribute('aria-valuemax', String(maxWidth));
      UI.saveSettings();
    });
  },

  /**
   * Main render loop — call after any state change.
   * Updates buttons, status badge, results summary, journey dots,
   * breakpoint button state, and the action log.
   */
  refresh() {
    UI.updateButtons();
    UI.updateStatus();
    UI.updateResultsSummary();
    UI.updateJourneyDots();

    const clearBreakpointsBtn = document.getElementById('clearBreakpointsBtn');
    if (clearBreakpointsBtn) {
      clearBreakpointsBtn.disabled = !State.currentJourney;
    }

    if (typeof ActionLog !== 'undefined') ActionLog.render();
  },

  /**
   * Sync all journey status dots from State.testResults and State.currentJourney.
   * Running journeys get 'running'; completed ones get their result status;
   * others reset to 'idle'.
   */
  updateJourneyDots() {
    if (!State.journeys) return;

    State.journeys.forEach((j) => {
      const result = State.testResults.find((r) => r.journey === j.id);

      if (result) {
        UI.updateJourneyStatus(j.id, result.status);
      } else if (State.currentJourney === j.id && State.fsmState === 'running') {
        UI.updateJourneyStatus(j.id, 'running');
      } else if (State.fsmState === 'running' || State.fsmState === 'idle') {
        UI.updateJourneyStatus(j.id, 'idle');
      }
    });
  },

  /* ── Combo Box ──────────────────────────────────────────────────────── */

  /**
   * Initialize combo box event listeners for the target URL input.
   * Sets up toggle button, delegated click handlers on listbox items,
   * keyboard navigation (ArrowUp/Down, Enter, Escape), and dismiss
   * behavior (click outside / focus loss).
   */
  initComboBox() {
    const wrapper = document.querySelector('.combobox-wrapper');
    const toggle = wrapper ? wrapper.querySelector('.combobox-toggle') : null;
    const listbox = document.getElementById('targetUrl-listbox');
    const input = document.getElementById('targetUrl');
    if (!wrapper || !toggle || !listbox) return;

    let focusIndex = -1;

    /**
     * Update the visual focus indicator and aria-activedescendant.
     * @param {number} newIndex - Index of the item to focus, or -1 to clear.
     */
    const setFocusedItem = (newIndex) => {
      const items = listbox.querySelectorAll('li[role="option"]');
      if (focusIndex >= 0 && focusIndex < items.length) {
        items[focusIndex].classList.remove('focused');
      }
      focusIndex = newIndex;
      if (newIndex >= 0 && newIndex < items.length) {
        items[newIndex].classList.add('focused');
        if (input) input.setAttribute('aria-activedescendant', items[newIndex].id);
      } else if (input) {
        input.setAttribute('aria-activedescendant', '');
      }
    };

    // Toggle button opens/closes the dropdown
    toggle.addEventListener('click', () => {
      const expanded = wrapper.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        UI.closeComboBox();
      } else {
        UI.openComboBox();
      }
    });

    // Delegated click on listbox items — select or delete
    listbox.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.combobox-item-delete');
      if (deleteBtn) {
        const li = deleteBtn.closest('li[role="option"]');
        const url = li ? li.querySelector('.combobox-item-url') : null;
        if (url) UI.deleteComboBoxItem(url.textContent);
        return;
      }

      const option = e.target.closest('li[role="option"]');
      if (option) {
        const urlSpan = option.querySelector('.combobox-item-url');
        if (urlSpan) UI.selectComboBoxItem(urlSpan.textContent);
      }
    });

    // ── Keyboard navigation ──────────────────────────────────────────
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        if (wrapper.getAttribute('aria-expanded') !== 'true') {
          UI.openComboBox();
        }
        setFocusedItem(0);
        listbox.focus();
      });
    }

    listbox.addEventListener('keydown', (e) => {
      const items = listbox.querySelectorAll('li[role="option"]');
      const count = items.length;
      if (count === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedItem(Math.min(focusIndex + 1, count - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedItem(Math.max(focusIndex - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < count) {
          const urlSpan = items[focusIndex].querySelector('.combobox-item-url');
          if (urlSpan) UI.selectComboBoxItem(urlSpan.textContent);
          focusIndex = -1;
          if (input) input.focus();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        UI.closeComboBox();
        focusIndex = -1;
        if (input) input.focus();
      }
    });

    // ── Dismiss behavior ─────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        UI.closeComboBox();
      }
    });

    wrapper.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          UI.closeComboBox();
        }
      }, 0);
    });
  },

  /**
   * Render `<li role="option">` items from State.settings.targetUrlHistory.
   * Hides the toggle button when history is empty.
   */
  renderComboBoxDropdown() {
    const listbox = document.getElementById('targetUrl-listbox');
    const toggle = document.querySelector('.combobox-wrapper .combobox-toggle');
    if (!listbox) return;

    const history = Array.isArray(State.settings.targetUrlHistory)
      ? State.settings.targetUrlHistory
      : [];

    listbox.textContent = '';

    // Hide toggle when history is empty
    if (toggle) {
      if (history.length === 0) {
        toggle.setAttribute('hidden', '');
      } else {
        toggle.removeAttribute('hidden');
      }
    }

    const fragment = document.createDocumentFragment();
    history.forEach((url, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = 'targetUrl-option-' + i;

      const urlSpan = document.createElement('span');
      urlSpan.className = 'combobox-item-url';
      urlSpan.textContent = url;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'combobox-item-delete';
      deleteBtn.setAttribute('aria-label', 'Delete ' + url);
      deleteBtn.setAttribute('tabindex', '-1');
      deleteBtn.textContent = '\u00d7'; // × character

      li.appendChild(urlSpan);
      li.appendChild(deleteBtn);
      fragment.appendChild(li);
    });
    listbox.appendChild(fragment);
  },

  /** Show the combo box dropdown and set aria-expanded="true". */
  openComboBox() {
    const wrapper = document.querySelector('.combobox-wrapper');
    const listbox = document.getElementById('targetUrl-listbox');
    if (!wrapper || !listbox) return;

    wrapper.setAttribute('aria-expanded', 'true');
    listbox.removeAttribute('hidden');
  },

  /**
   * Hide the combo box dropdown, set aria-expanded="false",
   * and clear aria-activedescendant and focused state.
   */
  closeComboBox() {
    const wrapper = document.querySelector('.combobox-wrapper');
    const listbox = document.getElementById('targetUrl-listbox');
    const input = document.getElementById('targetUrl');
    if (!wrapper || !listbox) return;

    wrapper.setAttribute('aria-expanded', 'false');
    listbox.setAttribute('hidden', '');
    if (input) input.setAttribute('aria-activedescendant', '');

    listbox.querySelectorAll('li[role="option"]').forEach((item) => {
      item.classList.remove('focused');
    });
  },

  /**
   * Select a combo box item: set input value, move URL to front of
   * history (MRU), close dropdown, and save settings.
   * @param {string} url - The URL to select.
   */
  selectComboBoxItem(url) {
    const input = document.getElementById('targetUrl');
    if (input) input.value = url;

    State.settings.targetUrlHistory = UrlHistory.add(
      State.settings.targetUrlHistory || [],
      url
    );

    UI.closeComboBox();
    UI.renderComboBoxDropdown();
    UI.saveSettings();
  },

  /**
   * Delete a combo box item: remove from history, re-render dropdown,
   * and save settings. Keeps the current input value unchanged.
   * @param {string} url - The URL to delete.
   */
  deleteComboBoxItem(url) {
    State.settings.targetUrlHistory = UrlHistory.remove(
      State.settings.targetUrlHistory || [],
      url
    );

    UI.renderComboBoxDropdown();
    UI.saveSettings();
  },

  /**
   * Add a URL to the history (MRU order), re-render dropdown, and
   * save settings. Empty/whitespace-only URLs are ignored by UrlHistory.add().
   * @param {string} url - The URL to add.
   */
  addToUrlHistory(url) {
    State.settings.targetUrlHistory = UrlHistory.add(
      State.settings.targetUrlHistory || [],
      url
    );

    UI.renderComboBoxDropdown();
    UI.saveSettings();
  },

};
