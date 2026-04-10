/* global WebSocketClient, State, fsmTransition, UI */
/* eslint-disable no-unused-vars */

/**
 * WebSocket client for the Stepwise Automation UI.
 *
 * Manages the full connection lifecycle (connect, disconnect, auto-reconnect)
 * and routes incoming server messages to the appropriate handlers via a
 * lookup Map. All DOM mutations use safe APIs (createElement, textContent)
 * to prevent XSS.
 *
 * Depends on the following globals:
 *  - State       — shared application state
 *  - fsmTransition — finite-state-machine transition function
 *  - UI          — UI renderer (optional, calls UI.refresh() when present)
 *  - ActionLog   — action log panel controller (optional)
 *  - Breakpoints — breakpoint persistence manager (optional)
 */
const WebSocketClient = {
  /** @type {number|null} Handle for the pending reconnect timer. */
  _reconnectTimer: null,

  /** @type {number} Milliseconds to wait before attempting reconnection. */
  _reconnectDelay: 3000,

  /**
   * Open a WebSocket connection to the server.
   * No-ops if a connection is already open. Registers listeners for open,
   * message, close, and error events, and stores the socket on State.ws.
   */
  connect() {
    if (State.ws && State.ws.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket('ws://' + window.location.host);

    ws.addEventListener('open', () => {
      WebSocketClient._updateConnectionStatus(true);
    });

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        WebSocketClient.onMessage(data);
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    });

    ws.addEventListener('close', () => {
      WebSocketClient._updateConnectionStatus(false);
      WebSocketClient.reconnect();
    });

    ws.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
    });

    State.ws = ws;
  },

  /**
   * Tear down the WebSocket connection and cancel any pending reconnect.
   */
  disconnect() {
    if (WebSocketClient._reconnectTimer) {
      clearTimeout(WebSocketClient._reconnectTimer);
      WebSocketClient._reconnectTimer = null;
    }
    if (State.ws) {
      State.ws.close();
      State.ws = null;
    }
  },

  /**
   * Lookup table that maps incoming message `type` strings to handler functions.
   * Each handler receives the full parsed message object.
   *
   * Supported types: run-start, run-end, test-start, test-end, log, error, journeys.
   * @type {Map<string, function(Object): void>}
   */
  _messageHandlers: new Map([
    ['run-start', (_data) => {
      State.actions = [];
      State.testResults = [];
      State.currentActionIndex = 0;
      WebSocketClient._lastConsoleJourney = null;
      const consoleEl = document.getElementById('console-output');
      if (consoleEl) consoleEl.textContent = '';
      if (State.fsmState !== 'running') {
        State.fsmState = fsmTransition(State.fsmState, 'play');
      }
    }],

    ['run-end', (data) => {
      if (data.results && data.results.some((r) => r.status === 'failed')) {
        State.fsmState = fsmTransition(State.fsmState, 'failure');
      } else {
        State.fsmState = fsmTransition(State.fsmState, 'finished');
      }
      State.testResults = data.results || [];
    }],

    ['test-start', (data) => {
      State.actions = [];
      State.currentActionIndex = 0;
      if (typeof ActionLog !== 'undefined') {
        ActionLog.clear();
        ActionLog.insertJourneyHeader(data.journey);
      }
      const consoleEl = document.getElementById('console-output');
      if (consoleEl) consoleEl.textContent = '';
      WebSocketClient._lastConsoleJourney = null;
      WebSocketClient._insertConsoleSeparator(data.journey);
      State.currentJourney = data.journey;
      if (typeof Breakpoints !== 'undefined' && Breakpoints.load) {
        Breakpoints.load(data.journey);
      }
    }],

    ['test-end', (data) => {
      const exists = State.testResults.some((r) => r.journey === data.journey);
      if (exists) {
        State.testResults = State.testResults.map((r) =>
          r.journey === data.journey
            ? { ...r, status: data.status, duration: data.duration }
            : r
        );
      } else {
        State.testResults = [...State.testResults, {
          journey: data.journey,
          status: data.status,
          duration: data.duration,
        }];
      }
    }],

    ['log', (data) => {
      WebSocketClient._appendConsole(data.message);
    }],

    ['error', (data) => {
      WebSocketClient._parseAndRouteError(data.message);
    }],

    ['journeys', (data) => {
      State.journeys = (data.journeys || []).map((j) => ({
        id: j.id,
        name: j.name,
      }));
    }],
  ]),

  /**
   * Route an incoming server message to the appropriate handler.
   * Falls back to a console warning for unrecognised types.
   * Always triggers a UI refresh after handling.
   * @param {Object} data - Parsed message with at least a `type` property.
   */
  onMessage(data) {
    const handler = WebSocketClient._messageHandlers.get(data.type);
    if (handler) {
      handler(data);
    } else {
      console.warn('Unknown WS message type:', data.type);
    }
    if (typeof UI !== 'undefined') UI.refresh();
  },

  /**
   * Schedule a reconnection attempt after {@link _reconnectDelay} ms.
   * No-ops if a reconnect is already pending.
   */
  reconnect() {
    if (WebSocketClient._reconnectTimer) return;
    WebSocketClient._reconnectTimer = setTimeout(() => {
      WebSocketClient._reconnectTimer = null;
      WebSocketClient.connect();
    }, WebSocketClient._reconnectDelay);
  },

  // ---------------------------------------------------------------------------
  // Internal helpers — DOM updates, console output, error parsing
  // ---------------------------------------------------------------------------

  /**
   * Rebuild the connection-status indicator in the page footer.
   * Uses safe DOM APIs (createElement / textContent) to avoid innerHTML.
   * @param {boolean} connected - Whether the socket is currently open.
   */
  _updateConnectionStatus(connected) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    el.textContent = '';
    const dot = document.createElement('span');
    dot.className = 'connection-dot';
    dot.setAttribute('aria-hidden', 'true');
    el.appendChild(dot);
    if (connected) {
      el.className = 'connection-indicator connected';
      el.appendChild(document.createTextNode(' Connected'));
    } else {
      el.className = 'connection-indicator disconnected';
      el.appendChild(document.createTextNode(' Disconnected'));
    }
  },

  /**
   * Ordered list of syntax-highlighting rules applied to console output.
   * Each rule maps a regex to a CSS class. Rules are evaluated in order and
   * the first match at any position wins (overlapping matches are discarded).
   * @type {Array<{regex: RegExp, className: string}>}
   */
  _highlightRules: [
    { regex: /((?:[a-zA-Z]:\\|[~.\/])[\w\d\s.\/\\-]+\.(?:js|ts|py|java|rb|php|css|html|json)(?::\d+){0,2})/g, className: 'console-filepath' },
    { regex: /\b(Error|ERR|FAIL|Exception|FAILED|stack\strace)\b/gi, className: 'console-error' },
    { regex: /\b(Warning|WARN|Potentially|Slow|Pending)\b/gi, className: 'console-warning' },
    { regex: /([✓✔]|PASS|Success|Passed|Completed)/g, className: 'console-success' },
  ],

  /**
   * Apply {@link _highlightRules} to a plain-text line and return a
   * DocumentFragment containing text nodes and highlighted `<span>` elements.
   * All text is set via `textContent`, so the output is XSS-safe.
   * @param {string} text - Raw log line (unescaped).
   * @returns {DocumentFragment}
   */
  _classifyLine(text) {
    const frag = document.createDocumentFragment();

    // Collect all matches across all rules
    const matches = WebSocketClient._highlightRules.flatMap((rule) => {
      rule.regex.lastIndex = 0;
      const ruleMatches = [];
      let m;
      while ((m = rule.regex.exec(text)) !== null) {
        ruleMatches.push({ start: m.index, end: m.index + m[0].length, text: m[0], className: rule.className });
      }
      return ruleMatches;
    });

    // Sort by position, then remove overlaps (first match wins)
    matches.sort((a, b) => a.start - b.start);
    const filtered = matches.reduce((acc, m) => {
      const lastEnd = acc.length > 0 ? acc[acc.length - 1].end : 0;
      if (m.start >= lastEnd) acc.push(m);
      return acc;
    }, []);

    // Build fragment: plain text between matches, spans for matches
    let cursor = 0;
    filtered.forEach((m) => {
      if (m.start > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
      }
      const span = document.createElement('span');
      span.className = m.className;
      span.textContent = m.text;
      frag.appendChild(span);
      cursor = m.end;
    });
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }

    return frag;
  },

  /**
   * Name of the last journey written to the console panel.
   * Used to detect journey changes and insert visual separators.
   * @type {string|null}
   */
  _lastConsoleJourney: null,

  /**
   * Append a syntax-highlighted log line to the `#console-output` element.
   * Inserts a journey separator when the active journey changes.
   * Auto-scrolls to the bottom only if the user hasn't scrolled up.
   * @param {string} message - Raw log text to display.
   */
  _appendConsole(message) {
    var el = document.getElementById('console-output');
    if (!el) return;

    // The scrollable element is the parent .tab-panel
    var scrollable = el.closest('.tab-panel') || el;

    // Preserve scroll position — only auto-scroll if user is at the bottom
    var atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 20;

    // Journey grouping: insert separator when journey changes
    const currentJourney = (typeof State !== 'undefined') ? State.currentJourney : null;
    if (currentJourney && WebSocketClient._lastConsoleJourney &&
        currentJourney !== WebSocketClient._lastConsoleJourney) {
      const sep = document.createElement('div');
      sep.className = 'console-journey-separator';
      el.appendChild(sep);
    }
    if (currentJourney) {
      WebSocketClient._lastConsoleJourney = currentJourney;
    }

    const classified = WebSocketClient._classifyLine(message);
    el.appendChild(classified);
    el.appendChild(document.createTextNode('\n'));

    if (atBottom) {
      scrollable.scrollTop = scrollable.scrollHeight;
    }
  },

  /**
   * Insert a journey-name heading into the console output panel.
   * @param {string} journeyName - Display name of the journey.
   */
  _insertConsoleSeparator(journeyName) {
    const el = document.getElementById('console-output');
    if (!el) return;

    const separator = document.createElement('div');
    separator.className = 'console-journey-name';
    separator.textContent = journeyName;
    el.appendChild(separator);
  },

  /**
   * Parse an error string from the server. Segments prefixed with `[JSON]`
   * are extracted, parsed, and forwarded to {@link _handleActionPayload}.
   * If no JSON segments are found the raw message is appended to the console.
   * @param {string} message - Raw error text, possibly containing [JSON] blocks.
   */
  _parseAndRouteError(message) {
    if (!message) return;
    // Extract and trim non-empty segments that follow [JSON] prefixes
    const jsonSegments = message.split('[JSON]').slice(1)
      .map((s) => s.trim())
      .filter(Boolean);

    let hasJson = false;
    jsonSegments.forEach((raw) => {
      try {
        const payload = JSON.parse(raw);
        hasJson = true;
        WebSocketClient._handleActionPayload(payload);
      } catch (err) {
        console.error('Failed to parse [JSON] payload:', err);
      }
    });

    // Append the raw message to console if no JSON payloads were found
    if (!hasJson) {
      WebSocketClient._appendConsole(message);
    }
  },

  /**
   * Handlers for `payload.type === 'action'`, keyed by `payload.status`.
   * Manages action lifecycle transitions (start → running, complete, breakpoint).
   * @type {Map<string, function(Object): void>}
   */
  _actionStatusHandlers: new Map([
    ['start', (payload) => {
      State.actions = [...State.actions, {
        index: payload.index,
        description: payload.description,
        status: 'running',
      }];
      State.currentActionIndex = payload.index;
    }],
    ['complete', (payload) => {
      State.actions = State.actions.map((a) =>
        a.index === payload.index ? { ...a, status: 'complete' } : a
      );
    }],
    ['breakpoint', (payload) => {
      State.actions = State.actions.map((a) =>
        a.index === payload.index ? { ...a, status: 'breakpoint' } : a
      );
      State.fsmState = fsmTransition(State.fsmState, 'breakpoint_hit');
    }],
  ]),

  /**
   * Handlers for `payload.type === 'ui-control'`, keyed by `payload.action`.
   * Drives FSM transitions for pause/resume commands from the server.
   * @type {Map<string, function(Object): void>}
   */
  _uiControlHandlers: new Map([
    ['pause', () => {
      State.fsmState = fsmTransition(State.fsmState, 'breakpoint_hit');
    }],
    ['resume', () => {
      State.fsmState = fsmTransition(State.fsmState, 'resume');
    }],
  ]),

  /**
   * Dispatch a parsed JSON action payload (received via stderr) to the
   * appropriate handler Map based on `payload.type`.
   * @param {Object} payload - Parsed action object with `type` and status/action fields.
   */
  _handleActionPayload(payload) {
    if (payload.type === 'action') {
      const handler = WebSocketClient._actionStatusHandlers.get(payload.status);
      if (handler) handler(payload);
      return;
    }

    if (payload.type === 'ui-control') {
      const handler = WebSocketClient._uiControlHandlers.get(payload.action);
      if (handler) handler(payload);
    }
  },
};
