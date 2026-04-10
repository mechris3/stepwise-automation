/* global TestRunner, State, fsmTransition, UI, API */
/* eslint-disable no-unused-vars */

/**
 * Test runner orchestration — wires FSM transitions to API calls.
 * Handles the run / stop / pause / resume / step lifecycle.
 * Exposed as a global — no imports, no modules.
 *
 * On API failure the FSM transitions to the errored state (where applicable)
 * and the UI is refreshed so the user sees the change immediately.
 *
 * UX: Postel's Law — be liberal with input, handle errors gracefully.
 */
const TestRunner = {
  /**
   * Transition the FSM, refresh the UI, call an async API method, and
   * handle failure by moving to the errored state when `recoverOnError`
   * is true.
   *
   * @param {string} event - FSM event to fire before the API call.
   * @param {function(): Promise<void>} apiFn - The API call to execute.
   * @param {Object} [options]
   * @param {boolean} [options.recoverOnError=false] - Transition to 'failure' on catch.
   * @param {string} [options.errorMessage='API call failed'] - Console error prefix.
   */
  async _dispatch(event, apiFn, { recoverOnError = false, errorMessage = 'API call failed' } = {}) {
    State.fsmState = fsmTransition(State.fsmState, event);
    UI.refresh();

    try {
      await apiFn();
    } catch (err) {
      console.error(errorMessage + ':', err);
      if (recoverOnError) {
        State.fsmState = fsmTransition(State.fsmState, 'failure');
        UI.refresh();
      }
    }
  },

  /**
   * Run the currently selected journeys.
   * If no journeys are selected this is a no-op.
   * Resets completed/errored states back to idle before starting.
   */
  async run() {
    const journeys = [...State.selectedJourneys];
    if (journeys.length === 0) return;

    // Reset terminal states before starting a new run
    if (State.fsmState === 'completed' || State.fsmState === 'errored') {
      State.fsmState = fsmTransition(State.fsmState, 'play_again');
    }

    const config = { ...State.settings };
    if (config.targetUrl) {
      config.testDomain = config.targetUrl;
    }

    await TestRunner._dispatch('play', () => API.runTests(journeys, State.currentTool, config), {
      recoverOnError: true,
      errorMessage: 'Failed to start test run',
    });
  },

  /**
   * Stop the current test execution.
   * Does not transition to errored on failure — the stop itself is best-effort.
   */
  async stop() {
    await TestRunner._dispatch('stop', () => API.stopTests(), {
      errorMessage: 'Failed to stop tests',
    });
  },

  /**
   * Pause execution manually via the Pause button.
   * Does not transition to errored on failure — pause is best-effort.
   */
  async pause() {
    await TestRunner._dispatch('pause', () => API.pauseTests(), {
      errorMessage: 'Failed to pause tests',
    });
  },

  /**
   * Resume execution after a pause or breakpoint.
   * Transitions to errored if the API call fails.
   */
  async resume() {
    await TestRunner._dispatch('resume', () => API.resumeTests(), {
      recoverOnError: true,
      errorMessage: 'Failed to resume tests',
    });
  },

  /**
   * Step forward N actions (read from the #stepCount input, defaults to 1).
   * Transitions to errored if the API call fails.
   */
  async step() {
    const stepCountEl = document.getElementById('stepCount');
    const count = stepCountEl ? (parseInt(stepCountEl.value, 10) || 1) : 1;

    await TestRunner._dispatch('step', () => API.stepTests(count), {
      recoverOnError: true,
      errorMessage: 'Failed to step tests',
    });
  },
};
