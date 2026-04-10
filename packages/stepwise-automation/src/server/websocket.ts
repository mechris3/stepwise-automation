import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';

/** WebSocket message type discriminator. */
export type WebSocketMessageType =
  | 'run-start'
  | 'run-end'
  | 'test-start'
  | 'test-end'
  | 'log'
  | 'error'
  | 'journeys';

/** Broadcast when a batch run begins. */
export interface RunStartMessage {
  type: 'run-start';
  journeys: string[];
  tool: 'puppeteer' | 'playwright';
}

/** Broadcast when a batch run completes (all journeys finished or stopped). */
export interface RunEndMessage {
  type: 'run-end';
  results: Array<{ journey: string; status: 'passed' | 'failed' }>;
}

/** Broadcast when a single journey starts executing. */
export interface TestStartMessage {
  type: 'test-start';
  journey: string;
  tool: 'puppeteer' | 'playwright';
}

/** Broadcast when a single journey finishes (passed or failed). */
export interface TestEndMessage {
  type: 'test-end';
  journey: string;
  tool: 'puppeteer' | 'playwright';
  status: 'passed' | 'failed';
  duration: string;
}

/** Broadcast for stdout log output from a running journey. */
export interface LogMessage {
  type: 'log';
  message: string;
  journey?: string;
  tool?: string;
}

/** Broadcast for stderr output (including `[JSON]`-prefixed structured messages). */
export interface ErrorMessage {
  type: 'error';
  message: string;
  journey?: string;
  tool?: string;
}

/** Broadcast containing the list of discovered journeys. */
export interface JourneysMessage {
  type: 'journeys';
  journeys: Array<{ id: string; name: string }>;
}

/** Union of all WebSocket message types. */
export type WSMessage =
  | RunStartMessage
  | RunEndMessage
  | TestStartMessage
  | TestEndMessage
  | LogMessage
  | ErrorMessage
  | JourneysMessage;

/**
 * Manages WebSocket connections and broadcasts messages to all connected clients.
 * Automatically cleans up dead connections on send failure or close/error events.
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  /**
   * Attaches a WebSocket server to the given HTTP server.
   *
   * @param server - The Node.js HTTP server to bind to
   */
  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Broadcasts a message to all connected clients.
   * Removes dead connections encountered during broadcast.
   *
   * @param data - The typed message payload to send
   */
  broadcast(data: WSMessage): void {
    const payload = JSON.stringify(data);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch {
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Returns the number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
