/* global Breakpoints, State, API */
/* eslint-disable no-unused-vars */

/**
 * Breakpoint management — toggle on pin click, server-side file persistence
 * per journey via the REST API.
 * Exposed as a global — no imports, no modules.
 */
const Breakpoints = {
  /**
   * Toggle a breakpoint at the given action index for the current journey.
   * Updates State, the visual pin, and syncs to the server.
   * No-ops if no journey is currently active.
   * @param {number} index - Zero-based action index.
   */
  toggle(index) {
    const journeyId = State.currentJourney;
    if (!journeyId) return;

    if (!State.breakpoints[journeyId]) {
      State.breakpoints[journeyId] = new Set();
    }

    const bp = State.breakpoints[journeyId];

    if (bp.has(index)) {
      bp.delete(index);
    } else {
      bp.add(index);
    }

    Breakpoints._updatePinVisual(index, bp.has(index));
    Breakpoints.save(journeyId);
    Breakpoints.sync(journeyId);
  },

  /**
   * Load breakpoints from the server for a journey and refresh pin visuals.
   * Populates State.breakpoints[journeyId] with the returned set.
   * Falls back to an empty set on error or when the API is unavailable.
   * @param {string} journeyId - Journey to load breakpoints for.
   */
  async load(journeyId) {
    if (!journeyId) return;

    if (typeof API === 'undefined' || !API.getBreakpoints) {
      State.breakpoints[journeyId] = new Set();
      return;
    }

    try {
      const data = await API.getBreakpoints(journeyId);
      State.breakpoints[journeyId] = data && Array.isArray(data.breakpoints)
        ? new Set(data.breakpoints)
        : new Set();
    } catch (err) {
      console.error('Failed to load breakpoints from server:', err);
      State.breakpoints[journeyId] = new Set();
    }

    Breakpoints.refreshAllPins();
  },

  /**
   * Save breakpoints for a journey to the server.
   * Delegates to {@link sync} — exists as a semantic alias for callers
   * that think in terms of "save" rather than "sync".
   * @param {string} journeyId - Journey to save breakpoints for.
   */
  save(journeyId) {
    Breakpoints.sync(journeyId);
  },

  /**
   * Send current breakpoints for a journey to the server via the API.
   * No-ops if the API is unavailable or journeyId is falsy.
   * @param {string} journeyId - Journey to sync breakpoints for.
   */
  sync(journeyId) {
    if (!journeyId) return;

    const bp = State.breakpoints[journeyId];
    const indices = bp ? [...bp] : [];

    if (typeof API !== 'undefined' && API.setBreakpoints) {
      API.setBreakpoints(journeyId, indices).catch((err) => {
        console.error('Failed to sync breakpoints to server:', err);
      });
    }
  },

  /**
   * Check if a breakpoint is set at the given index for the current journey.
   * @param {number} index - Zero-based action index.
   * @returns {boolean} True if a breakpoint exists at this index.
   */
  has(index) {
    return State.breakpoints[State.currentJourney]?.has(index) ?? false;
  },

  /**
   * Refresh all breakpoint pin visuals in the DOM.
   * Called after an async load completes to sync pin state with loaded data.
   */
  refreshAllPins() {
    document.querySelectorAll('.breakpoint-pin[data-index]').forEach((pin) => {
      const index = parseInt(pin.dataset.index, 10);
      pin.classList.toggle('active', Breakpoints.has(index));
    });
  },

  /**
   * Clear all breakpoints for a journey (backend-first).
   * Disables the clear button during the request and re-enables it
   * on completion regardless of success or failure.
   * @param {string} journeyId - Journey to clear breakpoints for.
   */
  async clearAll(journeyId) {
    if (!journeyId) return;

    const btn = document.getElementById('clearBreakpointsBtn');
    if (btn) btn.disabled = true;

    try {
      await API.deleteBreakpoints(journeyId);
      State.breakpoints[journeyId] = new Set();
      Breakpoints.refreshAllPins();
    } catch (err) {
      console.error('Failed to clear breakpoints:', err);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Update the visual state of a single breakpoint pin in the DOM.
   * @param {number} index - Zero-based action index.
   * @param {boolean} active - Whether the breakpoint is active.
   */
  _updatePinVisual(index, active) {
    const pin = document.querySelector(
      `.breakpoint-pin[data-index="${index}"]`
    );
    if (!pin) return;

    pin.classList.toggle('active', active);
  },
};
