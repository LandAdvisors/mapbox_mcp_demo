import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MCPServer } from './services/mcp-server';
import { mapboxTools } from './services/mapbox-tools';
import { MCPRequest, MCPToolResult } from './types/mcp';
import { streamSSE } from 'hono/streaming';


type Env = {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  MAPBOX_ACCESS_TOKEN: string;
  ASSETS: any; // Cloudflare Assets binding
};

const app = new Hono<{ Bindings: Env }>();

// Apply CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

// API routes FIRST - before any catch-all routes
// MCP API routes
app.post('/api/mcp/chat', async (c) => {
  try {
    const env = c.env;
    const requestBody = await c.req.json<MCPRequest>();

    // Use environment variable OPENAI_API_KEY
    const openaiKey = env.OPENAI_API_KEY;
    // Initialize MCP server with API keys and tools
    const mcpServer = new MCPServer(
      openaiKey,
      env.ANTHROPIC_API_KEY,
      mapboxTools
    );

    // Process the request with the real API
    const response = await mcpServer.processRequest(requestBody);

    return c.json(response);
  } catch (error) {
    console.error('Error processing MCP chat request:', error);
    return c.json({
      id: 'error_id',
      message: 'Failed to process chat request. Check server logs for details.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/mcp/tool-results', async (c) => {
  try {
    const env = c.env;
    const { requestId, results, originalMessage, model } = await c.req.json<{
      requestId: string;
      results: MCPToolResult[];
      originalMessage: string;
      model?: string;
    }>();

    // Use environment variable OPENAI_API_KEY
    const openaiKey = env.OPENAI_API_KEY;

    // Initialize MCP server with API keys
    const mcpServer = new MCPServer(
      openaiKey,
      env.ANTHROPIC_API_KEY
    );

    // Process tool results with the real API
    const response = await mcpServer.processToolResults(
      requestId,
      results,
      originalMessage,
      model
    );

    return c.json(response);
  } catch (error) {
    console.error('Error processing MCP tool results:', error);
    return c.json({
      id: 'error_id',
      message: 'Failed to process tool results. Check server logs for details.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Environment information endpoint for frontend
app.get('/api/mapbox-config', (c) => {
  // Use a fallback public token for development purposes
  const mapboxToken = c.env.MAPBOX_ACCESS_TOKEN;

  return c.json({
    mapboxToken: mapboxToken
  });
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok' });
});

// MCP SSE endpoint for MCP clients
app.get('/sse', async (c) => {
  // Send SSE stream
  return streamSSE(c, async (stream) => {
    let clientId = crypto.randomUUID();

    // Send connected event
    await stream.writeSSE({
      data: JSON.stringify({
        type: 'connected',
        client_id: clientId
      }),
      event: 'message'
    });

    // Handle client disconnect
    c.req.raw.signal.addEventListener('abort', () => {
      console.log(`Client ${clientId} disconnected`);
    });

    // Keep the connection alive
    const interval = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'ping' }),
          event: 'message'
        });
      } catch (e) {
        clearInterval(interval);
      }
    }, 30000);

    // Keep the stream open
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (c.req.raw.signal.aborted) {
        clearInterval(interval);
        break;
      }
    }
  });
});

// MCP tools listing endpoint
app.get('/tools', (c) => {
  return c.json({
    tools: mapboxTools
  });
});

// MCP tool invocation endpoint
app.post('/invoke', async (c) => {
  try {
    const env = c.env;
    const { name, input, client_id } = await c.req.json();

    console.log(`Tool invocation from client ${client_id}: ${name}`);

    // Use environment variable for OpenAI API key
    const openaiKey = env.OPENAI_API_KEY;

    // Initialize MCP server with API keys and tools
    const mcpServer = new MCPServer(
      openaiKey,
      env.ANTHROPIC_API_KEY,
      mapboxTools
    );

    // Look up the tool by name
    const tool = mapboxTools.find(t => t.name === name);
    if (!tool) {
      return c.json({
        error: `Tool '${name}' not found`
      }, 404);
    }

    // Process the tool invocation based on its type
    let result;

    switch (name) {
      case 'map_initialize':
        result = {
          center: input.center || [-74.5, 40],
          zoom: input.zoom || 9,
          style: input.style || 'mapbox://styles/mapbox/streets-v12',
          success: true
        };
        break;
      case 'map_move':
        result = {
          center: input.center,
          zoom: input.zoom,
          success: true
        };
        break;
      case 'map_add_layer':
        result = {
          id: input.id,
          type: input.type,
          success: true
        };
        break;
      case 'map_remove_layer':
        result = {
          id: input.id,
          success: true
        };
        break;
      case 'map_get_features':
        result = {
          point: input.point,
          features: [],
          success: true
        };
        break;
      case 'map_search':
        try {
          // If we had a backend geocoding service, we would use it here
          // For now, we'll just return a successful response and let the client handle it
          result = {
            query: input.query,
            success: true,
            location: {
              name: input.query,
              // We don't have coordinates here, but the client will fetch them
              zoom: input.zoom || 12
            }
          };
        } catch (error) {
          result = {
            query: input.query,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        break;

      case 'map_get_bounds':
        try {
          console.log('Processing map get bounds request');
          
          result = {
            format: input.format || 'bbox',
            padding: input.padding || 0,
            success: true,
            message: 'Map bounds retrieval initiated - will be processed by frontend'
          };
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        break;

      case 'arcgis_parcel_search':
        try {
          console.log(`Processing parcel search: ${input.county}, ${input.apn}`);

          // For our demonstration, we'll mock the parcel data response
          // In production, this would call the fetchParcelByApn function
          const mockParcel = {
            type: "Feature",
            properties: {
              APN: input.apn,
              County: input.county,
              OwnerName: "Sample Owner",
              LandValue: 250000,
              ZoningCode: "R-1",
              Acres: 1.25
            },
            geometry: {
              type: "Polygon",
              coordinates: [[
                [-112.0, 33.45],
                [-111.98, 33.45],
                [-111.98, 33.47],
                [-112.0, 33.47],
                [-112.0, 33.45]
              ]]
            }
          };

          result = {
            apn: input.apn,
            county: input.county,
            success: true,
            parcel: mockParcel,
            center: [-111.99, 33.46], // Center of the parcel
            zoom: 16
          };
        } catch (error) {
          result = {
            apn: input.apn,
            county: input.county,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        break;
      case 'map_add_polygon':
        try {
          console.log(`Processing polygon request for: ${input.query}`);

          // For our demonstration, we'll return a successful response
          // The actual polygon fetching and drawing will be handled by the frontend
          result = {
            query: input.query,
            style: input.style || {},
            animate: input.animate !== false,
            success: true,
            message: `Polygon tool called for "${input.query}" - processing will be handled by frontend`
          };
        } catch (error) {
          result = {
            query: input.query,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        break;
      case 'map_clear_layers':
        try {
          console.log('Processing map clear layers request');
          
          result = {
            confirm: input.confirm !== false,
            success: true,
            message: 'Map layer clearing initiated'
          };
        } catch (error) {
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        break;

      default:
        return c.json({
          error: `Tool '${name}' has no implementation`
        }, 501);
    }

    return c.json({
      result
    });
  } catch (error) {
    console.error('Error processing tool invocation:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// After all API routes, add static file serving and SPA fallback
// Handle static assets through Cloudflare Workers Assets
app.get('/app.js', async (c) => {
  return c.env.ASSETS.fetch(new Request(`${new URL(c.req.url).origin}/app.js`));
});

app.get('/styles.css', async (c) => {
  return c.env.ASSETS.fetch(new Request(`${new URL(c.req.url).origin}/styles.css`));
});

app.get('/favicon.ico', async (c) => {
  return c.env.ASSETS.fetch(new Request(`${new URL(c.req.url).origin}/favicon.ico`));
});

// SPA fallback - serve index.html for all other routes
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(new Request(`${new URL(c.req.url).origin}/index.html`));
});

export default app;