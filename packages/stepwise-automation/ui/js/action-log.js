/* global ActionLog, State, Breakpoints */
/* eslint-disable no-unused-vars */

/**
 * Action log — renders action items with breakpoint pins, status icons,
 * and entrance animations. Parses [JSON] prefixed messages from stderr.
 * Exposed as a global — no imports, no modules.
 */
const ActionLog = {
  /**
   * Status string → CSS class to apply to an action-item element.
   * @type {Map<string, string>}
   */
  _statusClassMap: new Map([
    ['running',    'current'],
    ['complete',   'completed'],
    ['failed',     'failed'],
    ['breakpoint', 'current'],
  ]),

  /**
   * Status string → icon config { className, label, text }.
   * @type {Map<string, {className: string, label: string, text: string}>}
   */
  _statusIconMap: new Map([
    ['running',    { className: 'spinner',         label: 'Running',        text: '' }],
    ['complete',   { className: 'check',           label: 'Completed',      text: '✓' }],
    ['breakpoint', { className: 'breakpoint-icon', label: 'Breakpoint hit', text: '⏸' }],
    ['failed',     { className: 'error-icon',      label: 'Failed',         text: '✗' }],
  ]),

  /**
   * Render the full action log from State.actions into #action-log.
   * Replaces all existing content. Shows an empty-state placeholder
   * when no actions are available.
   */
  render() {
    const container = document.getElementById('action-log');
    if (!container) return;

    container.textContent = '';

    if (State.actions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';

      const icon = document.createElement('div');
      icon.className = 'empty-state-icon';
      icon.textContent = '📋';

      const text = document.createElement('div');
      text.className = 'empty-state-text';
      text.textContent = 'No actions yet. Run a journey to see live execution.';

      empty.appendChild(icon);
      empty.appendChild(text);
      container.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    State.actions.forEach((action) => {
      fragment.appendChild(ActionLog._createActionElement(action));
    });
    container.appendChild(fragment);
    ActionLog._scrollToBottom(container);
  },

  /**
   * Append a single new action item (called when a new action arrives).
   * Removes the empty-state placeholder if present and marks the
   * previous current item as no longer current.
   * @param {Object} action - Action descriptor { index, description, status }.
   */
  appendAction(action) {
    const container = document.getElementById('action-log');
    if (!container) return;

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const prev = container.querySelector('.action-item.current');
    if (prev) prev.classList.remove('current');

    const el = ActionLog._createActionElement(action);
    el.classList.add('action-item-enter');
    container.appendChild(el);
    ActionLog._scrollToBottom(container);
  },

  /**
   * Update an existing action item's status class and icon.
   * @param {number} index - Zero-based action index.
   * @param {string} status - 'complete' | 'breakpoint' | 'failed'.
   */
  updateAction(index, status) {
    const container = document.getElementById('action-log');
    if (!container) return;

    const el = container.querySelector(`.action-item[data-index="${index}"]`);
    if (!el) return;

    // Reset status classes and apply the new one
    el.classList.remove('current', 'completed', 'failed');
    const statusClass = ActionLog._statusClassMap.get(status);
    if (statusClass) el.classList.add(statusClass);

    // Replace the status icon element
    const statusEl = el.querySelector('.action-status');
    if (statusEl) {
      statusEl.textContent = '';
      const iconEl = ActionLog._createStatusIcon(status);
      if (iconEl) statusEl.appendChild(iconEl);
    }

    // Activate breakpoint pin visual when breakpoint is hit
    if (status === 'breakpoint') {
      const pin = el.querySelector('.breakpoint-pin');
      if (pin) pin.classList.add('active');
    }
  },

  /**
   * Clear all content from the action log.
   */
  clear() {
    const container = document.getElementById('action-log');
    if (!container) return;
    container.textContent = '';
  },

  /**
   * Insert a journey name header into the action log.
   * Removes the empty-state placeholder if present.
   * @param {string} journeyName - Display name of the journey.
   */
  insertJourneyHeader(journeyName) {
    const container = document.getElementById('action-log');
    if (!container) return;

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const header = document.createElement('div');
    header.className = 'journey-header';
    header.textContent = journeyName;
    container.appendChild(header);
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Create the DOM element for a single action item with breakpoint pin,
   * index label, description, and status icon.
   * @param {Object} action - Action descriptor { index, description, status }.
   * @returns {HTMLElement} The constructed action-item div.
   */
  _createActionElement(action) {
    const div = document.createElement('div');
    div.className = 'action-item';
    div.dataset.index = action.index;

    // Apply status class from map
    const statusClass = ActionLog._statusClassMap.get(action.status);
    if (statusClass) div.classList.add(statusClass);

    // Breakpoint pin button
    const pin = document.createElement('button');
    pin.className = 'breakpoint-pin';
    pin.dataset.index = action.index;
    pin.setAttribute('aria-label', 'Toggle breakpoint');

    if (typeof Breakpoints !== 'undefined' && Breakpoints.has(action.index)) {
      pin.classList.add('active');
    }

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof Breakpoints !== 'undefined') {
        Breakpoints.toggle(action.index);
      }
    });

    // Action index
    const indexSpan = document.createElement('span');
    indexSpan.className = 'action-index';
    indexSpan.textContent = action.index;

    // Action description
    const descSpan = document.createElement('span');
    descSpan.className = 'action-description';
    descSpan.textContent = action.description || '';

    // Action status icon
    const statusSpan = document.createElement('span');
    statusSpan.className = 'action-status';
    const iconEl = ActionLog._createStatusIcon(action.status);
    if (iconEl) statusSpan.appendChild(iconEl);

    div.appendChild(pin);
    div.appendChild(indexSpan);
    div.appendChild(descSpan);
    div.appendChild(statusSpan);

    return div;
  },

  /**
   * Create a status icon span element for the given action status.
   * Returns null for unknown statuses.
   * @param {string} status - Action status string.
   * @returns {HTMLSpanElement|null}
   */
  _createStatusIcon(status) {
    const config = ActionLog._statusIconMap.get(status);
    if (!config) return null;

    const span = document.createElement('span');
    span.className = config.className;
    span.setAttribute('aria-label', config.label);
    span.textContent = config.text;
    return span;
  },

  /**
   * Scroll the action log container to the bottom to show the latest action.
   * Uses the parent .tab-panel as the scrollable element.
   * @param {HTMLElement} container - The #action-log element.
   */
  _scrollToBottom(container) {
    const scrollable = container.closest('.tab-panel') || container;
    requestAnimationFrame(() => {
      scrollable.scrollTop = scrollable.scrollHeight;
    });
  },
};
