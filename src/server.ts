import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from './config.js';
import { createClient } from './client.js';
import { registerAllTools } from './tools/index.js';

const SERVER_NAME = 'jsonfabrica-mcp-server';
const SERVER_VERSION = '0.1.0';

/**
 * Builds the McpServer instance, wiring the API client and every tool
 * module. Does not connect a transport — that's the caller's job.
 */
export function buildServer(config: Config): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const client = createClient(config);
  registerAllTools(server, client);
  return server;
}
