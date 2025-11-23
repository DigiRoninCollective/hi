import express, { Request, Response, Application, Router } from 'express';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { EventBus, BaseEvent, EventType } from './events';
import { TweetClassifier } from './classifier';
import { PumpPortalService } from './pumpportal';

interface SSEClient {
  id: string;
  response: Response;
  eventTypes: EventType[] | 'all';
}

export interface SSEServerConfig {
  port: number;
  corsOrigin: string;
}

const DEFAULT_CONFIG: SSEServerConfig = {
  port: 3000,
  corsOrigin: '*',
};

/**
 * SSE Server for real-time event streaming to clients
 */
export class SSEServer {
  private app: Application;
  private clients: Map<string, SSEClient> = new Map();
  private eventBus: EventBus;
  private classifier: TweetClassifier | null = null;
  private pumpPortal: PumpPortalService | null = null;
  private config: SSEServerConfig;
  private server: ReturnType<Application['listen']> | null = null;
  private clientIdCounter: number = 0;
  private apiRouter: Router | null = null;
  private authRouter: Router | null = null;

  constructor(eventBus: EventBus, config: Partial<SSEServerConfig> = {}) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventForwarding();
  }

  /**
   * Set the PumpPortal service for API routes
   */
  setPumpPortal(pumpPortal: PumpPortalService): void {
    this.pumpPortal = pumpPortal;
  }

  /**
   * Set custom API routes
   */
  setApiRouter(router: Router): void {
    this.apiRouter = router;
    this.app.use('/api', router);
  }

  /**
   * Set auth routes
   */
  setAuthRouter(router: Router): void {
    this.authRouter = router;
    this.app.use('/api/auth', router);
  }

  /**
   * Set alpha aggregator routes
   */
  setAlphaRouter(router: Router): void {
    this.app.use('/api/alpha', router);
  }

  /**
   * Set the classifier for stats endpoint
   */
  setClassifier(classifier: TweetClassifier): void {
    this.classifier = classifier;
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', this.config.corsOrigin);
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // JSON body parser with larger limit for image uploads
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser for session management
    this.app.use(cookieParser());

    // Serve uploaded files
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

    // Serve static frontend files (production)
    const webDistPath = path.join(process.cwd(), 'web', 'dist');
    this.app.use(express.static(webDistPath));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        clients: this.clients.size,
      });
    });

    // Get event history
    this.app.get('/api/events', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const type = req.query.type as EventType | undefined;

      let events: BaseEvent[];
      if (type) {
        events = this.eventBus.getEventsByType(type, limit);
      } else {
        events = this.eventBus.getHistory(limit);
      }

      res.json({ events });
    });

    // Get classifier stats
    this.app.get('/api/stats', (req, res) => {
      const stats = this.classifier?.getStats() || {
        processed: 0,
        launches: 0,
        spam: 0,
        launchRate: 0,
        spamRate: 0,
      };

      res.json({
        classifier: stats,
        connections: this.clients.size,
        uptime: process.uptime(),
      });
    });

    // SSE endpoint - stream all events
    this.app.get('/events', (req, res) => {
      this.handleSSEConnection(req, res, 'all');
    });

    // SSE endpoint - stream specific event types
    this.app.get('/events/:types', (req, res) => {
      const types = req.params.types.split(',') as EventType[];
      this.handleSSEConnection(req, res, types);
    });

    // Manual event emission (for testing)
    this.app.post('/api/emit', (req, res) => {
      const { type, data } = req.body;

      if (!type || !data) {
        return res.status(400).json({ error: 'Missing type or data' });
      }

      const event = this.eventBus.emit(type, data);
      res.json({ success: true, event });
    });
  }

  /**
   * Handle SSE connection
   */
  private handleSSEConnection(
    req: Request,
    res: Response,
    eventTypes: EventType[] | 'all'
  ): void {
    const clientId = `client_${++this.clientIdCounter}_${Date.now()}`;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection event
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

    // Store client
    const client: SSEClient = {
      id: clientId,
      response: res,
      eventTypes,
    };
    this.clients.set(clientId, client);

    console.log(`SSE client connected: ${clientId} (total: ${this.clients.size})`);

    // Emit connection event
    this.eventBus.emit(EventType.ALERT_INFO, {
      title: 'Client Connected',
      message: `SSE client ${clientId} connected`,
      metadata: { clientId, eventTypes },
    });

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`: heartbeat\n\n`);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      this.clients.delete(clientId);
      console.log(`SSE client disconnected: ${clientId} (total: ${this.clients.size})`);
    });
  }

  /**
   * Setup event forwarding to SSE clients
   */
  private setupEventForwarding(): void {
    this.eventBus.onAll((event) => {
      this.broadcastEvent(event);
    });
  }

  /**
   * Broadcast event to relevant SSE clients
   */
  private broadcastEvent(event: BaseEvent): void {
    const eventData = JSON.stringify(event);

    for (const [clientId, client] of this.clients) {
      // Check if client wants this event type
      if (client.eventTypes !== 'all' && !client.eventTypes.includes(event.type)) {
        continue;
      }

      // Try to send event
      try {
        if (!client.response.writableEnded) {
          client.response.write(`event: ${event.type}\n`);
          client.response.write(`data: ${eventData}\n\n`);
        }
      } catch (error) {
        console.error(`Failed to send event to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Start the SSE server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      // Add SPA fallback route (must be last)
      const webDistPath = path.join(process.cwd(), 'web', 'dist');
      const indexPath = path.join(webDistPath, 'index.html');
      this.app.get('*', (req, res) => {
        // Don't serve index.html for API or events routes
        if (req.path.startsWith('/api') || req.path.startsWith('/events') || req.path.startsWith('/health')) {
          return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(indexPath, (err) => {
          if (err) {
            res.status(200).send(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>PumpFun Launcher</title>
                  <style>
                    body { font-family: system-ui; background: #0d0d0d; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .container { text-align: center; }
                    h1 { color: #22c55e; }
                    p { color: #888; }
                    a { color: #22c55e; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>PumpFun Launcher API</h1>
                    <p>Backend is running. Build the frontend to see the UI.</p>
                    <p>Run: <code>cd web && npm install && npm run build</code></p>
                    <p><a href="/health">Health Check</a> | <a href="/api/stats">Stats</a></p>
                  </div>
                </body>
              </html>
            `);
          }
        });
      });

      this.server = this.app.listen(this.config.port, () => {
        console.log(`SSE server listening on port ${this.config.port}`);
        console.log(`  Web UI: http://localhost:${this.config.port}`);
        console.log(`  Health check: http://localhost:${this.config.port}/health`);
        console.log(`  Events stream: http://localhost:${this.config.port}/events`);
        console.log(`  Stats API: http://localhost:${this.config.port}/api/stats`);

        this.eventBus.emit(EventType.SYSTEM_STARTED, {
          component: 'sse-server',
          port: this.config.port,
        });

        resolve();
      });
    });
  }

  /**
   * Stop the SSE server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all client connections
      for (const [clientId, client] of this.clients) {
        try {
          client.response.end();
        } catch (error) {
          // Ignore errors during shutdown
        }
      }
      this.clients.clear();

      // Close server
      if (this.server) {
        this.server.close(() => {
          console.log('SSE server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Express app (for testing or custom routes)
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
