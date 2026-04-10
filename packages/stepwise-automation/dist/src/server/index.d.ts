import * as http from 'http';
import { ResolvedConfig } from '../config';
/**
 * Creates an Express server with REST API endpoints, WebSocket support,
 * and static file serving for the dashboard UI.
 *
 * @param config - Resolved stepwise config
 * @returns Object with `app`, `server`, and `start(port)` method
 */
export declare function createServer(config: ResolvedConfig): {
    app: import("express-serve-static-core").Express;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    start: (port: number) => Promise<void>;
};
//# sourceMappingURL=index.d.ts.map