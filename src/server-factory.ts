/**
 * MCP Server Factory — shared between stdio and HTTP transports
 *
 * Creates a configured MCP Server instance with tool handlers.
 * Both stdio (CLI) and HTTP (remote) transports use this factory
 * so the tool surface is identical regardless of transport.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleTool, TOOLS } from "./tools.js";

const SERVER_NAME = "crowdlisten/harness";
const SERVER_VERSION = "0.6.0";

export interface McpServerOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
}

/**
 * Creates and configures an MCP Server with all tool handlers registered.
 * The caller is responsible for connecting a transport (stdio or HTTP).
 */
export function createMcpServer(opts: McpServerOptions): Server {
  const { supabase: sb, userId } = opts;

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    try {
      const result = await handleTool(
        sb,
        userId,
        name,
        (toolArgs || {}) as Record<string, unknown>
      );
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: message }) },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Creates an anonymous MCP Server for unauthenticated requests.
 * Lists tools normally (ChatGPT needs this for discovery) but
 * rejects tool calls with an auth-required message.
 */
export function createAnonymousMcpServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "Authentication required. Get an API key at https://crowdlisten.com/settings",
        }),
      },
    ],
    isError: true,
  }));

  return server;
}

export { SERVER_NAME, SERVER_VERSION };
