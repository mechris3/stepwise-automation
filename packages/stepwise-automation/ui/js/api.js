/* global API */
/* eslint-disable no-unused-vars */

/**
 * REST API call wrappers for all server endpoints.
 * Uses fetch() with window.location.origin as base URL.
 * Exposed as a global — no imports, no modules.
 *
 * Every public method returns a Promise that resolves to the parsed JSON
 * response body, or rejects with an Error on non-2xx status codes or
 * network failures.
 */
const API = {
  /**
   * Send an HTTP request and return the parsed JSON response.
   * Non-2xx responses are converted to rejected promises with the
   * server-provided error message (or the HTTP status text as fallback).
   *
   * @param {string} method - HTTP method (GET, POST, PUT, PATCH, DELETE).
   * @param {string} path - URL path relative to origin (e.g. '/api/journeys').
   * @param {Object} [body] - Request body (omitted for GET/DELETE).
   * @returns {Promise<Object>} Parsed JSON response.
   * @throws {Error} On non-2xx status or network failure.
   */
  async _request(method, path, body) {
    try {
      const opts = { method, headers: {} };
      if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`${window.location.origin}${path}`, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API ${method} ${path} failed:`, err.message);
      throw err;
    }
  },

  /**
   * Fetch the list of discovered journeys.
   * @returns {Promise<{journeys: Array<{id: string, name: string}>}>}
   */
  async getJourneys() {
    return this._request('GET', '/api/journeys');
  },

  /**
   * Start a test run for the given journeys.
   * @param {string[]} journeys - Journey IDs to run.
   * @param {string} tool - Automation engine ('puppeteer' | 'playwright').
   * @param {Object} config - Runtime configuration (merged settings).
   * @returns {Promise<Object>}
   */
  async runTests(journeys, tool, config) {
    return this._request('POST', '/api/tests/run', { journeys, tool, config });
  },

  /**
   * Stop the current test execution.
   * @returns {Promise<Object>}
   */
  async stopTests() {
    return this._request('POST', '/api/tests/stop');
  },

  /**
   * Pause the current test execution.
   * @returns {Promise<Object>}
   */
  async pauseTests() {
    return this._request('POST', '/api/tests/pause');
  },

  /**
   * Resume a paused test execution.
   * @returns {Promise<Object>}
   */
  async resumeTests() {
    return this._request('POST', '/api/tests/resume');
  },

  /**
   * Step forward a given number of actions.
   * @param {number} count - Number of actions to step.
   * @returns {Promise<Object>}
   */
  async stepTests(count) {
    return this._request('POST', '/api/tests/step', { count });
  },

  /**
   * Set breakpoints for a journey (replaces any existing breakpoints).
   * @param {string} journey - Journey ID.
   * @param {number[]} breakpoints - Action indices to break on.
   * @returns {Promise<Object>}
   */
  async setBreakpoints(journey, breakpoints) {
    return this._request('POST', '/api/breakpoints', { journey, breakpoints });
  },

  /**
   * Get the current breakpoints for a journey.
   * @param {string} journey - Journey ID.
   * @returns {Promise<{breakpoints: number[]}>}
   */
  async getBreakpoints(journey) {
    return this._request('GET', `/api/breakpoints/${encodeURIComponent(journey)}`);
  },

  /**
   * Clear all breakpoints for a journey.
   * @param {string} journey - Journey ID.
   * @returns {Promise<Object>}
   */
  async deleteBreakpoints(journey) {
    return this._request('DELETE', `/api/breakpoints/${encodeURIComponent(journey)}`);
  },

  /**
   * Push a live config update to the server (while tests are running).
   * @param {Object} config - Updated configuration object.
   * @returns {Promise<Object>}
   */
  async updateConfig(config) {
    return this._request('PATCH', '/api/config', config);
  },

  /**
   * Auto-discover the Redux DevTools extension path on the local machine.
   * @returns {Promise<{path: string}>}
   */
  async getReduxDevToolsPath() {
    return this._request('GET', '/api/config/redux-devtools-path');
  },

  /**
   * Read persisted UI settings from the server.
   * @returns {Promise<Object>} The saved settings object.
   */
  async getSettings() {
    return this._request('GET', '/api/settings');
  },

  /**
   * Write UI settings to the server for persistence.
   * @param {Object} data - Settings object to save.
   * @returns {Promise<Object>}
   */
  async saveSettings(data) {
    return this._request('PUT', '/api/settings', data);
  },
};
