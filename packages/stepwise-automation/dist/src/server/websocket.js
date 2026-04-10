"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const ws_1 = require("ws");
/**
 * Manages WebSocket connections and broadcasts messages to all connected clients.
 * Automatically cleans up dead connections on send failure or close/error events.
 */
class WebSocketManager {
    wss;
    clients = new Set();
    /**
     * Attaches a WebSocket server to the given HTTP server.
     *
     * @param server - The Node.js HTTP server to bind to
     */
    constructor(server) {
        this.wss = new ws_1.WebSocketServer({ server });
        this.wss.on('connection', (ws) => {
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
    broadcast(data) {
        const payload = JSON.stringify(data);
        for (const client of this.clients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                try {
                    client.send(payload);
                }
                catch {
                    this.clients.delete(client);
                }
            }
            else {
                this.clients.delete(client);
            }
        }
    }
    /**
     * Returns the number of connected clients.
     */
    getClientCount() {
        return this.clients.size;
    }
}
exports.WebSocketManager = WebSocketManager;
//# sourceMappingURL=websocket.js.map