## Project Overview

This project is a Cloudflare Worker application that implements a Model Control Protocol (MCP) server for controlling Mapbox maps. The application uses:

- TypeScript for type safety
- Hono for API routing
- OpenAI and Anthropic's Bedrock SDK for AI model access
- Mapbox GL JS for interactive maps
- Server-Sent Events (SSE) for MCP client connections

## Getting Started

Before you begin, you will need a Cloudflare account.

### 1. Sign Up for Cloudflare

If you don't have one already, [sign up for a free Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).

### 2. Install Wrangler

Wrangler is the command-line interface for Cloudflare Workers. You can install it using npm:

```bash
npm install -g wrangler
```

After installation, you'll need to log in to your Cloudflare account:

```bash
wrangler login
```

This will open a browser window to authenticate with Cloudflare. Once authenticated, you can proceed with setting up the project.

## Development Environment

### Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build the project
npm run build

# Deploy to Cloudflare (default environment)
npm run deploy

# Deploy to staging environment
npm run deploy:staging

# Deploy to production environment
npm run deploy:production

# Type checking
npm run lint
```

### Environment Variables

The following environment variables need to be set in your Cloudflare Worker:

- `OPENAI_API_KEY`: Your OpenAI API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key (optional)
- `MAPBOX_ACCESS_TOKEN`: Your Mapbox access token

To set a secret for deployment:
```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put MAPBOX_ACCESS_TOKEN
```

## Code Architecture

### Core Components

1. **MCP Server (`src/services/mcp-server.ts`)**
   - Handles communication with AI models
   - Processes MCP requests and tool calls
   - Supports both OpenAI and Anthropic models

2. **Mapbox Tools (`src/services/mapbox-tools.ts`)**
   - Defines MCP tools for Mapbox map operations
   - Includes tools for initializing maps, moving, adding/removing layers, etc.

3. **API Routes (`src/index.ts`)**
   - Implements Hono routes for the MCP server
   - Handles API endpoints for chat and tool result processing
   - Provides SSE endpoint for MCP client connections
   - Exposes tool listing and invocation endpoints

4. **Frontend (`public/`)**
   - HTML, CSS, and client-side JavaScript
   - Implements the map interface and chat functionality
   - Communicates with the MCP server

### Data Flow

1. **Web UI:** User sends a message via the chat interface
   - The message is sent to the MCP server
   - The MCP server forwards the message to an AI model
   - Tool calls are executed on the map
   - Results are displayed to the user

2. **MCP Client:** External AI assistants connect to the SSE endpoint
   - Client establishes SSE connection to `/sse`
   - Client gets available tools via `/tools`
   - Client invokes tools via `/invoke`
   - Results are returned to the client

## Deployment

### Standard Deployment

```bash
npm run deploy
```

This will deploy your worker to `map-mcp-tools.your-worker-subdomain.workers.dev`.

### Environment-Specific Deployments

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

### Connecting with MCP Clients

After deployment, your MCP server will be accessible at:
- SSE endpoint: `https://map-mcp-tools.your-worker-subdomain.workers.dev/sse`
- Tools endpoint: `https://map-mcp-tools.your-worker-subdomain.workers.dev/tools`
- Invoke endpoint: `https://map-mcp-tools.your-worker-subdomain.workers.dev/invoke`

You can connect to your MCP server using the [MCP Inspector](https://github.com/ModelContextProtocol/inspector) or other MCP clients.

## Important Notes

- This application implements the Model Control Protocol (MCP) pattern as described in [Cloudflare's MCP server guide](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- The MCP server allows AI models to control Mapbox maps through a set of predefined tools
- The application is designed to be deployed as a Cloudflare Worker (can be adapted to whatever environment with the same patterns.)
- Authentication can be added following Cloudflare's examples for OAuth integration