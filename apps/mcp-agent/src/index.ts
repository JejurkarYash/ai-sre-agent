import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";

import { getRenderLogs } from "./tools/getRenderLogs";
import { detectError } from "./tools/detectError";
import { suggestFix } from "./tools/suggestFix";
import { notify } from "./tools/notify/notify";

// Load service config
const serviceConfig = JSON.parse(
  readFileSync(resolve(__dirname, "../services.json"), "utf-8")
);

// 1. Create the MCP server
const server = new McpServer({
  name: "sre-monitor-agent",
  version: "1.0.0",
});

// 2. Register tools
server.registerTool(
  "getLogs",
  {
    title: "Get Render Logs",
    description: "Fetch logs from Render",
    inputSchema: {},
    outputSchema: {
      logs: z.string(),
    },
  },
  async () => {
    const result = await getRenderLogs();
    const text = typeof result === "string" ? result : JSON.stringify(result);
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: { logs: text } as Record<string, unknown>,
    };
  }
);

server.registerTool(
  "detectError",
  {
    title: "Detect Error",
    description: "Analyze logs using Gemini to detect errors",
    inputSchema: {
      logs: z.string().describe("The logs to analyze"),
    },
    outputSchema: {
      errorFound: z.boolean(),
      errors: z.array(
        z.object({
          errorMessage: z.string(),
          rootCause: z.string(),
          errorType: z.string(),
          needsRestart: z.boolean(),
          needsRedeploy: z.boolean(),
        })
      ),
    },
  },
  async ({ logs }) => {
    const result = await detectError(logs);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  }
);

server.registerTool(
  "suggestFix",
  {
    title: "Suggest Fix",
    description: "Generate fix suggestions for detected errors",
    inputSchema: {
      errorDetails: z.object({
        errorFound: z.boolean(),
        errors: z.array(
          z.object({
            errorMessage: z.string(),
            rootCause: z.string(),
            errorType: z.string(),
            needsRestart: z.boolean(),
            needsRedeploy: z.boolean(),
          })
        ),
      }).describe("The error details object from detectError"),
    },
    outputSchema: {
      fixes: z.array(
        z.object({
          errorMessage: z.string(),
          fix: z.string(),
          commands: z.array(z.string()),
        })
      ),
    },
  },
  async ({ errorDetails }) => {
    const result = await suggestFix({ errorDetails });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  }
);

server.registerTool(
  "notify",
  {
    title: "Send Notification",
    description:
      "Send Slack notification combining error details and fix suggestions. serviceName is auto-filled from services.json.",
    inputSchema: {
      errorMessage: z.string().describe("The error message from detectError"),
      rootCause: z.string().describe("The root cause from detectError"),
      severity: z.string().describe("The errorType from detectError (e.g. memory, crash, timeout)"),
      suggestedFix: z.string().describe("The fix suggestion from suggestFix"),
    },
    outputSchema: {
      success: z.boolean(),
    },
  },
  async ({ errorMessage, rootCause, severity, suggestedFix }) => {
    const serviceName = serviceConfig.name || "Unknown Service";
    const result = await notify({ serviceName, severity, errorMessage, rootCause, suggestedFix });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  }
);

// 3. Connect to transport and start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SRE Monitor Agent MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});