/* global FSM_TRANSITIONS, FSM_BUTTONS, fsmTransition, fsmButtons */
/* eslint-disable no-unused-vars */

/**
 * Finite-state machine for the test runner toolbar.
 * Six states: idle, running, paused, stepping, completed, errored.
 * All transitions are deterministic — invalid events log a warning
 * and return the current state unchanged.
 * Exposed as globals — no imports, no modules.
 */

/**
 * State → event → next-state lookup table.
 * Each key is a valid FSM state; its value maps event names to the
 * resulting state.
 * @type {Record<string, Record<string, string>>}
 */
const FSM_TRANSITIONS = {
  idle:      { play: 'running' },
  running:   { pause: 'paused', breakpoint_hit: 'paused', finished: 'completed', failure: 'errored', stop: 'idle' },
  paused:    { resume: 'running', step: 'stepping', stop: 'idle', breakpoint_hit: 'paused' },
  stepping:  { step_complete_at_breakpoint: 'paused', step_complete_no_breakpoint: 'running', breakpoint_hit: 'paused' },
  completed: { play_again: 'idle' },
  errored:   { play_again: 'idle' },
};

/**
 * State → button-enabled flags.
 * Each key is a valid FSM state; its value indicates which toolbar
 * buttons should be enabled in that state.
 * @type {Record<string, Record<string, boolean>>}
 */
const FSM_BUTTONS = {
  idle:      { play: true,  stop: false, pause: false, resume: false, step: false },
  running:   { play: false, stop: true,  pause: true,  resume: false, step: false },
  paused:    { play: false, stop: true,  pause: false, resume: true,  step: true  },
  stepping:  { play: false, stop: true,  pause: false, resume: false, step: false },
  completed: { play: true,  stop: false, pause: false, resume: false, step: false },
  errored:   { play: true,  stop: false, pause: false, resume: false, step: false },
};

/**
 * Compute the next FSM state for a given event.
 * Returns the current state unchanged if the event is not valid
 * for the current state (and logs a warning).
 *
 * @param {string} current - The current FSM state.
 * @param {string} event - The event to process.
 * @returns {string} The resulting FSM state.
 */
function fsmTransition(current, event) {
  const next = FSM_TRANSITIONS[current]?.[event];
  if (next) return next;

  console.warn(`Invalid FSM transition: ${current} + ${event}`);
  return current;
}

/**
 * Return the button-enabled flags for a given FSM state.
 * Falls back to the idle button set for unknown states.
 *
 * @param {string} state - The current FSM state.
 * @returns {Record<string, boolean>} Map of button name → enabled.
 */
function fsmButtons(state) {
  return FSM_BUTTONS[state] || FSM_BUTTONS.idle;
}
