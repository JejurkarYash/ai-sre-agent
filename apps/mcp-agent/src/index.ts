import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";
import express from "express";

import { getRenderLogs } from "./tools/getRenderLogs";
import { detectError } from "./tools/detectError";
import { suggestFix } from "./tools/suggestFix";
import { notify } from "./tools/notify/notify";

// Load service config
const serviceConfig = JSON.parse(
  readFileSync(resolve(__dirname, "../services.json"), "utf-8")
);

// 1. Create the MCP server
const server = new McpServer(
  {
    name: "sre-monitor-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 2. Register the full pipeline tool
server.registerTool(
  "runFullPipeline",
  {
    title: "Run Full SRE Pipeline",
    description:
      "Runs the complete SRE monitoring pipeline: fetch logs from Render → detect errors using Gemini → suggest fixes → send Slack notifications. No input needed — just call this tool.",
    inputSchema: {},
  },
  async () => {
    const steps: string[] = [];

    try {
      // Step 1: Get logs
      console.log("🔍 Step 1: Fetching logs...");
      const logs = await getRenderLogs();
      const logsText = typeof logs === "string" ? logs : JSON.stringify(logs);
      steps.push(`✅ Step 1 — Fetched logs (${logsText.length} chars)`);

      // Step 2: Detect errors
      console.log("🔍 Step 2: Detecting errors...");
      const errors = await detectError(logsText);
      const safeErrors = errors ?? { errorFound: false, errors: [] };
      steps.push(
        `✅ Step 2 — Error detection complete: errorFound=${safeErrors.errorFound}, count=${safeErrors.errors?.length ?? 0}`
      );

      if (!safeErrors.errorFound || !safeErrors.errors?.length) {
        const result = {
          pipeline: "completed",
          steps,
          summary: "No errors detected in logs.",
          errors: safeErrors,
          fixes: { fixes: [] },
          notifications: [],
        };
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      }

      // Step 3: Suggest fixes
      console.log("🔍 Step 3: Suggesting fixes...");
      const fixes = await suggestFix({ errorDetails: safeErrors });
      const safeFixes = fixes ?? { fixes: [] };
      steps.push(
        `✅ Step 3 — Fix suggestions generated: ${safeFixes.fixes?.length ?? 0} fixes`
      );

      // Step 4: Send notifications for each error
      console.log("🔍 Step 4: Sending notifications...");
      const serviceName = serviceConfig.name || "Unknown Service";
      const notifications = [];

      for (let i = 0; i < safeErrors.errors.length; i++) {
        const err = safeErrors.errors[i];
        const fixText =
          safeFixes.fixes?.[i]?.fix || "No fix suggestion available";

        try {
          const notifResult = await notify({
            serviceName,
            severity: err.errorType,
            errorMessage: err.errorMessage,
            rootCause: err.rootCause,
            suggestedFix: fixText,
          });
          notifications.push({
            error: err.errorMessage,
            notified: true,
            ...notifResult,
          });
        } catch (notifErr: any) {
          notifications.push({
            error: err.errorMessage,
            notified: false,
            reason: notifErr.message || "Notification failed",
          });
        }
      }

      steps.push(
        `✅ Step 4 — Sent ${notifications.filter((n) => n.notified).length}/${safeErrors.errors.length} notifications`
      );

      const result = {
        pipeline: "completed",
        steps,
        errors: safeErrors,
        fixes: safeFixes,
        notifications,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (err: any) {
      console.error("❌ Pipeline error:", err);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              pipeline: "failed",
              steps,
              error: err.message || "Unknown pipeline error",
            }),
          },
        ],
      };
    }
  }
);

// 3. Connect to transport and start (STATELESS MODE)
async function main() {
  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", server: "sre-monitor-agent" });
  });

  app.listen(PORT, () => {
    console.log(`✅ SRE Monitor Agent running on http://localhost:${PORT}/mcp`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  });
}

main().catch((error) => {
  console.error("❌ Server error:", error);
  process.exit(1);
});