import express, { Request, Response, Application } from 'express';
import { EventBus, BaseEvent, EventType } from './events';
import { TweetClassifier } from './classifier';

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
  private config: SSEServerConfig;
  private server: ReturnType<Application['listen']> | null = null;
  private clientIdCounter: number = 0;

  constructor(eventBus: EventBus, config: Partial<SSEServerConfig> = {}) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventForwarding();
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
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      next();
    });

    // JSON body parser
    this.app.use(express.json());
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
      this.server = this.app.listen(this.config.port, () => {
        console.log(`SSE server listening on port ${this.config.port}`);
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
