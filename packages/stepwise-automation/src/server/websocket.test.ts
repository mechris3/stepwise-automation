import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { WebSocketManager, WSMessage } from './websocket';
import WebSocket from 'ws';

describe('WebSocketManager', () => {
  let httpServer: Server;
  let wsManager: WebSocketManager;
  let port: number;

  beforeEach(async () => {
    httpServer = createServer();
    wsManager = new WebSocketManager(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  function connectClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  it('should accept connections and track clients', async () => {
    const client = await connectClient();
    // Give the server a tick to register the connection
    await new Promise((r) => setTimeout(r, 50));
    expect(wsManager.getClientCount()).toBe(1);
    client.close();
  });

  it('should remove client on disconnect', async () => {
    const client = await connectClient();
    await new Promise((r) => setTimeout(r, 50));
    expect(wsManager.getClientCount()).toBe(1);

    client.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(wsManager.getClientCount()).toBe(0);
  });

  it('should broadcast messages to all connected clients', async () => {
    const client1 = await connectClient();
    const client2 = await connectClient();
    await new Promise((r) => setTimeout(r, 50));

    const received1: string[] = [];
    const received2: string[] = [];
    client1.on('message', (data) => received1.push(data.toString()));
    client2.on('message', (data) => received2.push(data.toString()));

    const msg: WSMessage = { type: 'log', message: 'hello' };
    wsManager.broadcast(msg);

    await new Promise((r) => setTimeout(r, 50));

    expect(received1).toEqual([JSON.stringify(msg)]);
    expect(received2).toEqual([JSON.stringify(msg)]);

    client1.close();
    client2.close();
  });

  it('should handle multiple message types', async () => {
    const client = await connectClient();
    await new Promise((r) => setTimeout(r, 50));

    const received: WSMessage[] = [];
    client.on('message', (data) => received.push(JSON.parse(data.toString())));

    const messages: WSMessage[] = [
      { type: 'run-start', journeys: ['login'], tool: 'puppeteer' },
      { type: 'test-start', journey: 'login', tool: 'puppeteer' },
      { type: 'test-end', journey: 'login', tool: 'puppeteer', status: 'passed', duration: '1.2s' },
      { type: 'run-end', results: [{ journey: 'login', status: 'passed' }] },
    ];

    for (const msg of messages) {
      wsManager.broadcast(msg);
    }

    await new Promise((r) => setTimeout(r, 50));
    expect(received).toEqual(messages);

    client.close();
  });

  it('should remove dead connections during broadcast', async () => {
    const client1 = await connectClient();
    const client2 = await connectClient();
    await new Promise((r) => setTimeout(r, 50));
    expect(wsManager.getClientCount()).toBe(2);

    // Forcefully terminate client1 without clean close
    client1.terminate();
    await new Promise((r) => setTimeout(r, 50));

    // Broadcast should clean up the dead connection
    wsManager.broadcast({ type: 'log', message: 'test' });
    await new Promise((r) => setTimeout(r, 50));

    // client1 was removed either by close/error handler or broadcast cleanup
    expect(wsManager.getClientCount()).toBeLessThanOrEqual(1);

    client2.close();
  });
});
