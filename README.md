# Log Auto-Fix — AI-Powered SRE Monitor Agent

An intelligent SRE monitoring pipeline that automatically fetches logs from [Render](https://render.com), detects errors using [Gemini AI](https://ai.google.dev/), suggests fixes, and sends alerts to Slack — all exposed as a single MCP tool.

## How It Works

```
Render Logs → Gemini (Detect Errors) → Gemini (Suggest Fixes) → Slack Notification
```

The MCP server exposes a single tool — `runFullPipeline` — that runs the entire workflow:

1. **Fetch Logs** — Pulls recent logs from your Render service via the Render API
2. **Detect Errors** — Sends logs to Gemini 2.5 Flash to identify errors, root causes, and error types
3. **Suggest Fixes** — Sends detected errors back to Gemini to generate actionable fix suggestions
4. **Notify via Slack** — Sends a formatted Slack alert for each error with its suggested fix

## Project Structure

```
apps/
  mcp-agent/              # The MCP server (core of the project)
    src/
      index.ts            # MCP server setup & runFullPipeline tool
      lib/
        gemini.ts         # Gemini AI client config
      tools/
        getRenderLogs.ts  # Fetches logs from Render API
        detectError.ts    # AI-powered error detection
        suggestFix.ts     # AI-powered fix suggestions
        notify/
          notify.ts       # Notification orchestrator
          slack.ts        # Slack webhook integration
    services.json         # Service config (name, IDs, channels)
  dashboard/              # Dashboard app
  workflows/              # Workflow definitions
packages/
  eslint-config/          # Shared ESLint config
  typescript-config/      # Shared TypeScript config
  ui/                     # Shared UI components
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (Streamable HTTP transport, stateless mode)
- **AI:** Google Gemini 2.5 Flash via `@google/genai`
- **Server:** Express.js
- **Notifications:** Slack Incoming Webhooks
- **Log Source:** Render API
- **Monorepo:** Turborepo + pnpm

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A [Render](https://render.com) account with API access
- A [Google AI](https://ai.google.dev/) API key (Gemini)
- A [Slack Incoming Webhook](https://api.slack.com/messaging/webhooks) URL

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create `apps/mcp-agent/.env`:

```env
RENDER_API_KEY=your_render_api_key
RENDER_SERVICE_ID=your_render_service_id
RENDER_OWNER_ID=your_render_owner_id
GEMINI_API_KEY=your_gemini_api_key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PORT=3001
```

### 3. Configure your service

Edit `apps/mcp-agent/services.json`:

```json
{
  "name": "Your Service Name",
  "description": "Description of your service",
  "serviceID": "srv-...",
  "ownerID": "tea-...",
  "channels": ["slack"]
}
```

### 4. Run the MCP server

```bash
cd apps/mcp-agent
pnpm dev
```

The server starts at `http://localhost:3001/mcp` with a health check at `http://localhost:3001/health`.

## Usage

### With an MCP Client (Archestra, Claude, etc.)

Connect your MCP client to `http://localhost:3001/mcp` and call the `runFullPipeline` tool. No arguments needed.

### With curl

**List available tools:**
```bash
curl -s http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq .
```

**Run the full pipeline:**
```bash
curl -s http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"runFullPipeline","arguments":{}}}' | jq .
```

## Pipeline Output

The tool returns a JSON response with:

```json
{
  "pipeline": "completed",
  "steps": [
    "✅ Step 1 — Fetched logs (12345 chars)",
    "✅ Step 2 — Error detection complete: errorFound=true, count=2",
    "✅ Step 3 — Fix suggestions generated: 2 fixes",
    "✅ Step 4 — Sent 2/2 notifications"
  ],
  "errors": { "errorFound": true, "errors": [...] },
  "fixes": { "fixes": [...] },
  "notifications": [...]
}
```

## Slack Alert Format

Each error triggers a Slack message with:

- **Service** name
- **Severity** (memory, crash, timeout, port-issue, etc.)
- **Error message**
- **Root cause**
- **Suggested fix**

## License

ISC
